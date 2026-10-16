import type { CardType, Faction } from '../../src/types.ts'

/** A card as it appears in playgwent's deck JSON (only the fields used). */
export interface PgCard {
  id: number
  /** Always English, even on localized pages. */
  name: string
  localizedName?: string
  categoryName?: string | null
  secondaryFactions?: { value: number }[]
  type: CardType
  provisionsCost: number
  faction: { short: string }
}

/** The deck object in playgwent's `data-state` JSON (only the fields used). */
export interface PgDeck {
  hash: string
  srcCardTemplates: number[]
  craftingCost: number
  provisionsCost: number
  cardsCount: number
  unitsCount: number
  modified: string
  leader: PgCard
  stratagem: PgCard
  cards: PgCard[]
}

// playgwent's secondaryFactions enum, verified against gwent.one's faction-duo attribute (2026-10-13).
const SECONDARY_CODES: Record<number, Faction> = { 1: 'MO', 2: 'NG', 3: 'NR', 4: 'ST', 5: 'SK' }

/**
 * Maps a playgwent `secondaryFactions` entry to a faction.
 *
 * @param code - Enum value
 * @returns The faction
 * @throws {Error} For an unverified code, so a new dual faction surfaces instead of being dropped
 */
export function toSecondaryFaction(code: number): Faction {
  const faction = SECONDARY_CODES[code]
  if (!faction) throw new Error(`Unknown secondary faction code ${code}`)
  return faction
}

/**
 * Decodes the HTML entities playgwent uses inside attribute values.
 *
 * @param text - Raw attribute text
 * @returns Decoded text
 */
export function decodeEntities(text: string): string {
  const named: Record<string, string> = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", nbsp: '\u00a0' }
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, ent: string) => {
    if (ent[0] !== '#') return named[ent.toLowerCase()] ?? match
    const code = ent[1] === 'x' || ent[1] === 'X' ? Number.parseInt(ent.slice(2), 16) : Number(ent.slice(1))
    // Past the last Unicode code point (or Infinity), fromCodePoint would throw; keep the text as is.
    return code > 0x10ffff ? match : String.fromCodePoint(code)
  })
}

/**
 * Extracts the deck from a playgwent deck or guide page.
 *
 * Both page kinds carry the deck as HTML-escaped JSON in a `data-state` attribute; guides nest it
 * under `guide.deck`.
 *
 * @param html - Page HTML
 * @returns The deck object
 * @throws {Error} If the attribute or deck is missing
 */
export function extractDeck(html: string): PgDeck {
  const raw = html.match(/data-state='([^']*)'/)?.[1] ?? html.match(/data-state="([^"]*)"/)?.[1]
  if (!raw) throw new Error('No data-state attribute')
  const state = JSON.parse(decodeEntities(raw))
  return normalizeDeck(state.deck ?? state.guide?.deck)
}

/**
 * Validates a deck object from playgwent (page `data-state` or the guide API).
 *
 * @param deck - Raw deck object
 * @returns The deck with `srcCardTemplates` as an array
 * @throws {Error} If the object isn't a deck
 */
export function normalizeDeck(deck: PgDeck | undefined): PgDeck {
  if (!deck?.leader || typeof deck.srcCardTemplates !== 'object') throw new Error('data-state has no deck')
  // Some decks serialize the list as a sparse object ({"0":…,"2":…}) instead of an array.
  return { ...deck, srcCardTemplates: Object.values(deck.srcCardTemplates) }
}

/**
 * Counts copies per card ID.
 *
 * @param ids - `srcCardTemplates`, where each copy repeats its ID
 * @returns `[cardId, copies]` pairs in first-seen order
 */
export function countCopies(ids: number[]): [number, number][] {
  const counts = new Map<number, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts]
}
