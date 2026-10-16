import { describe, expect, it } from 'vitest'
import type { FilterState } from '../filter.ts'
import { decodeState, EMPTY_STATE, encodeState } from '../hash.ts'
import type { CardType } from '../types.ts'

const known = new Map<number, CardType>([
  [201743, 'leader'],
  [202497, 'stratagem'],
  [203123, 'unit'],
  [202838, 'special'],
])
const typeOf = (id: number) => known.get(id)

describe('encodeState', () => {
  it('returns an empty hash for the empty state', () => {
    // Arrange
    const s = EMPTY_STATE

    // Act
    const hash = encodeState(s)

    // Assert
    expect(hash).toBe('')
  })

  it('encodes every field compactly', () => {
    // Arrange
    const s: FilterState = {
      factions: ['MO', 'NG'],
      leader: 201743,
      stratagem: 202497,
      cards: [203123, 202838],
    }

    // Act
    const hash = encodeState(s)

    // Assert
    expect(hash).toBe('#f=MO%2CNG&l=201743&s=202497&c=203123%2C202838')
  })
})

describe('decodeState', () => {
  it('round-trips an encoded state', () => {
    // Arrange
    const s: FilterState = {
      match: 'any',
      factions: ['SK'],
      sources: ['community', 'shinmiri2'],
      budgets: ['spare', 'over'],
      leader: 201743,
      stratagem: undefined,
      cards: [203123],
    }

    // Act
    const decoded = decodeState(encodeState(s), typeOf)

    // Assert
    expect(decoded).toEqual(s)
  })

  it('drops unknown factions, unknown IDs, junk and duplicates', () => {
    // Arrange
    const hash = '#m=x&f=MO,XX&src=bogus&b=spare,huge&l=999&s=abc&c=203123,1.5,203123,7'

    // Act
    const decoded = decodeState(hash, typeOf)

    // Assert
    expect(decoded).toEqual({
      match: 'all',
      factions: ['MO'],
      sources: [],
      budgets: ['spare'],
      leader: undefined,
      stratagem: undefined,
      cards: [203123],
    })
  })

  it('drops a leader or stratagem ID that is another kind of card', () => {
    // Arrange
    const hash = '#l=203123&s=201743'

    // Act
    const decoded = decodeState(hash, typeOf)

    // Assert
    expect(decoded.leader).toBeUndefined()
    expect(decoded.stratagem).toBeUndefined()
  })

  it('returns the empty state for an empty hash', () => {
    // Arrange
    const hash = ''

    // Act
    const decoded = decodeState(hash, typeOf)

    // Assert
    expect(decoded).toEqual({ ...EMPTY_STATE, leader: undefined, stratagem: undefined })
  })
})
