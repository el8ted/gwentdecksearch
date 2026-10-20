import type { CardType, Faction, Rarity } from '../../src/types.ts'
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
    /** Category IDs (Beast, Spell…); names come from the builder page (see `extractTagNames`). */
    category_names: number[]
    /** Every ability the card text names, as slugs. */
    keywords: string[]
    /** `tooltip` marks abilities up as `<keyword=slug>text</keyword>`. */
    translations: Record<string, { name: string; tooltip?: string }>
  }
}

// Numeric codes in the search API, verified one-to-one against deck-page JSON on 2026-10-13.
const TYPES: Record<number, CardType> = { 1: 'leader', 2: 'special', 4: 'unit', 8: 'artifact', 16: 'stratagem' }
const FACTIONS: Record<number, Faction> = { 0: 'NE', 1: 'MO', 2: 'NG', 3: 'NR', 4: 'ST', 5: 'SK', 6: 'SY' }
// Crafting costs 30, 80, 200 and 800 scraps (checked 2026-10-20).
const RARITIES: Record<number, Rarity> = { 5: 'common', 15: 'rare', 20: 'epic', 25: 'legendary' }

/**
 * A card's rarity from playgwent's code.
 *
 * @param code - The search API's `rarity`, as stored in the card catalog
 * @param id - The card, for the error
 * @returns Its rarity
 * @throws {Error} For an unknown code, so an API change can't mislabel cards
 */
export function rarityOf(code: number, id: number): Rarity {
  const rarity = RARITIES[code]
  if (!rarity) throw new Error(`Unknown rarity code ${code} (card ${id})`)
  return rarity
}

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
    const tags = [...new Set([...c.category_names.map((id) => `c${id}`), ...c.keywords])]
    if (tags.length) card.tags = tags
    cards.set(c.id, card)
  }
  return cards
}

/**
 * Ability names as a language's card text writes them, for a builder page that leaves them blank (zh-cn).
 *
 * The text inflects them (Order/Orders, 部署/部署：), so each slug takes its most common wording, end punctuation
 * trimmed.
 *
 * @param hits - Search results requested under a language prefix
 * @param lang - That prefix
 * @returns Names keyed by ability slug
 */
export function abilityNamesFromText(hits: SearchHit[], lang: string): Record<string, string> {
  const counts = new Map<string, Map<string, number>>()
  for (const { _source: c } of hits) {
    for (const [, slug, raw] of (c.translations[lang]?.tooltip ?? '').matchAll(/<keyword=(\w+)>([^<]*)<\/keyword>/g)) {
      const text = raw.replace(/[\s:：.。]+$/u, '').trim()
      if (!text) continue
      const forms = counts.get(slug) ?? new Map<string, number>()
      counts.set(slug, forms.set(text, (forms.get(text) ?? 0) + 1))
    }
  }
  return Object.fromEntries(
    [...counts].map(([slug, forms]) => [
      slug,
      [...forms].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
    ]),
  )
}
