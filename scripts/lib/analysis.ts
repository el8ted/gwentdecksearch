import { readFile } from 'node:fs/promises'
import { type IndexedDeck, indexDecks } from '../../src/filter.ts'
import type { Dataset } from '../../src/types.ts'
import { fold, loose, matchRank } from '../../src/ui/autocomplete.ts'
import { type CatalogCard, readJson, STORE_PATHS } from './store.ts'

/** Everything the analysis scripts read: the built decks, plus the full card catalog and names in every language. */
export interface AnalysisData {
  dataset: Dataset
  decks: IndexedDeck[]
  /** Every card, including those no deck runs; provisions as today. */
  catalog: Record<string, CatalogCard>
  /** Card names by language, then card ID; English from the catalog. */
  names: Record<string, Record<string, string>>
  /** Deck-builder tag names by language, then tag key. */
  tags: Record<string, Record<string, string>>
}

/**
 * Reads the committed data: data/decks.json and the card catalog, card names and tag names in data/source/.
 *
 * @returns The data, decks indexed
 */
export async function readAnalysisData(): Promise<AnalysisData> {
  const dataset: Dataset = JSON.parse(await readFile('data/decks.json', 'utf8'))
  const catalog = await readJson<Record<string, CatalogCard>>(STORE_PATHS.cards, {})
  const other = await readJson<Record<string, Record<string, string>>>(STORE_PATHS.cardNames, {})
  const english = Object.fromEntries(Object.entries(catalog).map(([id, c]) => [id, c.name]))
  return {
    dataset,
    decks: indexDecks(dataset),
    catalog,
    names: { en: english, ...other },
    tags: await readJson(STORE_PATHS.tags, {}),
  }
}

/**
 * A name looked up: one match, or what it could mean: several cards sharing the exact name (`exact`), or names that
 * contain it (suggestions, possibly none).
 */
export type Lookup<T> = { ok: true; value: T } | { ok: false; exact: boolean; matches: T[] }

const words = (text: string) =>
  fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

/**
 * Looks up names typed in any of the site's languages. An exact match, compared as the site compares author names
 * (case, accents, spacing and punctuation ignored, so "Vilgefortz Renegade" is Vilgefortz: Renegade), wins. With none,
 * suggestions come back, never picked: names the site's search would suggest (they start with or contain the text),
 * plus names whose words start with each typed word, for the shortened names lists use ("E. Eclipse Deacon").
 *
 * @param byLang - Names by language, then key
 * @returns The lookup: one key, or every key it could be
 */
export function nameLookup(byLang: Record<string, Record<string, string>>): (query: string) => Lookup<string> {
  const exact = new Map<string, Set<string>>()
  const all: [string, string][] = []
  for (const names of Object.values(byLang)) {
    for (const [key, name] of Object.entries(names)) {
      exact.set(loose(name), (exact.get(loose(name)) ?? new Set()).add(key))
      all.push([key, name])
    }
  }
  return (query) => {
    const hits = [...(exact.get(loose(query)) ?? [])]
    if (hits.length === 1) return { ok: true, value: hits[0] }
    if (hits.length) return { ok: false, exact: true, matches: hits }
    const q = fold(query.trim())
    const typed = words(query)
    const near = new Set(
      all
        .filter(([, name]) => {
          const ws = words(name)
          return q && (matchRank(name, q) >= 0 || typed.every((t) => ws.some((w) => w.startsWith(t))))
        })
        .map(([key]) => key),
    )
    return { ok: false, exact: false, matches: [...near].slice(0, 8) }
  }
}

/**
 * Looks up a card by ID or by name in any language.
 *
 * @param data - Catalog and names
 * @returns The lookup
 */
export function cardLookup(data: Pick<AnalysisData, 'catalog' | 'names'>): (query: string) => Lookup<number> {
  const byName = nameLookup(data.names)
  return (query) => {
    const q = query.trim()
    if (/^\d+$/.test(q) && data.catalog[q]) return { ok: true, value: Number(q) }
    const r = byName(q)
    return r.ok ? { ok: true, value: Number(r.value) } : { ...r, matches: r.matches.map(Number) }
  }
}

/**
 * A card's name in a language, falling back to English.
 *
 * @param data - Catalog and names
 * @param id - Card
 * @param lang - Language (`en`, `ru`, `zh-cn`…)
 * @returns The name; in another language, followed by the English name
 */
export function cardName(data: Pick<AnalysisData, 'catalog' | 'names'>, id: number, lang = 'en'): string {
  const en = data.catalog[id]?.name ?? String(id)
  const local = data.names[lang]?.[id]
  return local && local !== en ? `${local} (${en})` : en
}

/**
 * One line per card a name could mean, so the user can retype it unambiguously.
 *
 * @param data - Catalog and names
 * @param ids - The candidates
 * @param lang - Language for the names
 * @returns `ID  name (faction type, N provisions)` lines
 */
export function describeCards(data: Pick<AnalysisData, 'catalog' | 'names'>, ids: number[], lang = 'en'): string {
  return ids
    .map((id) => {
      const c = data.catalog[id]
      return `  ${id}  ${cardName(data, id, lang)} (${c.faction} ${c.type}, ${c.provisions} provisions)`
    })
    .join('\n')
}

/**
 * The half-year a deck's guide was last edited, for telling a live archetype from a fading one.
 *
 * @param deck - The deck
 * @returns E.g. `2025 H2`; `undated` for sheet decks, which have no date
 */
export function halfYear(deck: IndexedDeck): string {
  const d = deck.deck.updated
  return d ? `${d.slice(0, 4)} H${Number(d.slice(5, 7)) <= 6 ? 1 : 2}` : 'undated'
}

/**
 * Who plays a set of decks and when: leaders, factions, and decks per half-year, as Markdown lines.
 *
 * @param data - Catalog and names
 * @param decks - The decks
 * @param lang - Language for leader names
 * @returns Three lines
 */
export function profile(data: Pick<AnalysisData, 'catalog' | 'names'>, decks: IndexedDeck[], lang = 'en'): string {
  const count = <K>(keys: K[]) => [...Map.groupBy(keys, (k) => k)].map(([k, v]): [K, number] => [k, v.length])
  const top = (rows: [string, number][], n = 6) =>
    rows
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ')
  const leaders = count(decks.map((d) => d.leader)).map(([id, n]): [string, number] => [cardName(data, id, lang), n])
  const halves = count(decks.map(halfYear)).sort(([a], [b]) => a.localeCompare(b))
  return [
    `Factions: ${top(count(decks.map((d) => d.faction)))}`,
    `Leaders: ${top(leaders)}`,
    `By half-year (guide date): ${halves.map(([k, v]) => `${k} ${v}`).join(' · ')}`,
  ].join('  \n')
}

/** What every report says first: what the data is, and what it can't show. */
export function caveat(data: Pick<AnalysisData, 'dataset' | 'decks'>): string {
  return (
    `_${data.decks.length} published decks on Gwent Deck Search (data from ${data.dataset.scrapedAt.slice(0, 10)}): ` +
    "guides and curated lists, not ladder play. Provisions are checked against today's limit; power and ability " +
    "changes don't show in deck lists._"
  )
}
