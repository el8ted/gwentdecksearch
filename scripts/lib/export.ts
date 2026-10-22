import { budgetSide, provisionStatus } from '../../src/filter.ts'
import { LANGUAGES } from '../../src/i18n.ts'
import type { Faction } from '../../src/types.ts'
import type { AnalysisData } from './analysis.ts'
import { rarityOf } from './cards.ts'
import { COMMUNITY_WINDOW_MONTHS, SHEET_WINDOW_MONTHS } from './entries.ts'
import { packageReport } from './packages.ts'

/** A pair is listed when this many decks run both cards. */
export const MIN_PAIR_DECKS = 10

type Cell = string | number | undefined

/**
 * CSV as spreadsheets read it: comma-separated, quoted where needed, CRLF line ends, and a byte-order mark so Excel
 * opens UTF-8 (Chinese, Japanese, Korean and Cyrillic names) correctly.
 *
 * @param header - Column names
 * @param rows - Rows, cell by cell; `undefined` is an empty cell
 * @returns The file's text
 */
export function csv(header: string[], rows: Cell[][]): string {
  const cell = (v: Cell) => {
    const s = v === undefined ? '' : String(v)
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  return `\uFEFF${[header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`
}

const round = (n: number, places = 3) => Math.round(n * 10 ** places) / 10 ** places

/**
 * One row per deck: where it's from, its faction, leader and stratagem, provisions against today's limit, and who
 * published it.
 *
 * @param data - Decks and catalog
 * @returns `decks.csv`
 */
export function decksCsv(data: Pick<AnalysisData, 'decks' | 'catalog' | 'dataset'>): string {
  const name = (id: number) => data.catalog[id]?.name ?? ''
  return csv(
    [
      'deck_id',
      'url',
      'name',
      'original_name',
      'original_lang',
      'faction',
      'leader_id',
      'leader',
      'stratagem_id',
      'stratagem',
      'cards',
      'units',
      'provisions_used',
      'provision_limit',
      'provisions_spare',
      'provision_status',
      'scraps',
      'sources',
      'author',
      'votes',
      'guide_updated',
      'guide_lang',
      'video_url',
      'video_lang',
      'same_list_as',
    ],
    data.decks.map((e) => {
      const { deck } = e
      const { limit, used, delta } = provisionStatus(e, data.dataset.cards)
      return [
        deck.id,
        deck.url,
        deck.name,
        deck.original?.name,
        deck.original?.lang,
        e.faction,
        e.leader,
        name(e.leader),
        e.stratagem,
        name(e.stratagem),
        deck.stats.cards,
        deck.stats.units,
        used,
        limit,
        delta,
        budgetSide(e.budget),
        deck.stats.scraps,
        deck.sources.join(';'),
        deck.author,
        deck.votes,
        deck.updated?.slice(0, 10),
        deck.guideLang,
        deck.video?.url,
        deck.video?.lang,
        e.list === deck.id ? undefined : e.list,
      ]
    }),
  )
}

/**
 * Every deck's cards, one row per card: leader and stratagem included, marked by role.
 *
 * @param data - Decks and catalog
 * @returns `deck-cards.csv`
 */
export function deckCardsCsv(data: Pick<AnalysisData, 'decks' | 'catalog'>): string {
  return csv(
    ['deck_id', 'card_id', 'card', 'copies', 'role'],
    data.decks.flatMap((e) =>
      e.deck.cards.map(([id, copies]) => [
        e.deck.id,
        id,
        data.catalog[id]?.name,
        copies,
        id === e.leader ? 'leader' : id === e.stratagem ? 'stratagem' : 'card',
      ]),
    ),
  )
}

/** Decks per faction, and the factions a card can be played in. */
function factionScope(data: Pick<AnalysisData, 'decks' | 'catalog'>) {
  const perFaction = new Map<Faction, number>()
  for (const e of data.decks) perFaction.set(e.faction, (perFaction.get(e.faction) ?? 0) + 1)
  const allowed = (id: number): Faction[] => {
    const c = data.catalog[id]
    if (!c || c.faction === 'NE') return [...perFaction.keys()]
    return [c.faction, ...(c.secondaryFaction ? [c.secondaryFaction] : [])]
  }
  const decksIn = (factions: Faction[]) => factions.reduce((n, f) => n + (perFaction.get(f) ?? 0), 0)
  return { allowed, decksIn }
}

/**
 * Every card with its stats and tags, how many decks run it out of those that could (its faction's, or every deck
 * for a neutral), and its name in each of the site's languages.
 *
 * @param data - Decks, catalog, names and tags
 * @returns `cards.csv`
 */
export function cardsCsv(data: Pick<AnalysisData, 'decks' | 'catalog' | 'names' | 'tags'>): string {
  const runs = new Map<number, number>()
  for (const e of data.decks) for (const id of e.ids) runs.set(id, (runs.get(id) ?? 0) + 1)
  const { allowed, decksIn } = factionScope(data)
  const ids = Object.keys(data.catalog)
    .map(Number)
    .sort((a, b) => a - b)
  return csv(
    [
      'card_id',
      'faction',
      'secondary_faction',
      'type',
      'rarity',
      'provisions',
      'power',
      'craft_scraps',
      'tags',
      'tag_names',
      'decks',
      'decks_that_could',
      'share',
      ...LANGUAGES.map((l) => `name_${l}`),
    ],
    ids.map((id) => {
      const c = data.catalog[id]
      const n = runs.get(id) ?? 0
      const could = decksIn(allowed(id))
      return [
        id,
        c.faction,
        c.secondaryFaction,
        c.type,
        rarityOf(c.rarity, id),
        c.provisions,
        c.power,
        c.craftingCost,
        (c.tags ?? []).join(';'),
        (c.tags ?? []).map((t) => data.tags.en?.[t] ?? t).join(';'),
        n,
        could,
        could ? round(n / could) : 0,
        ...LANGUAGES.map((l) => data.names[l]?.[id]),
      ]
    }),
  )
}

/**
 * Pairs of cards in at least {@link MIN_PAIR_DECKS} decks together (stratagems aside), and how much more often than
 * chance: lift is `together × decks / (decks with A × decks with B)`, counting only the decks that could run both (a
 * faction card's faction), so two cards of one faction aren't "related" just for sharing it. Archetypes show up as
 * cards with high lift to each other; naming them is left to whoever reads the data.
 *
 * @param data - Decks and catalog
 * @param min - Fewest decks a pair must share to be listed
 * @returns `card-pairs.csv`, most decks together first
 */
export function cardPairsCsv(data: Pick<AnalysisData, 'decks' | 'catalog'>, min = MIN_PAIR_DECKS): string {
  const { allowed, decksIn } = factionScope(data)
  const together = new Map<number, number>()
  const byFaction = new Map<Faction, Map<number, number>>()
  const KEY = 1_000_000
  for (const e of data.decks) {
    const ids = [...e.ids].filter((id) => id !== e.stratagem).sort((a, b) => a - b)
    const counts = byFaction.get(e.faction) ?? new Map<number, number>()
    byFaction.set(e.faction, counts)
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const k = ids[i] * KEY + ids[j]
        together.set(k, (together.get(k) ?? 0) + 1)
      }
    }
  }
  const rows: Cell[][] = []
  for (const [k, n] of together) {
    if (n < min) continue
    const [a, b] = [Math.floor(k / KEY), k % KEY]
    const both = allowed(a).filter((f) => allowed(b).includes(f))
    const inScope = (id: number) => both.reduce((s, f) => s + (byFaction.get(f)?.get(id) ?? 0), 0)
    const [na, nb, all] = [inScope(a), inScope(b), decksIn(both)]
    rows.push([
      a,
      b,
      data.catalog[a]?.name,
      data.catalog[b]?.name,
      n,
      na,
      nb,
      round(n / na),
      round(n / nb),
      round((n * all) / (na * nb), 2),
    ])
  }
  rows.sort((x, y) => Number(y[4]) - Number(x[4]) || Number(x[0]) - Number(y[0]) || Number(x[1]) - Number(y[1]))
  return csv(
    [
      'card_a',
      'card_b',
      'name_a',
      'name_b',
      'decks_together',
      'decks_a',
      'decks_b',
      'share_of_a',
      'share_of_b',
      'lift',
    ],
    rows,
  )
}

