import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config.ts'
import { cardChanges, type FilterState, facets, indexDecks } from '../filter.ts'
import en from '../i18n/en.json'
import { createTranslator, type Locale } from '../i18n.ts'
import type { Card, Dataset } from '../types.ts'
import { craftView } from '../ui/craft.ts'
import { filterRows } from '../ui/filters.ts'
import { makeLocale } from '../ui/locale.ts'
import { barsHtml } from '../ui/panel.ts'
import { deckRow } from '../ui/results.ts'

// Leaders 1 (MO) and 2 (NG); stratagem 10; cards 100–103, one with markup in its name.
const card = (name: string, type: Card['type'], faction: Card['faction'], provisions: number): Card => ({
  name,
  type,
  faction,
  provisions,
  scraps: 30,
  rarity: 'common',
})
const DATA: Dataset = {
  scrapedAt: '2026-10-20',
  cards: {
    1: card('Arachas Swarm', 'leader', 'MO', 15),
    2: card('Imperial Formation', 'leader', 'NG', 16),
    10: card('Enchanted Armor', 'stratagem', 'NE', 0),
    100: card('Golden Nekker', 'special', 'NE', 14),
    101: card('Chimera', 'unit', 'MO', 5),
    102: card('Royal Decree', 'special', 'NE', 9),
    103: card('<b>Cadaverine</b>', 'special', 'NG', 6),
  },
  tags: { deploy: 'Deploy' },
  decks: [
    {
      name: 'Swarm',
      id: 'a1',
      url: 'https://www.playgwent.com/decks/a1',
      stats: { scraps: 0, cards: 25, units: 13, provisions: 165 },
      sources: ['shinmiri2'],
      cards: [
        [1, 1],
        [10, 1],
        [100, 1],
        [101, 2],
      ],
    },
    {
      name: 'Swarm II',
      id: 'a2',
      url: 'https://www.playgwent.com/decks/a2',
      stats: { scraps: 0, cards: 25, units: 13, provisions: 165 },
      sources: ['shinmiri2'],
      cards: [
        [1, 1],
        [10, 1],
        [101, 1],
        [102, 1],
      ],
    },
  ],
}
const DECKS = indexDecks(DATA)
const loc: Locale = {
  lang: 'en',
  t: createTranslator('en', { en }),
  card: (id) => DATA.cards[id].name,
  tag: (key) => DATA.tags[key] ?? key,
  num: String,
  langName: makeLocale('en').langName,
  date: (iso) => iso,
  pg: (url) => url,
}
const state = (s: Partial<FilterState> = {}): FilterState => ({ factions: [], picks: [], ...s })
const context = (s: FilterState) => ({
  state: s,
  facets: facets(DECKS, s),
  data: DATA,
  loc,
  leaders: [1, 2],
  stratagems: [10],
  langs: [] as string[],
  pickName: (p: number | string) => (typeof p === 'number' ? loc.card(p) : loc.tag(p)),
})
const rows = (s: FilterState) =>
  filterRows({
    state: s,
    facets: facets(DECKS, s),
    data: DATA,
    loc,
    leaders: [1, 2],
    stratagems: [10],
    langs: [],
    pickName: (p) => (typeof p === 'number' ? loc.card(p) : loc.tag(p)),
  })

