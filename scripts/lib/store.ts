import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Card } from '../../src/types.ts'
import type { GuideInfo } from './guide.ts'

/**
 * Card catalog entry, with crafting cost and rarity as playgwent gives them; the build maps them to the app's
 * {@link Card} `scraps` and `rarity` (see `rarityOf`).
 */
export interface CatalogCard extends Omit<Card, 'scraps' | 'rarity'> {
  craftingCost: number
  /** playgwent's rarity code: 5, 15, 20 or 25. */
  rarity: number
}

/**
 * One stored deck, keyed by normalized URL. `cards` is `[cardId, copies]` exactly as fetched (the build adds the
 * default stratagem). `modified` is the deck's own date (shown as `Deck.modified`); `guideModified` is the guide
 * listing's date (the guide API's own date can lag behind it), so an edited guide can be detected. `guide` measures a
 * guide's text (see `guideInfo`). A dead link is `missing`.
 */
export type StoredDeck =
  | { hash: string; cards: [number, number][]; modified: string; guideModified?: string; guide?: GuideInfo }
  | { missing: true }

/** The committed stores the refreshes write and the build reads. */
export const STORE_PATHS = {
  cards: 'data/source/cards.json',
  cardNames: 'data/source/card-names.json',
  terms: 'data/source/terms.json',
  /** Per language: tag key → name (see `extractTagNames`). */
  tags: 'data/source/tags.json',
  categories: 'data/source/categories.json',
  entries: 'data/source/entries.json',
  decks: 'data/source/deck-store.json',
  translations: 'data/source/translations.json',
  /** Creators: their Gwent names and channels (hand-kept; `pnpm creators` adds guide authors' channels). */
  creators: 'data/source/creators.json',
  /** YouTube uploads that link a deck, by channel ID, then video ID (see `refreshChannel`). */
  videos: 'data/source/videos.json',
  /** Guide text by URL: local only (gitignored), for tuning guide measures without refetching. */
  guideText: 'data/cache/guide-text.json',
  /** When each refresh last ran: `{ cards, decks }` as ISO times; the page's data date is the newer. */
  refreshed: 'data/source/refreshed.json',
} as const

/**
 * Records that a refresh ran now.
 *
 * @param kind - Which refresh
 */
export async function markRefreshed(kind: 'cards' | 'decks'): Promise<void> {
  const times = await readJson<Record<string, string>>(STORE_PATHS.refreshed, {})
  await writeJson(STORE_PATHS.refreshed, { ...times, [kind]: new Date().toISOString() })
}

/**
 * Reads a JSON file.
 *
 * @param path - File path
 * @param fallback - Returned when the file doesn't exist
 * @returns The parsed content
 * @throws {Error} If the file exists but isn't valid JSON, so a broken store never reads as empty
 */
export async function readJson<T>(path: string, fallback: T): Promise<T> {
  const text = await readFile(path, 'utf8').catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return undefined
    throw e
  })
  return text === undefined ? fallback : JSON.parse(text)
}

/** Copies a value with every object's keys sorted; arrays keep their order. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, sortKeys(v)]),
  )
}

const isPlain = (v: unknown) => v === null || typeof v !== 'object'

/** Pretty JSON, except arrays of plain values (or of plain-value arrays) stay on one line: `[[1,2],[3,1]]`. */
function format(value: unknown, pad = ''): string {
  if (isPlain(value)) return JSON.stringify(value)
  if (Array.isArray(value) && value.every((v) => isPlain(v) || (Array.isArray(v) && v.every(isPlain)))) {
    return JSON.stringify(value)
  }
  const inner = `${pad}  `
  const items = Array.isArray(value)
    ? value.map((v) => inner + format(v, inner))
    : Object.entries(value as object)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${inner}${JSON.stringify(k)}: ${format(v, inner)}`)
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}']
  return items.length ? `${open}\n${items.join(',\n')}\n${pad}${close}` : `${open}${close}`
}

/**
 * Writes a value as JSON with sorted keys and 2-space indent, so diffs show exactly what changed. Arrays of plain
 * values stay on one line (a deck's card list is one line, not one per number).
 *
 * @param path - File path (parent directories are created)
 * @param value - Value to write
 * @returns Whether the file changed; an identical file is left untouched
 */
export async function writeJson(path: string, value: unknown): Promise<boolean> {
  const text = `${format(sortKeys(value))}\n`
  if ((await readFile(path, 'utf8').catch(() => undefined)) === text) return false
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text)
  return true
}
