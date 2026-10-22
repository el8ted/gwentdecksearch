import { describe, expect, it } from 'vitest'
import {
  cardLookup,
  cardName,
  caveat,
  describeCards,
  halfYear,
  nameLookup,
  profile,
  readAnalysisData,
} from '../analysis.ts'
import { DATA } from './analysis-data.ts'

const deck = (id: string) => DATA.decks.find((d) => d.deck.id === id) ?? DATA.decks[0]

describe('cardLookup', () => {
  it('finds a card by ID, or by name in any language, ignoring case and accents', () => {
    // Arrange
    const lookup = cardLookup(DATA)

    // Act / Assert
    expect(lookup('100')).toEqual({ ok: true, value: 100 })
    expect(lookup(' caranthir ar-feiniel ')).toEqual({ ok: true, value: 100 })
    expect(lookup('каранир')).toEqual({ ok: true, value: 100 })
    expect(lookup('卡兰希尔')).toEqual({ ok: true, value: 100 })
  })

  it('returns every card sharing an exact name, and partial matches as suggestions', () => {
    // Arrange
    const lookup = cardLookup(DATA)

    // Act / Assert
    expect(lookup('先知')).toEqual({ ok: false, exact: true, matches: [105, 106] })
    expect(lookup('caranthir')).toEqual({ ok: false, exact: false, matches: [100] })
    expect(lookup('nothing like it')).toEqual({ ok: false, exact: false, matches: [] })
  })
})

describe('nameLookup', () => {
  it('ignores punctuation for exact names, and suggests names whose words start with the typed ones', () => {
    // Arrange
    const lookup = nameLookup({ en: { a: 'Vilgefortz: Renegade', b: 'Eternal Eclipse Deacon', c: 'Vilgefortz' } })

    // Act / Assert
    expect(lookup('Vilgefortz Renegade')).toEqual({ ok: true, value: 'a' })
    expect(lookup('E. Eclipse Deacon')).toEqual({ ok: false, exact: false, matches: ['b'] })
    expect(lookup('DB Archer')).toEqual({ ok: false, exact: false, matches: [] })
  })

  it('suggests nothing for an empty query', () => {
    // Act
    const found = nameLookup({ en: { a: 'Defender' } })('')

    // Assert
    expect(found).toEqual({ ok: false, exact: false, matches: [] })
  })
})

describe('cardName and describeCards', () => {
  it('names a card in a language, with the English name beside it, falling back to English', () => {
    // Act / Assert
    expect(cardName(DATA, 100, 'zh-cn')).toBe('卡兰希尔 (Caranthir Ar-Feiniel)')
    expect(cardName(DATA, 101, 'zh-cn')).toBe('Nekker')
    expect(cardName(DATA, 999)).toBe('999')
    expect(describeCards(DATA, [105])).toBe('  105  Prophet (NG unit, 7 provisions)')
  })
})

describe('halfYear and profile', () => {
  it('dates decks by their guide, and sums up who plays them and when', () => {
    // Act
    const text = profile(DATA, [deck('A'), deck('B'), deck('C')])

    // Assert
    expect([deck('A'), deck('B'), deck('C')].map(halfYear)).toEqual(['2026 H2', '2025 H1', 'undated'])
    expect(text).toContain('Factions: MO 3')
    expect(text).toContain('Leaders: Arachas Swarm 3')
    expect(text).toContain('By half-year (guide date): 2025 H1 1 · 2026 H2 1 · undated 1')
  })
})

describe('caveat', () => {
  it('says how many decks, from when, and what the data can show', () => {
    // Act / Assert
    expect(caveat(DATA)).toMatch(/^_5 published decks .* \(data from 2026-10-22\).*not ladder play/)
  })
})

describe('readAnalysisData', () => {
  it('reads the committed data, with English names from the catalog beside the other languages', async () => {
    // Act
    const data = await readAnalysisData()

    // Assert
    expect(data.decks.length).toBe(data.dataset.decks.length)
    expect(data.names.en[202425]).toBe('Azar Javed')
    expect(Object.keys(data.names)).toContain('zh-cn')
    expect(data.tags.en?.defender).toBe('Defender')
  })
})
