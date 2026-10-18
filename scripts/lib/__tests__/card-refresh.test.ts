import { describe, expect, it } from 'vitest'
import { fetchCardData } from '../card-refresh.ts'

const KEYS = [
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => `faction_name_${i}`),
  'filter_faction',
  'filter_type_25',
  'filters_tags',
  'tooltip_title_provision',
  'tooltip_title_scraps',
  'tooltip_title_cards',
  'tooltip_title_units',
]
const attr = (value: unknown) => JSON.stringify(value).replaceAll('"', '&quot;')
const builder = (lang: string) =>
  `<div data-translations='${attr(Object.fromEntries(KEYS.map((k) => [k, k])))}' data-state='${attr({ keywords: { 12: `Beast-${lang}` }, categories: { order: lang === 'zh-cn' ? '' : `Order-${lang}` } })}'></div>`
const hit = (id: number, type: number, names: Record<string, string>) => ({
  _source: {
    id,
    type,
    faction: 1,
    secondary_factions: [],
    provisions_cost: 5,
    crafting_cost: 30,
    rarity: 1,
    power: 3,
    category_names: [12],
    keywords: ['order'],
    translations: Object.fromEntries(
      Object.entries(names).map(([l, name]) => [l, { name, tooltip: `<keyword=order>${l}-ord：</keyword>` }]),
    ),
  },
})

describe('fetchCardData', () => {
  it('reads the English catalog with leaders, and names and terms per language', async () => {
    // Arrange
    const requested: string[] = []
    const get = async (url: string) => {
      requested.push(url)
      if (!url.includes('/api/search')) return builder(url.split('/')[3])
      const lang = url.split('/')[3]
      const leaders = url.includes('type=1')
      return JSON.stringify([leaders ? hit(1, 1, { [lang]: `L-${lang}` }) : hit(2, 4, { [lang]: `U-${lang}` })])
    }

    // Act
    const data = await fetchCardData(get)

    // Assert
    expect(requested).toHaveLength(3 + 10 * 3)
    expect(Object.keys(data.cards)).toEqual(['1', '2'])
    expect(data.cards[1]).toMatchObject({ name: 'L-en', type: 'leader', craftingCost: 30 })
    expect(data.cardNames.ru).toEqual({ 1: 'L-ru', 2: 'U-ru' })
    expect(data.terms.ja['faction.MO']).toBe('faction_name_1')
    expect(data.cards[2].tags).toEqual(['c12', 'order'])
    expect(data.tags.en).toEqual({ c12: 'Beast-en', order: 'Order-en' })
    // zh-cn's builder leaves ability names blank: they come from its card text instead.
    expect(data.tags['zh-cn']).toEqual({ c12: 'Beast-zh-cn', order: 'zh-cn-ord' })
  })
})
