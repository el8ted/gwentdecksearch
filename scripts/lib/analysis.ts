import { readFile } from 'node:fs/promises'
import { type IndexedDeck, indexDecks } from '../../src/filter.ts'
import { fold, loose, matchRank } from '../../src/search.ts'
import type { Dataset, Faction } from '../../src/types.ts'
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

// Edits (insert, delete, substitute, swap two neighbours) to turn a into b.
const distance = (a: string, b: string) => {
  let prev: number[] = []
  let row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) next[j] = Math.min(next[j], prev[j - 2] + 1)
    }
    prev = row
    row = next
  }
  return row[b.length]
}

/**
 * Looks up names typed in any of the site's languages. An exact match, compared as the site compares author names
 * (case, accents, spacing and punctuation ignored, so "Vilgefortz Renegade" is Vilgefortz: Renegade), wins. With none,
 * suggestions come back, never picked: names the site's search would suggest (they start with or contain the text),
 * plus names whose words start with each typed word, for the shortened names lists use ("E. Eclipse Deacon"). If
 * neither finds any, the names (or their starts) a few typos away, closest first, so "Caranthr" suggests Caranthir.
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
    if (!near.size) {
      // A typo per four letters, against the whole name or its start (for shortened names).
      const lq = loose(query)
      const most = Math.floor(lq.length / 4)
      const close = new Map<string, number>()
      for (const [key, name] of most ? all : []) {
        const ln = loose(name)
        const d = Math.min(distance(lq, ln), distance(lq, ln.slice(0, lq.length)))
        if (d <= most && d < (close.get(key) ?? Infinity)) close.set(key, d)
      }
      for (const [key] of [...close].sort((a, b) => a[1] - b[1])) near.add(key)
    }
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
 * Why a name didn't resolve, for a line the user must fix: the cards sharing it (only an ID tells them apart), or
 * the suggestions, if any.
 *
 * @param found - The failed lookup
 * @param name - The name as written
 * @param data - Catalog and names
 * @param lang - Language for the names
 * @returns The explanation
 */
export function explainLookup(
  found: Extract<Lookup<number>, { ok: false }>,
  name: string,
  data: Pick<AnalysisData, 'catalog' | 'names'>,
  lang = 'en',
): string {
  const list = describeCards(data, found.matches, lang)
  if (found.exact) return `"${name}" could be any of these; use the ID:\n${list}`
  return `no card is called "${name}"${found.matches.length ? `; did you mean:\n${list}` : ''}`
}

/**
 * Which decks could run a card: its faction's (both, for a dual-faction card), or every deck for a neutral. The one
 * base the scripts measure a card's share against.
 *
 * @param data - Decks and catalog
 * @returns `allowed(id)`, the factions that can play a card; `decksIn(factions)`, their decks; and
 *   `decksThatCould(id)`, the two together
 */
export function factionScope(data: Pick<AnalysisData, 'decks' | 'catalog'>) {
  const perFaction = new Map<Faction, number>()
  for (const e of data.decks) perFaction.set(e.faction, (perFaction.get(e.faction) ?? 0) + 1)
  const allowed = (id: number): Faction[] => {
    const c = data.catalog[id]
    if (!c || c.faction === 'NE') return [...perFaction.keys()]
    return [c.faction, ...(c.secondaryFaction ? [c.secondaryFaction] : [])]
  }
  const decksIn = (factions: Faction[]) => factions.reduce((n, f) => n + (perFaction.get(f) ?? 0), 0)
  return { allowed, decksIn, decksThatCould: (id: number) => decksIn(allowed(id)) }
}

/**
 * Decks per leader, most first.
 *
 * @param decks - The decks
 * @returns `[leader, decks]`
 */
export function leaderCounts(decks: IndexedDeck[]): [number, number][] {
  const n = new Map<number, number>()
  for (const d of decks) n.set(d.leader, (n.get(d.leader) ?? 0) + 1)
  return [...n].sort((a, b) => b[1] - a[1])
}

/**
 * A file name from a title: lower case, accents off, letters and digits joined by `-`, at most 60 characters.
 *
 * @param title - Any title
 * @returns E.g. `shinmiri-s-lerio-s-bc37-ideas`; empty if nothing is left
 */
export function slug(title: string): string {
  return fold(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '')
}

/**
 * A command-line option's value (`--lang zh-cn`).
 *
 * @param args - The arguments
 * @param name - The option, e.g. `--lang`
 * @returns Its value, or `undefined` if it isn't given
 */
export function option(args: string[], name: string): string | undefined {
  return args.includes(name) ? args[args.indexOf(name) + 1] : undefined
}

/**
 * The arguments that aren't options or their values.
 *
 * @param args - The arguments
 * @param valued - Options that take a value, e.g. `['--lang', '--out']`
 * @returns The rest, in order
 */
export function positionals(args: string[], valued: string[]): string[] {
  return args.filter((a, i) => !a.startsWith('--') && !valued.includes(args[i - 1]))
}

/**
 * What's wrong with a `--lang` value, if anything.
 *
 * @param data - Names by language
 * @param lang - The language asked for
 * @returns A message, or `undefined` if there are names in it
 */
export function langError(data: Pick<AnalysisData, 'names'>, lang: string): string | undefined {
  return data.names[lang] ? undefined : `No card names in "${lang}"; try one of: ${Object.keys(data.names).join(', ')}`
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
  const leaders = leaderCounts(decks).map(([id, n]): [string, number] => [cardName(data, id, lang), n])
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
