import { describe, expect, it } from 'vitest'
import type { FilterState } from '../filter.ts'
import { decodeState, EMPTY_STATE, encodeState } from '../hash.ts'
import type { Card } from '../types.ts'

const known = new Map<number, Pick<Card, 'type' | 'faction'>>([
  [201743, { type: 'leader', faction: 'MO' }],
  [202497, { type: 'stratagem', faction: 'NE' }],
  [203123, { type: 'unit', faction: 'NE' }],
  [202838, { type: 'special', faction: 'NE' }],
])
const cardOf = (id: number) => known.get(id)
const isTag = (key: string) => ['c12', 'devotion'].includes(key)

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
      picks: [203123, 202838],
    }

    // Act
    const hash = encodeState(s)

    // Assert
    expect(hash).toBe('#f=MO%2CNG&l=201743&s=202497&c=203123%2C202838')
  })
})

describe('decodeState', () => {
  it('reads a pre-steps spare or over as every step on that side', () => {
    // Act
    const decoded = decodeState('#b=over,exact,over1', cardOf, isTag)

    // Assert
    expect(decoded.budgets).toEqual(['over1', 'over2', 'over3', 'exact'])
  })

  it('round-trips an encoded state', () => {
    // Arrange
    const s: FilterState = {
      match: 'any',
      factions: ['MO'],
      sources: ['community', 'metallic-danny'],
      budgets: ['spare2', 'over3'],
      leader: 201743,
      stratagem: undefined,
      picks: ['devotion', 203123, 'c12'],
    }

    // Act
    const decoded = decodeState(encodeState(s), cardOf, isTag)

    // Assert
    expect(decoded).toEqual(s)
  })

  it('drops unknown factions, unknown IDs, junk and duplicates', () => {
    // Arrange
    const hash = '#m=x&f=MO,XX&src=bogus&b=spare1,huge&l=999&s=abc&c=203123,1.5,c12,203123,7,bogus,c12,'

    // Act
    const decoded = decodeState(hash, cardOf, isTag)

    // Assert
    expect(decoded).toEqual({
      match: 'all',
      factions: ['MO'],
      sources: [],
      budgets: ['spare1'],
      leader: undefined,
      stratagem: undefined,
      picks: [203123, 'c12'],
    })
  })

  it('drops a leader outside the chosen faction, but keeps one with no faction chosen', () => {
    // Arrange: 201743 is a Monsters leader
    const mismatched = '#f=NR&l=201743'
    const alone = '#l=201743'

    // Act
    const [a, b] = [decodeState(mismatched, cardOf, isTag), decodeState(alone, cardOf, isTag)]

    // Assert
    expect(a.factions).toEqual(['NR'])
    expect(a.leader).toBeUndefined()
    expect(b.leader).toBe(201743)
  })

  it('drops a leader or stratagem ID that is another kind of card', () => {
    // Arrange
    const hash = '#l=203123&s=201743'

    // Act
    const decoded = decodeState(hash, cardOf, isTag)

    // Assert
    expect(decoded.leader).toBeUndefined()
    expect(decoded.stratagem).toBeUndefined()
  })

  it('returns the empty state for an empty hash', () => {
    // Arrange
    const hash = ''

    // Act
    const decoded = decodeState(hash, cardOf, isTag)

    // Assert
    expect(decoded).toEqual({ ...EMPTY_STATE, leader: undefined, stratagem: undefined })
  })
})
