import { describe, expect, it } from 'vitest'
import {
  budgetOf,
  budgetSide,
  cardFrequency,
  type FilterState,
  facets,
  type IndexedDeck,
  indexDecks,
  matchDecks,
  provisionStatus,
  sharedCards,
  singleFaction,
} from '../filter.ts'
import type { Card, Dataset, Deck } from '../types.ts'

// Leaders 1 (MO, +15) and 2 (NG, +16); stratagems 10, 11; cards 100–103.
const card = (name: string, type: Card['type'], faction: Card['faction'], provisions: number): Card => ({
  name,
  type,
  faction,
  provisions,
})
const CARDS: Dataset['cards'] = {
  1: { ...card('Arachas Swarm', 'leader', 'MO', 15), tags: ['spawn'] },
  2: card('Imperial Formation', 'leader', 'NG', 16),
  10: card('Enchanted Armor', 'stratagem', 'NE', 0),
  11: card('Tactical Advantage', 'stratagem', 'NE', 0),
  100: { ...card('Golden Nekker', 'special', 'NE', 14), tags: ['deploy'] },
  101: { ...card('Chimera', 'unit', 'MO', 5), tags: ['c18'] },
  102: card('Royal Decree', 'special', 'NE', 9),
  103: { ...card('Cadaverine', 'special', 'NG', 6), tags: ['deploy', 'poison'] },
  104: { ...card('Tatterwing', 'unit', 'SY', 9), secondaryFaction: 'MO' },
  105: card('Moonlight', 'special', 'MO', 8),
}
const deck = (
  name: string,
  id: string,
  provisions: number,
  cards: [number, number][],
  sources: Deck['sources'] = ['shinmiri2'],
): Deck => ({
  name,
  id,
  url: `https://www.playgwent.com/decks/${id}`,
  stats: { scraps: 0, cards: 25, units: 13, provisions },
  sources,
  cards,
})
const DATA: Dataset = {
  scrapedAt: '2026-10-13',
  cards: CARDS,
  tags: {},
  decks: [
    deck('GN Swarm', 'a1', 166, [
      [1, 1],
      [10, 1],
      [100, 1],
      [101, 2],
      [102, 1],
    ]),
    deck('Portal', 'b1', 165, [
      [1, 1],
      [11, 1],
      [101, 2],
      [102, 1],
    ]),
    deck(
      'Portal',
      'b2',
      160,
      [
        [1, 1],
        [11, 1],
        [101, 1],
      ],
      ['metallic-danny'],
    ),
    deck(
      'Soldiers',
      'c1',
      166,
      [
        [2, 1],
        [10, 1],
        [103, 2],
        [102, 1],
      ],
      ['community', 'shinmiri2'],
    ),
  ],
}
const DECKS = indexDecks(DATA)
const state = (s: Partial<FilterState> = {}): FilterState => ({ factions: [], cards: [], ...s })
const ids = (decks: { deck: Deck }[]) => decks.map((e) => e.deck.id)

describe('indexDecks', () => {
  it('takes faction from the leader, not neutral stratagems', () => {
    // Arrange
    const data = DATA

    // Act
    const [first, , , last] = indexDecks(data)

    // Assert
    expect([first.faction, first.leader, first.stratagem]).toEqual(['MO', 1, 10])
    expect(last.faction).toBe('NG')
  })

  it('throws for a deck without a leader', () => {
    // Arrange
    const data = { ...DATA, decks: [deck('Broken', 'x', 0, [[10, 1]])] }

    // Act
    const act = () => indexDecks(data)

    // Assert
    expect(act).toThrow('lacks a leader')
  })
})

describe('provisionStatus', () => {
  it('reports over, exact and spare against 150 + leader bonus', () => {
    // Arrange
    const [over, exact, spare] = DECKS

    // Act
    const statuses = [over, exact, spare].map((e) => provisionStatus(e, CARDS))

    // Assert
    expect(statuses).toEqual([
      { limit: 165, used: 166, delta: -1 },
      { limit: 165, used: 165, delta: 0 },
      { limit: 165, used: 160, delta: 5 },
    ])
  })
})

describe('matchDecks', () => {
  it('returns every deck for empty filters', () => {
    // Arrange
    const s = state()

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['a1', 'b1', 'b2', 'c1'])
  })

  it('requires faction, leader, stratagem and every card to match', () => {
    // Arrange
    const s = state({ factions: ['MO'], leader: 1, stratagem: 11, cards: [102] })

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['b1'])
  })

  it('keeps same-name alternates that both match', () => {
    // Arrange
    const s = state({ cards: [101] })

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['a1', 'b1', 'b2'])
  })
})

describe('matchDecks card matching', () => {
  it('requires every selected card by default, sorted by name then id', () => {
    // Arrange
    const s = state({ cards: [101, 102] })

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['a1', 'b1'])
  })

  it('with match any, keeps decks with at least one card, most hits first', () => {
    // Arrange
    const s = state({ match: 'any', cards: [101, 102, 103] })

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['a1', 'b1', 'c1', 'b2'])
  })

  it('still applies the faction filter with match any', () => {
    // Arrange
    const s = state({ match: 'any', factions: ['NG'], cards: [101, 102] })

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['c1'])
  })
})