describe('filterRows', () => {
  it('presses the selected faction and marks options with no decks', () => {
    // Act
    const { factions } = rows(state({ factions: ['MO'] }))

    // Assert
    expect(factions).toContain('data-faction="MO" aria-pressed="true"')
    expect(factions).toMatch(/class="pill f-NR empty" data-faction="NR"/)
  })

  it('lists leaders only once a faction is picked, and names the selected one', () => {
    // Act
    const none = rows(state()).leader
    const picked = rows(state({ factions: ['MO'], leader: 1 })).leader

    // Assert
    expect(none).toContain('class="hint"')
    expect(picked).toContain('data-leader="1" aria-pressed="true"')
    expect(picked).not.toContain('data-leader="2"')
    expect(picked).toContain('<strong class="picked">Arachas Swarm</strong>')
  })

  it('names what the folded rows have set, in row order, and nothing for picks', () => {
    // Act
    const none = rows(state({ picks: [103] }))
    const some = rows(
      state({ factions: ['MO'], leader: 1, budgets: ['over1', 'exact'], video: true, langs: ['pt-BR'], picks: [103] }),
    )

    // Assert
    const text = (html: string) => html.replace(/<[^>]+>/g, '')
    expect(text(none.filtersToggle)).toBe('Filters')
    expect(text(none.opponentToggle)).toBe('')
    expect(text(some.filtersToggle)).toBe('Filters · Has video · PT · Exact · Over 1')
    expect(text(some.opponentToggle)).toBe('MO · Arachas Swarm')
  })

  it('draws an excluded pick pressed and a tag with its mark, escaping names', () => {
    // Act
    const { chips } = rows(state({ picks: [103, 'deploy'], excludes: [103] }))

    // Assert
    expect(chips).toContain('class="chip f-NG excluded"')
    expect(chips).toContain('data-flip="103" aria-pressed="true"')
    expect(chips).toContain('<span aria-hidden="true">#</span>Deploy')
    expect(chips).not.toContain('<b>')
  })

  it('draws a leader with art as its icon, named in its label, and one without as its name', () => {
    // Arrange: 122105 has art (src/art.ts); 1 doesn't
    const data: Dataset = { ...DATA, cards: { ...DATA.cards, 122105: card('Pincer Maneuver', 'leader', 'MO', 15) } }
    const s = state({ factions: ['MO'] })

    // Act
    const { leader } = filterRows({
      ...context(s),
      data,
      loc: { ...loc, card: (id) => data.cards[id].name },
      leaders: [1, 122105],
    })

    // Assert
    expect(leader).toMatch(
      /class="pill f-MO empty art"[^>]*aria-label="Pincer Maneuver \(0\)"><img src="icons\/l-122105\.webp"/,
    )
    expect(leader).toMatch(/data-leader="1"[^>]*>Arachas Swarm<span>2<\/span>/)
  })

  it('draws a pill per guide language, pressed when picked, labelled with its name', () => {
    // Act
    const { media } = filterRows({ ...context(state({ langs: ['ru'] })), langs: ['en', 'ru'] })

    // Assert
    expect(media).toContain('data-guide-lang="ru" aria-pressed="true" aria-label="Guide or video in Russian (0)"')
    expect(media).toContain('data-guide-lang="en" aria-pressed="false"')
  })

  it('with a stratagem picked, names it and counts the decks under the others', () => {
    // Arrange
    const s = state({ stratagem: 10 })
    const counts = {
      ...facets(DECKS, s),
      stratagems: new Map([
        [10, 2],
        [11, 3],
      ]),
    }

    // Act
    const { stratagemNote } = filterRows({ ...context(s), facets: counts })

    // Assert
    expect(stratagemNote).toMatch(/^<strong>Enchanted Armor<\/strong>/)
    expect(stratagemNote).toContain('3')
    expect(stratagemNote).toContain('data-any-stratagem="1"')
  })
})

describe('barsHtml', () => {
  it(`shows at most ${CONFIG.frequencyBars} bars, each sized by its share`, () => {
    // Arrange
    const many = Array.from({ length: CONFIG.frequencyBars + 5 }, (): [number, number] => [101, 1])

    // Act
    const html = barsHtml([[101, 1], ...many], 4, DATA, loc)

    // Assert
    expect(html.match(/<li /g)).toHaveLength(CONFIG.frequencyBars)
    expect(html).toContain('--pct:25%')
  })

  it("shows each card's crafting cost, and reads name, decks, rarity and cost in order", () => {
    // Arrange
    const data = {
      ...DATA,
      cards: { ...DATA.cards, 100: { ...DATA.cards[100], scraps: 800, rarity: 'legendary' as const } },
    }

    // Act
    const html = barsHtml([[100, 3]], 4, data, loc)

    // Assert
    expect(html).toMatch(/class="bar-cost"><img [^>]*alt="" \/>800</)
    expect(html).toContain('aria-label="Golden Nekker, in 3 of 4 decks. Legendary · 800 scraps to craft"')
  })

  it('says so when there are no cards', () => {
    // Act
    const html = barsHtml([], 0, DATA, loc)

    // Assert
    expect(html).toContain('class="none"')
  })
})

