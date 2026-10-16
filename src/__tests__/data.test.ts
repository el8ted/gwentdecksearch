import { describe, expect, it } from 'vitest'
import dataJson from '../../data/decks.json'
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
})
