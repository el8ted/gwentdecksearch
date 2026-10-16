import { decodeEntities } from './extract.ts'

/** playgwent deck-builder translation keys → this site's phrase keys, for official Gwent terms. */
const OFFICIAL_TERMS: Record<string, string> = {
  faction_name_0: 'faction.NE',
  faction_name_1: 'faction.MO',
  faction_name_2: 'faction.NG',
  faction_name_3: 'faction.NR',
  faction_name_4: 'faction.ST',
  faction_name_5: 'faction.SK',
  faction_name_6: 'faction.SY',
  filter_faction: 'filter.faction',
  filter_type_25: 'filter.stratagem',
  tooltip_title_provision: 'filter.provisions',
  tooltip_title_scraps: 'stat.scraps',
  tooltip_title_cards: 'stat.cards',
  tooltip_title_units: 'stat.units',
}

/** This site's term keys, in the order language packs list them. */
export const TERM_KEYS = Object.values(OFFICIAL_TERMS)

/**
 * Reads official Gwent terms from a localized playgwent deck-builder page.
 *
 * @param html - `https://www.playgwent.com/{lang}/decks/builder` HTML
 * @returns Terms keyed by this site's phrase keys
 * @throws {Error} If the translations attribute or any expected term is missing, so a site change surfaces
 */
export function extractTerms(html: string): Record<string, string> {
  const raw = html.match(/data-translations='([^']*)'/)?.[1]
  if (!raw) throw new Error('No data-translations attribute on playgwent deck builder')
  const all: Record<string, unknown> = JSON.parse(decodeEntities(raw))
  const terms: Record<string, string> = {}
  for (const [source, key] of Object.entries(OFFICIAL_TERMS)) {
    const value = all[source]
    if (typeof value !== 'string' || !value.trim()) throw new Error(`playgwent translation "${source}" missing`)
    terms[key] = value.trim()
  }
  return terms
}