describe('deckRow', () => {
  const [a1, a2] = DECKS
  /** The decklist row naming this card. */
  const line = (html: string, name: string) => html.split('<li ').find((li) => li.includes(`>${name}</a>`)) ?? ''
  const open = (opts: { selected?: number[]; common?: number[]; changes?: boolean }) =>
    deckRow(
      a2,
      DATA,
      new Set(opts.selected),
      true,
      new Set(opts.common),
      loc,
      undefined,
      opts.changes ? cardChanges(a1, a2) : undefined,
    )

  it('lists leader and stratagem first, then highlights selected and dims common cards', () => {
    // Act
    const html = open({ selected: [102], common: [101] })

    // Assert
    expect(html.indexOf('Arachas Swarm')).toBeLessThan(html.indexOf('Enchanted Armor'))
    expect(line(html, 'Royal Decree')).toMatch(/^class="hit "/)
    expect(line(html, 'Chimera')).toMatch(/^class="common"/)
    expect(line(html, 'Enchanted Armor')).toMatch(/^class=""/)
  })

  it('compared with a reference deck, marks what it added and lists what it swapped out', () => {
    // Act
    const html = open({ changes: true })

    // Assert
    expect(line(html, 'Royal Decree')).toContain('<span class="added"')
    expect(line(html, 'Chimera')).not.toContain('class="added"')
    expect(html).toMatch(/class="swapped">Swapped out: Golden Nekker, Chimera <span class="copies">−1<\/span>/)
  })

  it('with Any, says how many of the picks a deck has, short on screen and in full for screen readers', () => {
    // Act
    const html = deckRow(a1, DATA, new Set(), false, new Set(), loc, undefined, undefined, false, { n: 2, of: 3 })

    // Assert
    expect(html).toContain('<span aria-hidden="true">2/3</span>')
    expect(html).toContain('<span class="sr-only">Has 2 of the 3 cards, tags and authors you searched for</span>')
    expect(deckRow(a1, DATA, new Set(), false, new Set(), loc)).not.toContain('sr-only">Has')
  })

  it('closed: an arrow and tooltip say it opens, with no deck ID and no 25-card stat', () => {
    // Act
    const html = deckRow(a1, DATA, new Set(), false, new Set(), loc)

    // Assert
    expect(html).toContain('aria-expanded="false" title="Show the cards"')
    expect(html).toContain('<span class="chev" aria-hidden="true"><svg class="icon"')
    expect(html).not.toContain('deck-id')
    expect(html).not.toContain('icons/cards.png')
  })

  it('open: the deck ID moves to a footer, and a deck of other than 25 cards says so', () => {
    // Arrange
    const big = { ...a1, deck: { ...a1.deck, stats: { ...a1.deck.stats, cards: 26 } } }

    // Act
    const html = deckRow(big, DATA, new Set(), true, new Set(), loc)

    // Assert
    expect(html).toContain('title="Hide the cards"')
    expect(html).toMatch(/class="deck-foot"><code class="deck-id"[^>]*>a1</)
    expect(html).toMatch(/icons\/cards\.png[\s\S]*26/)
  })

  it('presses ⧉ only on the deck the search shows alone, naming the deck for screen readers', () => {
    // Act
    const [off, on] = [false, true].map((only) =>
      deckRow(a1, DATA, new Set(), false, new Set(), loc, undefined, undefined, only),
    )

    // Assert
    expect(off).toContain(
      `data-select="${a1.list}" aria-pressed="false" title="Show only this deck" aria-label="Show only Swarm"`,
    )
    expect(on).toContain('aria-pressed="true" title="Showing only this deck; press again to show the others"')
  })

  it.each([
    [160, 'badge spare', '5 spare'],
    [170, 'badge over', '+5 over'],
  ])('a deck using %i of 165 provisions gets a %s badge', (provisions, cls, text) => {
    // Arrange
    const deck = { ...a1, deck: { ...a1.deck, stats: { ...a1.deck.stats, provisions } } }

    // Act
    const html = deckRow(deck, DATA, new Set(), false, new Set(), loc)

    // Assert
    expect(html).toContain(`<span class="${cls}" title="160 used / 165 limit`.replace('160', String(provisions)))
    expect(html).toContain(`>${text}</span>`)
  })

  it('shows a guide with no video by its language, named in the tooltip, and falls back to the code for an unknown one', () => {
    // Arrange
    const guide = (guideLang: string) => ({ ...a1, deck: { ...a1.deck, guideLang } })

    // Act
    const [known, unknown] = ['ru', 'not a language!'].map((l) =>
      deckRow(guide(l), DATA, new Set(), false, new Set(), loc),
    )

    // Assert
    expect(known).toContain('<span class="lang" title="Guide written in Russian">RU</span>')
    expect(unknown).toContain('title="Guide written in not a language!"')
  })

  it("shows a guide's votes, author and update date, and a Similar list's cards in common", () => {
    // Arrange
    const deck = { ...a1, deck: { ...a1.deck, votes: 7, author: 'Avajar', updated: '2026-10-01' } }

    // Act
    const html = deckRow(deck, DATA, new Set(), false, new Set(), loc, { n: 2, of: 3, self: false })

    // Assert
    expect(html).toContain('</svg> 7 · Avajar')
    expect(html).toContain('<time class="updated" datetime="2026-10-01"')
    expect(html).toContain('<span class="badge shared">2/3 cards in common</span>')
  })

  it.each([
    ['en', 'en', '', '\nGuide written in English'],
    ['ru', 'en', '<span class="lang" title="Guide written in Russian">RU</span>', ''],
    [undefined, 'en', '', ''],
  ])('a guide in %s with a video in %s shows the badges it needs', (guideLang, videoLang, guideBadge, tipExtra) => {
    // Arrange
    const deck = {
      ...a1,
      deck: { ...a1.deck, guideLang, video: { url: 'https://youtu.be/AAAAAAAAAAA', lang: videoLang } },
    }

    // Act
    const html = deckRow(deck, DATA, new Set(), false, new Set(), loc)

    // Assert
    expect(html.includes('class="lang"')).toBe(guideBadge !== '')
    if (guideBadge) expect(html).toContain(guideBadge)
    expect(html).toContain(`title="Watch gameplay (English)${tipExtra}"`)
  })

  it("uses the author's own deck name when it's in the visitor's language", () => {
    // Arrange
    const deck = { ...a1, deck: { ...a1.deck, original: { name: 'Рой', lang: 'en' } } }

    // Act
    const html = deckRow(deck, DATA, new Set(), false, new Set(), loc)

    // Assert
    expect(html).toContain('Рой</span>')
  })

  it("marks the Similar list's own deck as This deck", () => {
    // Act
    const html = deckRow(a1, DATA, new Set(), false, new Set(), loc, { n: 3, of: 3, self: true })

    // Assert
    expect(html).toContain('<span class="badge shared">This deck</span>')
  })

  it('compared with a reference deck, marks one extra copy +1 and an added card +', () => {
    // Act: a1 runs Chimera ×2 where a2 runs one, and Golden Nekker, which a2 doesn't
    const html = deckRow(a1, DATA, new Set(), true, new Set(), loc, undefined, cardChanges(a2, a1))

    // Assert
    expect(line(html, 'Chimera')).toContain('>+1</span>')
    expect(line(html, 'Golden Nekker')).toContain('>+</span>')
  })

  it('renders no card list when collapsed', () => {
    // Act
    const html = deckRow(a1, DATA, new Set(), false, new Set(), loc)

    // Assert
    expect(html).not.toContain('class="decklist"')
  })
})

