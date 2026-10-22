import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '../../../src/i18n.ts'
import { cardPairsCsv, cardsCsv, csv, deckCardsCsv, decksCsv, leaderReports, manifest } from '../export.ts'
import { exportReadme } from '../export-readme.ts'
import { DATA } from './analysis-data.ts'

/** A CSV's rows as cells, the BOM and CRLF line ends checked and dropped (no quoted commas in these fixtures). */
const rows = (text: string) => {
  expect(text.startsWith('\uFEFF')).toBe(true)
  expect(text.endsWith('\r\n')).toBe(true)
  return text
    .slice(1, -2)
    .split('\r\n')
    .map((r) => r.split(','))
}
const row = (text: string, first: string) => {
  const [header, ...rest] = rows(text)
  const found = rest.find((r) => r[0] === first) ?? []
  return Object.fromEntries(header.map((h, i) => [h, found[i]]))
}

describe('csv', () => {
  it('quotes cells with commas, quotes or line breaks, and leaves undefined empty', () => {
    // Act
    const text = csv(
      ['a', 'b', 'c'],
      [
        ['x, y', 'say "hi"', undefined],
        ['line\nbreak', 1, 'plain'],
      ],
    )

    // Assert
    expect(text).toBe('\uFEFFa,b,c\r\n"x, y","say ""hi""",\r\n"line\nbreak",1,plain\r\n')
  })
})

describe('decksCsv and deckCardsCsv', () => {
  it("lists each deck with its leader, provisions against today's limit and video, and its cards by role", () => {
    // Act
    const deck = row(decksCsv(DATA), 'A')
    const cards = rows(deckCardsCsv(DATA)).filter((r) => r[0] === 'A')

    // Assert
    expect(deck).toMatchObject({
      faction: 'MO',
      leader: 'Arachas Swarm',
      stratagem: 'Tactical Advantage',
      provisions_used: '165',
      provision_limit: '165',
      provisions_spare: '0',
      provision_status: 'exact',
      sources: 'community',
      guide_updated: '2026-08-01',
      video_url: 'https://youtu.be/AAAAAAAAAAA',
      same_list_as: '',
    })
    expect(row(decksCsv(DATA), 'C').provision_status).toBe('over')
    expect(cards).toEqual([
      ['A', '1', 'Arachas Swarm', '1', 'leader'],
      ['A', '10', 'Tactical Advantage', '1', 'stratagem'],
      ['A', '100', 'Caranthir Ar-Feiniel', '1', 'card'],
      ['A', '101', 'Nekker', '39', 'card'],
    ])
  })
})

describe('cardsCsv', () => {
  it("counts each card's decks out of those that could run it, with tags and names in every language", () => {
    // Act
    const text = cardsCsv(DATA)
    const [header] = rows(text)

    // Assert
    expect(header.slice(-LANGUAGES.length)).toEqual(LANGUAGES.map((l) => `name_${l}`))
    expect(row(text, '100')).toMatchObject({
      faction: 'MO',
      rarity: 'common',
      decks: '2',
      decks_that_could: '3',
      share: '0.667',
      'name_zh-cn': '卡兰希尔',
      name_ru: 'Каранир',
      name_de: '',
    })
    expect(row(text, '102')).toMatchObject({ decks: '3', decks_that_could: '5', share: '0.6' })
    expect(row(text, '103')).toMatchObject({ tags: 'defender', tag_names: 'Defender' })
    expect(row(text, '106')).toMatchObject({ decks: '0', decks_that_could: '0', share: '0' })
  })
})

describe('cardPairsCsv', () => {
  it('lists pairs sharing enough decks, with lift counted over the decks that could run both', () => {
    // Act
    const [header, ...pairs] = rows(cardPairsCsv(DATA, 2))

    // Assert: the Monsters decks; Nekker is in all three, so nothing has lift over it
    expect(header).toEqual([
      'card_a',
      'card_b',
      'name_a',
      'name_b',
      'decks_together',
      'decks_a',
      'decks_b',
      'share_of_a',
      'share_of_b',
      'lift',
    ])
    expect(pairs).toEqual([
      ['1', '101', 'Arachas Swarm', 'Nekker', '3', '3', '3', '1', '1', '1'],
      ['1', '100', 'Arachas Swarm', 'Caranthir Ar-Feiniel', '2', '3', '2', '0.667', '1', '1'],
      ['100', '101', 'Caranthir Ar-Feiniel', 'Nekker', '2', '2', '3', '1', '0.667', '1'],
    ])
    expect(rows(cardPairsCsv(DATA))).toHaveLength(1)
  })
})

describe('leaderReports and manifest', () => {
  it('reports each leader with decks, card names in the language asked for', () => {
    // Act
    const reports = leaderReports(DATA, 'zh-cn')

    // Assert
    expect([...reports.keys()]).toEqual(['MO-arachas-swarm.md', 'NG-imperial-formation.md', 'SY-jackpot.md'])
    expect(reports.get('MO-arachas-swarm.md')).toContain('卡兰希尔 (Caranthir Ar-Feiniel)')
  })

  it('says when the data is from, how it was collected, and counts', () => {
    // Act
    const m = manifest(DATA)

    // Assert
    expect(m).toMatchObject({
      data_from: '2026-10-22T00:00:00Z',
      decks: 5,
      leaders: 3,
      decks_by_source: { community: 5 },
      windows: { community_guides_months: 18, sheet_patch_tabs_months: 12, sheet_main_lists: 'all' },
      min_pair_decks: 10,
    })
    expect(m.languages).toEqual([...LANGUAGES])
  })
})

describe('exportReadme', () => {
  it('writes every language, filled in, linked to the others, and the English column reference', () => {
    // Arrange
    const m = manifest(DATA)

    // Act
    const readmes = LANGUAGES.map((l) => exportReadme(l, m))

    // Assert
    for (const text of readmes) {
      expect(text).not.toMatch(/\{(site|repo|date|decks|cards|community|sheets|minPair)\}/)
      expect(text).toContain('2026-10-22')
      expect(text).toContain('card-pairs.csv')
    }
    expect(readmes[0]).toContain('## Columns')
    expect(readmes[0]).toContain('[简体中文](README.zh-cn.md)')
    expect(readmes[0]).toContain('Pairs in at least 10 decks together')
    const zh = readmes[LANGUAGES.indexOf('zh-cn')]
    expect(zh).toContain('**简体中文**')
    expect(zh).toContain('[各列说明（英文）](README.md#columns)')
    expect(zh).toContain('> 本页为机器翻译，欢迎指正。')
    expect(zh).not.toContain('## Columns')
  })
})
