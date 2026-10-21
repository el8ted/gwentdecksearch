import { describe, expect, it } from 'vitest'
import { type FilterState, indexDecks } from '../filter.ts'
import {
  addPick,
  chooseFaction,
  clearAll,
  flipPick,
  NO_MEMORY,
  removeDeck,
  removeNear,
  removePick,
  showDeck,
  showNear,
} from '../search.ts'
import type { Card, Dataset } from '../types.ts'

// Leader 1 (MO), stratagem 10; 100 a Monsters card, 101 a second one, 102 neutral.
const card = (name: string, type: Card['type'], faction: Card['faction']): Card => ({
  name,
  type,
  faction,
  provisions: 5,
  scraps: 30,
  rarity: 'common',
})
const CARDS: Dataset['cards'] = {
  1: card('Arachas Swarm', 'leader', 'MO'),
  10: card('Enchanted Armor', 'stratagem', 'NE'),
  100: card('Chimera', 'unit', 'MO'),
  101: card('Arachas', 'unit', 'MO'),
  102: card('Royal Decree', 'special', 'NE'),
}
const [DECK] = indexDecks({
  scrapedAt: '2026-10-20',
  cards: CARDS,
  tags: {},
  decks: [
    {
      name: 'Swarm',
      id: 'a1',
      url: 'https://www.playgwent.com/decks/a1',
      stats: { scraps: 0, cards: 25, units: 13, provisions: 170 },
      sources: ['shinmiri2'],
      cards: [
        [1, 1],
        [10, 1],
        [100, 2],
      ],
    },
  ],
})
const state = (s: Partial<FilterState> = {}): FilterState => ({ factions: [], picks: [], ...s })

describe('clearAll', () => {
  it('clears every filter but keeps All/Any and the Craft view, as a new Back step, forgetting everything', () => {
    // Arrange
    const s = state({ factions: ['MO'], picks: [100], match: 'any', tab: 'craft', leader: 1, near: 'a1' })

    // Act
    const step = clearAll(s)

    // Assert
    expect(step.next).toMatchObject({ factions: [], picks: [], match: 'any', tab: 'craft' })
    expect([step.next.leader, step.next.near]).toEqual([undefined, undefined])
    expect(step.push).toBe(true)
    expect(step.memory).toEqual(NO_MEMORY)
  })
})

describe('chooseFaction', () => {
  it('switches to the faction, or clears it when it is the only one, and makes it the visitor own choice', () => {
    // Arrange
    const m = { ...NO_MEMORY, autoFaction: 'MO' as const }

    // Act
    const [on, off] = [state(), state({ factions: ['MO'] })].map((s) => chooseFaction(s, m, 'MO'))

    // Assert
    expect([on.next.factions, off.next.factions]).toEqual([['MO'], []])
    expect(on.memory.autoFaction).toBeUndefined()
  })
})

describe('showDeck and removeDeck', () => {
  it('replaces the search and the Craft view with the deck, saying so only when there was a search', () => {
    // Act
    const fromSearch = showDeck(state({ picks: [102], tab: 'craft', match: 'any' }), 'a1')
    const fromNothing = showDeck(state({ match: 'any' }), 'a1')

    // Assert
    expect(fromSearch.next).toMatchObject({ deck: 'a1', picks: [], tab: undefined, match: 'any' })
    expect(fromSearch.push).toBe(true)
    expect([fromSearch.memory.deckReplaced, fromNothing.memory.deckReplaced]).toEqual([true, false])
  })

  it('removing the deck stops saying the search was replaced', () => {
    // Act
    const step = removeDeck({ ...NO_MEMORY, deckReplaced: true })

    // Assert
    expect(step).toEqual({ next: { deck: undefined }, memory: NO_MEMORY })
  })
})

describe('showNear and removeNear', () => {
  it('≈ sets the deck faction, leader and the steps that fit, remembering the search before', () => {
    // Arrange
    const before = state({ picks: [102], stratagem: 10 })

    // Act
    const step = showNear(before, NO_MEMORY, DECK)

    // Assert
    expect(step.next).toEqual({
      near: 'a1',
      deck: undefined,
      factions: ['MO'],
      leader: 1,
      stratagem: undefined,
      budgets: ['spare3', 'spare2', 'spare1', 'exact'],
    })
    expect(step.memory.beforeNear).toBe(before)
  })

  it('≈ again from a Similar list keeps the search before the first ≈, and ✕ restores it', () => {
    // Arrange
    const first = state({ picks: [102] })
    const m = showNear(first, NO_MEMORY, DECK).memory

    // Act
    const again = showNear(state({ near: 'a1' }), m, DECK)
    const back = removeNear(again.memory)

    // Assert
    expect(again.memory.beforeNear).toBe(first)
    expect(back.next).toMatchObject({ picks: [102], near: undefined, leader: undefined })
    expect(back.memory.beforeNear).toBeUndefined()
  })

  it('✕ on a shared ≈ link, with nothing to restore, drops the leader and provision steps', () => {
    // Act
    const step = removeNear(NO_MEMORY)

    // Assert
    expect(step.next).toEqual({ near: undefined, leader: undefined, budgets: [] })
  })
})

describe('addPick, removePick and flipPick', () => {
  it('a wanted faction card turns its faction on when none is, and removing it turns it off again', () => {
    // Act
    const added = addPick(state(), NO_MEMORY, 100, CARDS)
    const s = state({ ...added?.next } as FilterState)
    const removed = removePick(s, added?.memory ?? NO_MEMORY, 100, CARDS)

    // Assert
    expect(added?.next).toMatchObject({ picks: [100], factions: ['MO'], deck: undefined })
    expect(added?.memory.autoFaction).toBe('MO')
    expect(removed.next.factions).toEqual([])
    expect(removed.memory.autoFaction).toBeUndefined()
  })

  it('keeps the faction while another card of it is wanted, and when the visitor picked it', () => {
    // Arrange
    const m = { ...NO_MEMORY, autoFaction: 'MO' as const }

    // Act
    const other = removePick(state({ factions: ['MO'], picks: [100, 101] }), m, 100, CARDS)
    const own = removePick(state({ factions: ['MO'], picks: [100] }), NO_MEMORY, 100, CARDS)

    // Assert
    expect([other.next.factions, own.next.factions]).toEqual([undefined, undefined])
  })

  it('a neutral, excluded or repeated pick turns no faction on, and a repeat changes nothing', () => {
    // Act
    const neutral = addPick(state(), NO_MEMORY, 102, CARDS)
    const excluded = addPick(state(), NO_MEMORY, 100, CARDS, true)
    const repeat = addPick(state({ picks: [100] }), NO_MEMORY, 100, CARDS)

    // Assert
    expect([neutral?.next.factions, excluded?.next.factions]).toEqual([undefined, undefined])
    expect(excluded?.next.excludes).toEqual([100])
    expect(repeat).toBeUndefined()
  })

  it('flipping the last wanted card of an auto-picked faction to excluded turns the faction off', () => {
    // Act
    const step = flipPick(state({ factions: ['MO'], picks: [100] }), { ...NO_MEMORY, autoFaction: 'MO' }, 100, CARDS)

    // Assert
    expect(step.next).toEqual({ picks: [100], excludes: [100], factions: [] })
  })
})
