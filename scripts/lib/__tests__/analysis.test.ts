import { describe, expect, it } from 'vitest'
import {
  cardLookup,
  cardName,
  caveat,
  describeCards,
  explainLookup,
  factionScope,
  halfYear,
  langError,
  leaderCounts,
  nameLookup,
  option,
  positionals,
  profile,
  readAnalysisData,
  slug,
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

  it('suggests names a few typos away when nothing contains the text, closest first', () => {
    // Arrange
    const lookup = nameLookup({ en: { a: 'Caranthir Ar-Feiniel', b: 'Kolgrim', c: 'Caranthor' } })

    // Act / Assert
    expect(lookup('Caranthr')).toEqual({ ok: false, exact: false, matches: ['a', 'c'] })
    expect(lookup('Kolgirm')).toEqual({ ok: false, exact: false, matches: ['b'] })
    expect(lookup('Kol')).toEqual({ ok: false, exact: false, matches: ['b'] })
    expect(lookup('Zzz')).toEqual({ ok: false, exact: false, matches: [] })
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

describe('explainLookup', () => {
  it('asks for the ID when cards share a name, and lists suggestions otherwise', () => {
    // Act / Assert
    expect(explainLookup({ ok: false, exact: true, matches: [105, 106] }, '先知', DATA)).toBe(
      '"先知" could be any of these; use the ID:\n  105  Prophet (NG unit, 7 provisions)\n  106  Farseer (ST unit, 6 provisions)',
    )
    expect(explainLookup({ ok: false, exact: false, matches: [104] }, 'Kolg', DATA)).toBe(
      'no card is called "Kolg"; did you mean:\n  104  Kolgrim (NG unit, 10 provisions)',
    )
    expect(explainLookup({ ok: false, exact: false, matches: [] }, 'Zzz', DATA)).toBe('no card is called "Zzz"')
  })
})

describe('factionScope', () => {
  it("counts the decks that could run a card: its faction's, both of a dual-faction card's, or every deck", () => {
    // Arrange: 3 Monsters decks, 1 Nilfgaard, 1 Syndicate; 107 is Syndicate, also playable in Nilfgaard
    const dual = { ...DATA.catalog[105], faction: 'SY' as const, secondaryFaction: 'NG' as const }
    const data = { ...DATA, catalog: { ...DATA.catalog, 107: dual } }

    // Act
    const { allowed, decksThatCould } = factionScope(data)

    // Assert
    expect(decksThatCould(100)).toBe(3)
    expect(decksThatCould(102)).toBe(5)
    expect(decksThatCould(107)).toBe(2)
    expect(allowed(107)).toEqual(['SY', 'NG'])
    expect(decksThatCould(999)).toBe(5)
  })
})

describe('leaderCounts and slug', () => {
  it('counts decks per leader, most first', () => {
    // Act / Assert
    expect(leaderCounts(DATA.decks)).toEqual([
      [1, 3],
      [2, 1],
      [3, 1],
    ])
  })

  it('makes file names: accents off, other characters joined by -, at most 60 characters', () => {
    // Act / Assert
    expect(slug('Shinmiri’s & Lerio’s BC37 Ideas!')).toBe('shinmiri-s-lerio-s-bc37-ideas')
    expect(slug('Ça va? Łódź')).toBe('ca-va-lodz')
    expect(slug('!!!')).toBe('')
    expect(slug(`${'a'.repeat(59)} b`)).toBe('a'.repeat(59))
  })
})

describe('option, positionals and langError', () => {
  it('reads options and the arguments that are not options or their values', () => {
    // Arrange
    const args = ['ballot.txt', '--lang', 'zh-cn', '--detail', 'more']

    // Act / Assert
    expect(option(args, '--lang')).toBe('zh-cn')
    expect(option(args, '--out')).toBeUndefined()
    expect(positionals(args, ['--lang'])).toEqual(['ballot.txt', 'more'])
  })

  it('says which languages have names when one has none', () => {
    // Act / Assert
    expect(langError(DATA, 'zh-cn')).toBeUndefined()
    expect(langError(DATA, 'xx')).toBe('No card names in "xx"; try one of: en, ru, zh-cn')
  })
})
