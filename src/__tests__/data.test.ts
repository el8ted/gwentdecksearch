import { describe, expect, it } from 'vitest'
import dataJson from '../../data/decks.json'
import { DEFAULT_STRATAGEM } from '../../scripts/lib/build.ts'
import { indexDecks } from '../filter.ts'
import type { Dataset } from '../types.ts'

// The page indexes data/decks.json at load, so a bad deck there would blank it for everyone.
const data = dataJson as unknown as Dataset

describe('data/decks.json', () => {
  it('indexes every deck (each has a leader and a stratagem)', () => {
    // Act
    const decks = indexDecks(data)

    // Assert
    expect(decks).toHaveLength(data.decks.length)
  })

  it('would fail on a deck without a leader', () => {
    // Arrange
    const [first] = data.decks
    const broken = {
      ...data,
      decks: [{ ...first, cards: first.cards.filter(([id]) => data.cards[id].type !== 'leader') }],
    }

    // Act + Assert
    expect(() => indexDecks(broken)).toThrow(/lacks a leader/)
  })

  // Crafting costs shown on cards come from playgwent; a mismatch means its prices or codes changed.
  it("gives every card its rarity's crafting cost, or none for leaders and the default stratagem", () => {
    // Arrange
    const cost = { common: 30, rare: 80, epic: 200, legendary: 800 }

    // Act
    const odd = Object.entries(data.cards).filter(([, c]) => c.scraps !== (c.type === 'leader' ? 0 : cost[c.rarity]))

    // Assert
    expect(odd.map(([id, c]) => `${id} ${c.name}`)).toEqual([
      `${DEFAULT_STRATAGEM} ${data.cards[DEFAULT_STRATAGEM].name}`,
    ])
    expect(data.cards[DEFAULT_STRATAGEM].scraps).toBe(0)
  })
})