/**
 * A package report per leader with decks (leaders are the game's own grouping), in a language.
 *
 * @param data - Decks, catalog and names
 * @param lang - Language for card names (beside the English)
 * @returns File name (`<faction>-<leader>.md`) → report
 */
export function leaderReports(data: AnalysisData, lang: string): Map<string, string> {
  const leaders = [...new Set(data.decks.map((e) => e.leader))]
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  return new Map(
    leaders
      .map((id): [string, string] => [
        `${data.catalog[id].faction}-${slug(data.catalog[id].name)}.md`,
        packageReport(data, { cards: [id], min: 1 }, lang),
      ])
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

/**
 * What the export holds: when the data is from, the windows it was collected over, and counts.
 *
 * @param data - Decks and catalog
 * @returns `manifest.json`'s object
 */
export function manifest(data: Pick<AnalysisData, 'decks' | 'catalog' | 'dataset'>) {
  const sources: Record<string, number> = {}
  for (const e of data.decks) for (const s of e.deck.sources) sources[s] = (sources[s] ?? 0) + 1
  return {
    data_from: data.dataset.scrapedAt,
    decks: data.decks.length,
    cards: Object.keys(data.catalog).length,
    leaders: new Set(data.decks.map((e) => e.leader)).size,
    decks_by_source: sources,
    windows: {
      community_guides_months: COMMUNITY_WINDOW_MONTHS,
      sheet_patch_tabs_months: SHEET_WINDOW_MONTHS,
      sheet_main_lists: 'all',
    },
    min_pair_decks: MIN_PAIR_DECKS,
    languages: [...LANGUAGES],
  }
}