describe('matchDecks tag matching', () => {
  it("counts a tag on any of the deck's cards, leader included", () => {
    // Act
    const [deploy, spawn] = [
      matchDecks(DECKS, state({ tags: ['deploy'] })),
      matchDecks(DECKS, state({ tags: ['spawn'] })),
    ]

    // Assert
    expect(ids(deploy)).toEqual(['a1', 'c1'])
    expect(ids(spawn)).toEqual(['a1', 'b1', 'b2'])
  })

  it('treats tags like cards under all and any', () => {
    // Arrange
    const wanted = { cards: [103], tags: ['c18'] }

    // Act
    const [all, any] = [matchDecks(DECKS, state(wanted)), matchDecks(DECKS, state({ ...wanted, match: 'any' }))]

    // Assert
    expect(ids(all)).toEqual([])
    expect(ids(any)).toEqual(['a1', 'b1', 'b2', 'c1'])
  })

  it('ranks decks with more selected tags first under any', () => {
    // Act
    const result = matchDecks(DECKS, state({ tags: ['deploy', 'c18'], match: 'any' }))

    // Assert
    expect(ids(result)).toEqual(['a1', 'b1', 'b2', 'c1'])
  })
})

describe('facets', () => {
  it('offers only the tags the matching decks have', () => {
    // Act
    const f = facets(DECKS, state({ cards: [103] }))

    // Assert
    expect(f.tags).toEqual(
      new Map([
        ['deploy', 1],
        ['poison', 1],
      ]),
    )
  })

  it('counts each dimension with its own filter removed', () => {
    // Arrange
    const s = state({ leader: 1, stratagem: 11 })

    // Act
    const f = facets(DECKS, s)

    // Assert
    expect(f.leaders).toEqual(new Map([[1, 2]]))
    expect(f.stratagems).toEqual(
      new Map([
        [10, 1],
        [11, 2],
      ]),
    )
    expect(f.factions).toEqual(new Map([['MO', 2]]))
    expect(f.cards).toEqual(
      new Map([
        [101, 2],
        [102, 1],
      ]),
    )
  })

  it('applies the any/all card match', () => {
    // Arrange
    const all = state({ cards: [100, 103] })
    const any = state({ match: 'any', cards: [100, 103] })

    // Act
    const [fAll, fAny] = [facets(DECKS, all), facets(DECKS, any)]

    // Assert
    expect(fAll.factions.size).toBe(0)
    expect(fAny.factions).toEqual(
      new Map([
        ['MO', 1],
        ['NG', 1],
      ]),
    )
  })
})

describe('cardFrequency', () => {
  it('counts unseen non-leader, non-stratagem cards, most common first', () => {
    // Arrange
    const decks = matchDecks(DECKS, state({ leader: 1 }))

    // Act
    const result = cardFrequency(decks, [101])

    // Assert
    expect(result).toEqual([
      [102, 2],
      [100, 1],
    ])
  })

  it('lists least common first, ties by card ID', () => {
    // Arrange
    const decks = DECKS

    // Act
    const result = cardFrequency(decks, [], 'least')

    // Assert
    expect(result).toEqual([
      [100, 1],
      [103, 1],
      [101, 3],
      [102, 3],
    ])
  })
})

describe('singleFaction', () => {
  it('names the faction of a single-faction card', () => {
    // Act
    const result = singleFaction(CARDS[101])

    // Assert
    expect(result).toBe('MO')
  })

  it('is undefined for neutral and dual-faction cards', () => {
    // Act
    const result = [CARDS[100], CARDS[104]].map(singleFaction)

    // Assert
    expect(result).toEqual([undefined, undefined])
  })
})

describe('source filtering', () => {
  it('keeps decks listed by any selected source', () => {
    // Arrange
    const s = state({ sources: ['community', 'metallic-danny'] })

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['b2', 'c1'])
  })

  it('counts each source a deck belongs to, ignoring the source filter itself', () => {
    // Arrange
    const s = state({ sources: ['community'] })

    // Act
    const f = facets(DECKS, s)

    // Assert
    expect(f.sources).toEqual(
      new Map([
        ['shinmiri2', 3],
        ['metallic-danny', 1],
        ['community', 1],
      ]),
    )
  })
})

describe('budgetOf', () => {
  it('steps 1, 2, then 3 or more on each side of exact', () => {
    // Act
    const steps = [-9, -3, -2, -1, 0, 1, 2, 3, 40].map(budgetOf)

    // Assert
    expect(steps).toEqual(['over3', 'over3', 'over2', 'over1', 'exact', 'spare1', 'spare2', 'spare3', 'spare3'])
    expect(steps.map(budgetSide)).toEqual(['over', 'over', 'over', 'over', 'exact', 'spare', 'spare', 'spare', 'spare'])
  })
})

describe('provision status filtering', () => {
  it('classifies each deck against 150 + leader bonus', () => {
    // Arrange
    const decks = DECKS

    // Act
    const budgets = decks.map((e) => [e.deck.id, e.budget])

    // Assert
    expect(budgets).toEqual([
      ['a1', 'over1'],
      ['b1', 'exact'],
      ['b2', 'spare3'],
      ['c1', 'exact'],
    ])
  })

  it('keeps decks with any selected status and counts statuses ignoring that filter', () => {
    // Arrange
    const s = state({ budgets: ['spare3', 'over1'] })

    // Act
    const [result, f] = [matchDecks(DECKS, s), facets(DECKS, s)]

    // Assert
    expect(ids(result)).toEqual(['a1', 'b2'])
    expect(f.budgets).toEqual(
      new Map([
        ['over1', 1],
        ['exact', 2],
        ['spare3', 1],
      ]),
    )
  })
})

describe('sharedCards', () => {
  it('returns cards in every deck, leader included', () => {
    // Arrange
    const decks = matchDecks(DECKS, state({ leader: 1 }))

    // Act
    const result = sharedCards(decks)

    // Assert
    expect([...result].sort()).toEqual([1, 101])
  })

  it('is empty for no decks', () => {
    // Arrange
    const decks: IndexedDeck[] = []

    // Act
    const result = sharedCards(decks)

    // Assert
    expect(result.size).toBe(0)
  })
})