describe('craftView', () => {
  // Costs 800, 200 (×2 = 400) and 30, so running totals 800, 1,200, 1,230.
  const data = {
    ...DATA,
    cards: {
      ...DATA.cards,
      100: { ...DATA.cards[100], scraps: 800 },
      101: { ...DATA.cards[101], scraps: 200 },
      102: { ...DATA.cards[102], scraps: 30 },
    },
  }
  const rows = [
    { id: 100, decks: 3, copies: 1 as const },
    { id: 101, decks: 2, copies: 2 as const },
    { id: 102, decks: 1, copies: 1 as const },
  ]
  const draw = (opts: { scraps?: number; have?: number[]; limit?: number }) =>
    craftView({ rows, total: 4, limit: opts.limit ?? 50, have: new Set(opts.have), scraps: opts.scraps, data, loc })
  /** Running totals in row order, and where the scraps line falls (before which card). */
  const read = (body: string) => ({
    totals: [...body.matchAll(/class="total">([^<]+)</g)].map((m) => m[1]),
    lineBefore: /class="reach"[\s\S]*?data-craft-pick="(\d+)"/.exec(body)?.[1],
  })

  it('runs a total of the cards not ticked, counting copies, and puts the line before the first the scraps miss', () => {
    // Act
    const { body, summary } = draw({ scraps: 1000 })

    // Assert
    expect(read(body)).toEqual({ totals: ['800', '1200', '1230'], lineBefore: '101' })
    expect(body).toContain('2 × 200')
    expect(summary).toBe("Enough for the first card you don't have: 800 scraps, 200 left.")
  })

  it('leaves a ticked card in place but out of the total, so the scraps reach further', () => {
    // Act
    const { body, summary } = draw({ scraps: 1000, have: [100] })

    // Assert
    expect(read(body)).toEqual({ totals: ['—', '400', '430'], lineBefore: undefined })
    expect(body).toMatch(/<tr class="f-NE have">/)
    expect(summary).toBe("Enough for the first 2 cards you don't have: 430 scraps, 570 left.")
  })

  it('says so when the scraps miss the first card, and draws no line or summary without a number', () => {
    // Act
    const short = draw({ scraps: 100 })
    const none = draw({})

    // Assert
    expect(read(short.body).lineBefore).toBe('100')
    expect(short.summary).toBe("Not enough for the first card you don't have (800 scraps).")
    expect(none.body).not.toContain('class="reach"')
    expect(none.summary).toBe('')
  })

  it('gives each card its share of the matching decks', () => {
    // Act
    const { body } = draw({})

    // Assert
    expect(body).toContain('class="share" title="In 3 of 4 matching decks">75%<span class="share-of">3</span>')
  })

  it('draws one page, then Show more', () => {
    // Act
    const { body } = draw({ limit: 2 })

    // Assert
    expect(body.match(/data-craft-pick=/g)).toHaveLength(2)
    expect(body).toContain('Show 1 more card')
  })
})
