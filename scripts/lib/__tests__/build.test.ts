import { describe, expect, it } from 'vitest'
import { type BuildInput, buildDataset, DEFAULT_STRATAGEM } from '../build.ts'
import type { DeckEntry } from '../sources.ts'
import type { CatalogCard } from '../store.ts'

const card = (c: Partial<CatalogCard> & Pick<CatalogCard, 'name' | 'type'>): CatalogCard => ({
  faction: 'NE',
  provisions: 0,
  craftingCost: 0,
  rarity: 1,
  ...c,
})
const CARDS: Record<number, CatalogCard> = {
  1: card({ name: 'Arachas Swarm', type: 'leader', faction: 'MO', provisions: 15, craftingCost: 0 }),
  10: card({ name: 'Enchanted Armor', type: 'stratagem' }),
  [DEFAULT_STRATAGEM]: card({ name: 'Tactical Advantage', type: 'stratagem' }),
  100: card({ name: 'Chimera', type: 'unit', faction: 'MO', provisions: 10, craftingCost: 800, power: 5 }),
  101: card({ name: 'Golden Nekker', type: 'special', provisions: 14, craftingCost: 800 }),
}
const URL_A = 'https://www.playgwent.com/decks/aaaa'
const URL_B = 'https://www.playgwent.com/decks/bbbb'
const entry = (url: string, e: Partial<DeckEntry> = {}): DeckEntry => ({
  name: 'Swarm',
  url,
  lang: 'en',
  source: 'shinmiri2',
  ...e,
})
const DECK = {
  hash: 'h1',
  modified: '2026-09-30',
  guideModified: '2026-10-01',
  cards: [
    [1, 1],
    [10, 1],
    [100, 2],
    [101, 1],
  ] as [number, number][],
}
const input = (i: Partial<BuildInput> = {}): BuildInput => ({
  entries: [entry(URL_A)],
  store: { [URL_A]: DECK },
  cards: CARDS,
  cardNames: {},
  terms: {},
  categories: {},
  translations: {},
  scrapedAt: '2026-10-14T00:00:00.000Z',
  ...i,
})

describe('buildDataset', () => {
  it('computes stats from the card table', () => {
    // Act
    const { dataset, errors } = buildDataset(input())

    // Assert
    expect(errors).toEqual([])
    expect(dataset.decks[0].stats).toEqual({ scraps: 2400, cards: 3, units: 2, provisions: 34 })
    expect(dataset.decks[0].updated).toBe('2026-10-01')
  })

  it('inserts the default stratagem after the leader when the deck lists none', () => {
    // Arrange
    const store = {
      [URL_A]: {
        ...DECK,
        cards: [
          [1, 1],
          [100, 2],
        ] as [number, number][],
      },
    }

    // Act
    const { dataset } = buildDataset(input({ store }))

    // Assert
    expect(dataset.decks[0].cards).toEqual([
      [1, 1],
      [DEFAULT_STRATAGEM, 1],
      [100, 2],
    ])
    expect(Object.keys(dataset.cards).map(Number)).toContain(DEFAULT_STRATAGEM)
  })

  it('lists a deck once per hash, named by the first entry, with every source', () => {
    // Arrange
    const entries = [
      entry(URL_A, { name: 'First', source: 'shinmiri2' }),
      entry(URL_B, { name: 'Second', source: 'metallic-danny', lang: 'ru' }),
      entry(URL_A, { name: 'Again', source: 'community' }),
    ]

    // Act
    const { dataset } = buildDataset(input({ entries, store: { [URL_A]: DECK, [URL_B]: DECK } }))

    // Assert
    expect(dataset.decks.map((d) => [d.name, d.sources])).toEqual([
      ['First', ['community', 'metallic-danny', 'shinmiri2']],
    ])
  })

  it('skips decks with unknown cards, and unfetched or dead links, with warnings', () => {
    // Arrange
    const entries = [entry(URL_A), entry(URL_B), entry('https://www.playgwent.com/decks/cccc')]
    const store = {
      [URL_A]: { ...DECK, cards: [...DECK.cards, [999, 1]] as [number, number][] },
      [URL_B]: { missing: true as const },
    }

    // Act
    const { dataset, warnings, errors } = buildDataset(input({ entries, store }))

    // Assert
    expect(dataset.decks).toEqual([])
    expect(errors).toEqual([])
    expect(warnings.slice(0, 3)).toEqual([
      expect.stringContaining('unknown cards 999'),
      expect.stringContaining('not found'),
      expect.stringContaining('not fetched'),
    ])
  })

  it('reports a deck without a leader as an error', () => {
    // Arrange
    const store = {
      [URL_A]: {
        ...DECK,
        cards: [
          [10, 1],
          [100, 2],
        ] as [number, number][],
      },
    }

    // Act
    const { errors } = buildDataset(input({ store }))

    // Assert
    expect(errors).toEqual([expect.stringContaining('not exactly one leader/stratagem')])
  })

  it('names non-English decks from translations, else the glossary, and treats Cyrillic English names as Russian', () => {
    // Arrange
    const entries = [entry(URL_A, { name: 'Рой', lang: 'en' }), entry(URL_B, { name: 'Химера колода', lang: 'ru' })]
    const store = { [URL_A]: DECK, [URL_B]: { ...DECK, hash: 'h2' } }
    const cardNames = { ru: { 100: 'Химера' } }
    const translations = { ru: { Рой: 'Swarm' } }

    // Act
    const { dataset } = buildDataset(input({ entries, store, cardNames, translations }))

    // Assert
    expect(dataset.decks.map((d) => [d.name, d.original])).toEqual([
      ['Swarm', { lang: 'ru', name: 'Рой' }],
      ['Chimera колода', { lang: 'ru', name: 'Химера колода' }],
    ])
  })

  it('writes language packs for the cards in use, falling back to English', () => {
    // Arrange
    const cardNames = { ru: { 100: 'Химера', 555: 'Не в колоде' } }

    // Act
    const { packs } = buildDataset(input({ cardNames }))

    // Assert
    const cards = JSON.parse(packs.ru.slice(packs.ru.indexOf('] = ') + 4)).cards
    expect(cards).toEqual({ 1: 'Arachas Swarm', 10: 'Enchanted Armor', 100: 'Химера', 101: 'Golden Nekker' })
  })

  it('keeps only app fields on dataset cards', () => {
    // Act
    const { dataset } = buildDataset(input())

    // Assert
    expect(dataset.cards[100]).toEqual({ name: 'Chimera', type: 'unit', faction: 'MO', provisions: 10, power: 5 })
  })

  it('names a guide published without a name after its leader', () => {
    // Arrange
    const entries = [entry(URL_A, { name: '', lang: 'fr' })]

    // Act
    const { dataset } = buildDataset(input({ entries }))

    // Assert
    expect(dataset.decks[0].name).toBe('Arachas Swarm')
    expect(dataset.decks[0]).not.toHaveProperty('original')
  })
})
