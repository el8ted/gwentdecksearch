import { describe, expect, it } from 'vitest'
import {
  monthsBefore,
  normalizeUrl,
  parseCsv,
  parseGuideListing,
  parseSheet,
  parseSheetTabs,
  parseShinmiriSheet,
  patchOf,
  recentTabs,
  tabPatch,
} from '../sources.ts'

const SHINMIRI = `Faction,Leader,Deck Name,Deck Link,Alternate Version,Alternate Description,Youtube video,Last Edited,
MO,Arachas Swarm,GN Arachas Swarm,https://www.playgwent.com/en/decks/d8bd,,Bone Talisman version,https://youtu.be/x,12/5/2025,
MO,Arachas Swarm,Hive Mind Portal,https://www.playgwent.com/en/decks/5761,https://www.playgwent.com/decks/9873,,,4/26/2026,
MO,Carapace,Triple Tugo,,,,,,
NG,Enslave 6,Guide Deck,https://www.playgwent.com/en/decks/guides/405861,,,,,`

describe('parseShinmiriSheet', () => {
  it('returns one language-neutral entry for a row without an alternate', () => {
    // Arrange
    const csv = SHINMIRI

    // Act
    const entries = parseShinmiriSheet(csv)

    // Assert
    expect(entries[0]).toEqual({
      name: 'GN Arachas Swarm',
      url: 'https://www.playgwent.com/decks/d8bd',
      lang: 'en',
      source: 'shinmiri2',
    })
  })

  it('returns the alternate as a separate entry with the same name', () => {
    // Arrange
    const csv = SHINMIRI

    // Act
    const portal = parseShinmiriSheet(csv).filter((e) => e.name === 'Hive Mind Portal')

    // Assert
    expect(portal.map((e) => e.url)).toEqual([
      'https://www.playgwent.com/decks/5761',
      'https://www.playgwent.com/decks/9873',
    ])
  })

  it('skips the header and rows without a link, and keeps guide links', () => {
    // Arrange
    const csv = SHINMIRI

    // Act
    const entries = parseShinmiriSheet(csv)

    // Assert
    expect(entries.map((e) => e.name)).toEqual([
      'GN Arachas Swarm',
      'Hive Mind Portal',
      'Hive Mind Portal',
      'Guide Deck',
    ])
    expect(entries.at(-1)?.url).toBe('https://www.playgwent.com/decks/guides/405861')
  })
})

describe('normalizeUrl', () => {
  it('removes language segments and normalizes scheme and host', () => {
    // Arrange
    const urls = [
      'https://www.playgwent.com/ru/decks/369b',
      'http://www.playgwent.com/decks/369b',
      'https://playgwent.com/ru/decks/369b/',
      'https://www.playgwent.com/en/decks/guides/389873',
    ]

    // Act
    const normalized = urls.map(normalizeUrl)

    // Assert
    expect(normalized).toEqual([
      'https://www.playgwent.com/decks/369b',
      'https://www.playgwent.com/decks/369b',
      'https://www.playgwent.com/decks/369b',
      'https://www.playgwent.com/decks/guides/389873',
    ])
  })

  it('returns undefined for non-deck links', () => {
    // Arrange
    const urls = ['https://gwent.one/ru/card/131101', '', 'GWENT | гайд - YouTube']

    // Act
    const normalized = urls.map(normalizeUrl)

    // Assert
    expect(normalized).toEqual([undefined, undefined, undefined])
  })
})

describe('parseCsv', () => {
  it('handles quoted commas, doubled quotes, embedded newlines and CRLF', () => {
    // Arrange
    const csv = 'a,"b, c","say ""hi"""\r\n"multi\nline",,x'

    // Act
    const rows = parseCsv(csv)

    // Assert
    expect(rows).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['multi\nline', '', 'x'],
    ])
  })
})

describe('parseSheet', () => {
  it('keeps deck rows and skips header, faction and leader rows', () => {
    // Arrange
    const csv = [
      ',,,,',
      'Название колоды (и абилки),,Ссылка на колоду,Видео-гайд,',
      'Чудовища,,,,',
      'Панцирь (Защита),,https://gwent.one/ru/card/131101,,',
      ',Накер Реликты,https://www.playgwent.com/ru/decks/369b,"GWENT | гайд, 13.8 - YouTube",',
      ',Огроиды ,http://www.playgwent.com/ru/decks/guides/389873,,',
    ].join('\n')

    // Act
    const entries = parseSheet(csv)

    // Assert
    expect(entries).toEqual([
      { name: 'Накер Реликты', url: 'https://www.playgwent.com/decks/369b', lang: 'ru', source: 'metallic-danny' },
      { name: 'Огроиды', url: 'https://www.playgwent.com/decks/guides/389873', lang: 'ru', source: 'metallic-danny' },
    ])
  })

  it("reads meta report and patch tab layouts, dropping the meta report's leader", () => {
    // Arrange
    const csv = [
      'Лучшие колоды патча 14.4,,,Сложность:,Видео-гайды:',
      'Тир 1,,,,',
      ',Мидрейндж Органика (Стая главоглазов):,https://www.playgwent.com/ru/decks/a8d4,⭐⭐,https://youtu.be/x',
      'Накер Щиты,https://www.playgwent.com/ru/decks/be83',
    ].join('\n')

    // Act
    const entries = parseSheet(csv)

    // Assert
    expect(entries.map((e) => [e.name, e.url])).toEqual([
      ['Мидрейндж Органика', 'https://www.playgwent.com/decks/a8d4'],
      ['Накер Щиты', 'https://www.playgwent.com/decks/be83'],
    ])
  })
})

