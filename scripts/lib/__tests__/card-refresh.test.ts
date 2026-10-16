import { describe, expect, it } from 'vitest'
import { fetchCardData, provisionChanges } from '../card-refresh.ts'
import type { CatalogCard } from '../store.ts'

const KEYS = [
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => `faction_name_${i}`),
  'filter_faction',
  'filter_type_25',
  'tooltip_title_provision',
  'tooltip_title_scraps',
  'tooltip_title_cards',
  'tooltip_title_units',
]
const builder = `<div data-translations='${JSON.stringify(Object.fromEntries(KEYS.map((k) => [k, k]))).replaceAll('"', '&quot;')}'></div>`
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
    translations: Object.fromEntries(Object.entries(names).map(([l, name]) => [l, { name }])),
  },
})

describe('fetchCardData', () => {
  it('reads the English catalog with leaders, and names and terms per language', async () => {
    // Arrange
    const requested: string[] = []
    const get = async (url: string) => {
      requested.push(url)
      if (!url.includes('/api/search')) return builder
      const lang = url.split('/')[3]
      const leaders = url.includes('type=1')
      return JSON.stringify([leaders ? hit(1, 1, { [lang]: `L-${lang}` }) : hit(2, 4, { [lang]: `U-${lang}` })])
    }

    // Act
    const data = await fetchCardData(get)

    // Assert
    expect(requested).toHaveLength(2 + 10 * 3)
    expect(Object.keys(data.cards)).toEqual(['1', '2'])
    expect(data.cards[1]).toMatchObject({ name: 'L-en', type: 'leader', craftingCost: 30 })
    expect(data.cardNames.ru).toEqual({ 1: 'L-ru', 2: 'U-ru' })
    expect(data.terms.ja['faction.MO']).toBe('faction_name_1')
  })
})

describe('provisionChanges', () => {
  it('lists changed, new and removed cards', () => {
    // Arrange
    const card = (name: string, provisions: number) =>
      ({ name, type: 'unit', faction: 'MO', provisions, craftingCost: 0, rarity: 1 }) as CatalogCard
    const before = { 1: card('Ciri', 10), 2: card('Same', 4), 3: card('Gone', 5) }
    const after = { 1: card('Ciri', 9), 2: card('Same', 4), 4: card('New', 6) }

    // Act
    const lines = provisionChanges(before, after)

    // Assert
    expect(lines).toEqual(['Ciri: 10 → 9', 'New: new (6)', 'Gone: removed'])
  })
})
