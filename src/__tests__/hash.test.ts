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
const isAuthor = (key: string) => ['avajar', 'a,b c'].includes(key)

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
  it('round-trips authors among the picks, whatever their characters, and drops unknown ones', () => {
    // Arrange
    const s: FilterState = { ...EMPTY_STATE, picks: [203123, '@a,b c', 'c12', '@avajar'] }
    const hash = `${encodeState(s)}%2C%40nobody%2C%40%25E0`

    // Act
    const decoded = decodeState(hash, cardOf, isTag, isAuthor)

    // Assert
    expect(decoded.picks).toEqual([203123, '@a,b c', 'c12', '@avajar'])
  })

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
      video: true,
      langs: ['pt-BR', 'ru'],
      leader: 201743,
      stratagem: undefined,
      picks: ['devotion', 203123, 'c12'],
      excludes: [203123],
    }

    // Act
    const decoded = decodeState(encodeState(s), cardOf, isTag)

    // Assert
    expect(decoded).toEqual(s)
  })

  it("writes an excluded pick with a leading -, author keys included, and keeps a repeat's first sign", () => {
    // Arrange
    const s: FilterState = { ...EMPTY_STATE, picks: [203123, '@-innuendo-', 'c12'], excludes: [203123, '@-innuendo-'] }
    const isAuthor = (key: string) => key === '-innuendo-'

    // Act
    const hash = encodeState(s)
    const repeated = decodeState('#c=c12,-c12,-203123,203123', cardOf, isTag)

    // Assert
    expect(hash).toBe('#c=-203123%2C-%40-innuendo-%2Cc12')
    expect(decodeState(hash, cardOf, isTag, isAuthor)).toMatchObject({ picks: s.picks, excludes: s.excludes })
    expect(repeated).toMatchObject({ picks: ['c12', 203123], excludes: [203123] })
  })

  it('drops unknown factions, unknown IDs, junk and duplicates', () => {
    // Arrange
    const hash =
      '#m=x&f=MO,XX&src=bogus&b=spare1,huge&l=999&s=abc&c=203123,1.5,c12,203123,7,bogus,c12,&v=yes&gl=ru,xx,ru,zh-cn'

    // Act
    const decoded = decodeState(hash, cardOf, isTag)

    // Assert
    expect(decoded).toEqual({
      match: 'all',
      factions: ['MO'],
      sources: [],
      budgets: ['spare1'],
      video: false,
      langs: ['ru', 'zh-cn'],
      leader: undefined,
      stratagem: undefined,
      picks: [203123, 'c12'],
      excludes: [],
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

  it('round-trips a deck list, mapping a deck to its list and dropping an unknown one', () => {
    // Arrange
    const listOf = (id: string) => ({ abc: 'abc', dup: 'abc' })[id]
    const decode = (hash: string) => decodeState(hash, cardOf, isTag, () => false, listOf).deck

    // Act
    const hash = encodeState({ ...EMPTY_STATE, deck: 'abc' })

    // Assert
    expect(hash).toBe('#d=abc')
    expect([decode(hash), decode('#d=dup'), decode('#d=gone')]).toEqual(['abc', 'abc', undefined])
  })

  it('round-trips a similar-decks deck, dropping an unknown one', () => {
    // Arrange
    const listOf = (id: string) => ({ abc: 'abc', dup: 'abc' })[id]
    const decode = (hash: string) => decodeState(hash, cardOf, isTag, () => false, listOf).near

    // Act
    const hash = encodeState({ ...EMPTY_STATE, near: 'dup' })

    // Assert: the deck itself, not its card list
    expect(hash).toBe('#n=dup')
    expect([decode(hash), decode('#n=gone')]).toEqual(['dup', undefined])
  })

  it('round-trips the Craft tab, reading anything else as the deck list', () => {
    // Arrange
    const decode = (hash: string) => decodeState(hash, cardOf, isTag).tab

    // Act
    const hash = encodeState({ ...EMPTY_STATE, tab: 'craft' })

    // Assert
    expect(hash).toBe('#t=craft')
    expect([decode(hash), decode('#t=decks'), decode('')]).toEqual(['craft', undefined, undefined])
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
