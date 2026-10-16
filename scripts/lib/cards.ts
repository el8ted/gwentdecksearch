import type { CardType, Faction } from '../../src/types.ts'
import { toSecondaryFaction } from './extract.ts'
import type { CatalogCard } from './store.ts'

/** One hit from playgwent's deck-builder card search (`/{lang}/decks/builder/api/search`), fields used. */
export interface SearchHit {
  _source: {
    id: number
    type: number
    faction: number
    secondary_factions: number[]
    provisions_cost: number
    crafting_cost: number
    rarity: number
    power: number
    translations: Record<string, { name: string }>
  }
}

// Numeric codes in the search API, verified one-to-one against deck-page JSON on 2026-10-13.
const TYPES: Record<number, CardType> = { 1: 'leader', 2: 'special', 4: 'unit', 8: 'artifact', 16: 'stratagem' }
const FACTIONS: Record<number, Faction> = { 0: 'NE', 1: 'MO', 2: 'NG', 3: 'NR', 4: 'ST', 5: 'SK', 6: 'SY' }

/**
 * Reads card names from a localized card search.
 *
 * @param hits - Search results requested under a language prefix (e.g. `/ru/decks/builder/api/search`)
 * @param lang - That prefix; `translations` is keyed by it (checked 2026-10-15 for all ten languages)
 * @returns Names keyed by card ID
 */
export function parseLocalizedNames(hits: SearchHit[], lang: string): Map<number, string> {
  const names = new Map<number, string>()
  for (const { _source: c } of hits) {
    const name = c.translations[lang]?.name
    if (name) names.set(c.id, name)
  }
  return names
}

/**
 * Builds the card table from playgwent's deck-builder search results.
 *
 * This is the current game data: display names (the deck pages' `name` field is an internal name with
 * typos, e.g. "Doulbe Cross"), current provision costs and, for leaders, the bonus added to the 150 limit.
 *
 * @param hits - Search results; the default search omits leaders, so pass a `type=1` search as well
 * @returns Cards keyed by ID
 * @throws {Error} For an unknown type or faction code, so an API change can't mislabel cards
 */
export function parseCardSearch(hits: SearchHit[]): Map<number, CatalogCard> {
  const cards = new Map<number, CatalogCard>()
  for (const { _source: c } of hits) {
    const type = TYPES[c.type]
    const faction = FACTIONS[c.faction]
    if (!type) throw new Error(`Unknown card type code ${c.type} (card ${c.id})`)
    if (!faction) throw new Error(`Unknown faction code ${c.faction} (card ${c.id})`)
    const name = c.translations.en?.name
    if (!name) throw new Error(`Card ${c.id} has no English name`)
    const card: CatalogCard = {
      name,
      type,
      faction,
      provisions: c.provisions_cost,
      craftingCost: c.crafting_cost,
      rarity: c.rarity,
    }
    if (type === 'unit') card.power = c.power
    if (c.secondary_factions[0]) card.secondaryFaction = toSecondaryFaction(c.secondary_factions[0])
    cards.set(c.id, card)
  }
  return cards
}