describe('parseSheetTabs', () => {
  it('reads tab names and gids from the htmlview page, decoding escapes', () => {
    // Arrange
    const html = `items.push({name: "Патч 14.10", pageUrl: "https:\\/\\/docs.google.com\\/x?gid=314", gid: "314",initialSheet: ("314" == gid)});
      items.push({name: "Shinmiri\\x27s 14.9", pageUrl: "https:\\/\\/docs.google.com\\/x?gid=99", gid: "99",initialSheet: ("99" == gid)});`

    // Act
    const tabs = parseSheetTabs(html)

    // Assert
    expect(tabs).toEqual([
      { name: 'Патч 14.10', gid: '314' },
      { name: "Shinmiri's 14.9", gid: '99' },
    ])
  })
})

describe('patch window', () => {
  it('reads the patch from a tab name', () => {
    // Arrange
    const names = ['Мета отчёт 14.4', 'v 9.5', '11.10.2', 'BC Sep26', 'Masters5']

    // Act
    const patches = names.map(tabPatch)

    // Assert
    expect(patches).toEqual([1404, 905, 1110, undefined, undefined])
  })

  it("maps a date to its month's patch (14.1 is January 2026)", () => {
    // Arrange
    const date = new Date('2026-04-14T12:00:00Z')

    // Act
    const patch = patchOf(date)

    // Assert
    expect(patch).toBe(1404)
  })

  it('keeps patch tabs from the window start on, without the main list or undated tabs', () => {
    // Arrange
    const tabs = [
      { name: '14.10', gid: '1' },
      { name: 'All Decks 14.10', gid: 'main' },
      { name: '14.4', gid: '2' },
      { name: '14.3', gid: '3' },
      { name: 'BC Sep26', gid: '4' },
    ]

    // Act
    const kept = recentTabs(tabs, 'main', new Date('2026-04-14T12:00:00Z'))

    // Assert
    expect(kept.map((t) => t.gid)).toEqual(['1', '2'])
  })
})

describe('parseGuideListing', () => {
  const guide = (over: object) => ({
    id: 1,
    name: ' Shupe Adda ',
    language: 'ko',
    modified: '2026-10-01T00:00:00+00:00',
    votes: 3,
    author: 'stellinka',
    hidden: false,
    published: true,
    invalid: false,
    ...over,
  })

  it('maps a listed guide to a community entry in its own language', () => {
    // Arrange
    const guides = [guide({})]

    // Act
    const entries = parseGuideListing(guides, '2026-04-13')

    // Assert
    expect(entries).toEqual([
      {
        name: 'Shupe Adda',
        url: 'https://www.playgwent.com/decks/guides/1',
        lang: 'ko',
        source: 'community',
        guide: { id: 1, modified: '2026-10-01T00:00:00+00:00', votes: 3, author: 'stellinka' },
      },
    ])
  })

  it('drops hidden, unpublished, invalid and out-of-window guides', () => {
    // Arrange
    const guides = [
      guide({ id: 2, hidden: true }),
      guide({ id: 3, published: false }),
      guide({ id: 4, invalid: true }),
      guide({ id: 5, modified: '2026-01-01T00:00:00+00:00' }),
      guide({ id: 6 }),
    ]

    // Act
    const entries = parseGuideListing(guides, '2026-04-13')

    // Assert
    expect(entries.map((e) => e.guide?.id)).toEqual([6])
  })
})

describe('monthsBefore', () => {
  it.each([
    ['2026-08-31T12:00:00Z', '2026-02-28T12:00:00.000Z'],
    ['2026-03-31T12:00:00Z', '2025-09-30T12:00:00.000Z'],
    ['2028-08-31T12:00:00Z', '2028-02-29T12:00:00.000Z'],
    ['2026-02-15T23:30:00Z', '2025-08-15T23:30:00.000Z'],
  ])('%s minus six months is %s', (from, expected) => {
    // Act
    const d = monthsBefore(new Date(from), 6)

    // Assert
    expect(d.toISOString()).toBe(expected)
  })
})
