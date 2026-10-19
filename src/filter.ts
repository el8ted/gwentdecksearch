import { CONFIG } from './config.ts'
import { type Card, type Dataset, type Deck, type Faction, SOURCE_AUTHORS, type Source, type TagKey } from './types.ts'

/** Base provision limit before the leader's bonus. */
export const BASE_PROVISIONS = 150

/** Provisions used against the limit: spare (under), exact, or over. */
export type BudgetSide = 'spare' | 'exact' | 'over'

/** Provisions against the limit by step: 1, 2, or 3 or more spare or over. */
export type Budget = 'spare3' | 'spare2' | 'spare1' | 'exact' | 'over1' | 'over2' | 'over3'

/** Every {@link Budget}, in display order: most spare first, so Exact sits in the middle. */
export const BUDGETS: readonly Budget[] = ['spare3', 'spare2', 'spare1', 'exact', 'over1', 'over2', 'over3']

/**
 * The step a provision delta falls in.
 *
 * @param delta - `limit − used`, from {@link provisionStatus}
 * @returns Its budget, with 3 or more spare or over sharing the last step
 */
export function budgetOf(delta: number): Budget {
  const step = Math.min(Math.abs(delta), 3)
  return delta > 0 ? (`spare${step}` as Budget) : delta < 0 ? (`over${step}` as Budget) : 'exact'
}

/**
 * Which side of the limit a budget is on.
 *
 * @param budget - A budget step
 * @returns Spare, exact or over
 */
export function budgetSide(budget: Budget): BudgetSide {
  return budget.replace(/\d$/, '') as BudgetSide
}

/** Everything the user has selected. */
export interface FilterState {
  /** Empty means any faction. */
  factions: Faction[]
  /** Empty means every source. */
  sources?: Source[]
  /** Provision status; empty means any. */
  budgets?: Budget[]
  /** Only decks with a gameplay video. */
  video?: boolean
  /** Languages a deck's guide or video is in (playgwent codes); empty means any. */
  langs?: string[]
  leader?: number
  stratagem?: number
  /**
   * Cards (IDs), deck-builder tags (keys) and authors (`@` + {@link authorKey}) from the Cards box, in the order picked,
   * so the last one is the last tried. A deck has a tag if any of its cards (leader and stratagem included) does.
   */
  picks: (number | TagKey)[]
  /** Picks a deck must not have, whatever {@link match} says; each is also in {@link picks}, which keeps the order. */
  excludes?: (number | TagKey)[]
  /** Deck must contain every wanted pick (`all`, default) or at least one (`any`). */
  match?: 'all' | 'any'
  /** Only decks with this card list: an {@link IndexedDeck.list} ID, from a pasted deck URL. */
  deck?: string
  /** Rank by cards in common with this deck (its ID), most first; the deck itself leads when the filters keep it. */
  near?: string
}

/** A deck with lookups precomputed once, so filtering stays a set check per card. */
export interface IndexedDeck {
  deck: Deck
  leader: number
  stratagem: number
  faction: Faction
  /** Provision step under the current limit. */
  budget: Budget
  ids: Set<number>
  tags: Set<TagKey>
  /** The guide's and the video's languages. */
  langs: Set<string>
  /** {@link authorKey}s: the guide's author, and the owner of each list that has the deck. */
  authors: Set<string>
  /** The ID of the first deck with exactly this card list (leader and stratagem included), shared by its duplicates. */
  list: string
}

/** A deck's provisions against the current-patch limit. */
export interface ProvisionStatus {
  limit: number
  used: number
  /** `limit − used`: negative is over the limit, positive is spare. */
  delta: number
}

/** Deck counts per option, each computed with that dimension's own filter removed. */
export interface Facets {
  factions: Map<Faction, number>
  sources: Map<Source, number>
  budgets: Map<Budget, number>
  leaders: Map<number, number>
  stratagems: Map<number, number>
  cards: Map<number, number>
  tags: Map<TagKey, number>
  /** Decks with a video. */
  videos: number
  langs: Map<string, number>
  authors: Map<string, number>
}

/**
 * An author's identity: their playgwent name, case ignored.
 *
 * @param name - A guide author, or a list owner's {@link SOURCE_AUTHORS} name
 * @returns The name in lower case
 */
export function authorKey(name: string): string {
  return name.toLowerCase()
}

/** A deck's authors: a list's owner counts too, since the list is theirs. */
function deckAuthors(deck: Deck): string[] {
  return [deck.author, ...deck.sources.filter((s) => s !== 'community').map((s) => SOURCE_AUTHORS[s])]
    .filter((a) => a !== undefined)
    .map(authorKey)
}

/**
 * Display names by {@link authorKey}: a list owner's playgwent name, else the first guide's spelling.
 *
 * @param decks - Indexed decks
 * @returns Name by key
 */
export function authorNames(decks: IndexedDeck[]): Map<string, string> {
  const names = new Map(Object.values(SOURCE_AUTHORS).map((n) => [authorKey(n), n]))
  for (const { deck } of decks)
    if (deck.author && !names.has(authorKey(deck.author))) names.set(authorKey(deck.author), deck.author)
  return names
}

/**
 * Precomputes leader, stratagem, faction and card set per deck.
 *
 * @param data - The dataset
 * @returns One entry per deck, in dataset order
 * @throws {Error} If a deck lacks a leader or stratagem (the scraper guarantees both)
 */
export function indexDecks(data: Dataset): IndexedDeck[] {
  // Card list → first deck with it, so guides of the same list find each other.
  const lists = new Map<string, string>()
  return data.decks.map((deck) => {
    const ofType = (type: Card['type']) => deck.cards.find(([id]) => data.cards[id]?.type === type)?.[0]
    const leader = ofType('leader')
    const stratagem = ofType('stratagem')
    if (leader === undefined || stratagem === undefined) throw new Error(`Deck ${deck.id} lacks a leader/stratagem`)
    // Faction comes from the leader: stratagems and many cards are neutral.
    const faction = data.cards[leader].faction
    const budget = budgetOf(provisionStatus({ deck, leader }, data.cards).delta)
    const ids = new Set(deck.cards.map(([id]) => id))
    const tags = new Set([...ids].flatMap((id) => data.cards[id]?.tags ?? []))
    const langs = new Set([deck.guideLang, deck.video?.lang].filter((l) => l !== undefined))
    const key = deck.cards
      .map(([id, n]) => `${id}x${n}`)
      .sort()
      .join(',')
    if (!lists.has(key)) lists.set(key, deck.id)
    const list = lists.get(key) as string
    return { deck, leader, stratagem, faction, budget, ids, tags, langs, authors: new Set(deckAuthors(deck)), list }
  })
}

/**
 * A playgwent deck URL: a guide (`/decks/guides/408411`) or a deck hash (`/decks/3c3e…`), with or without the scheme,
 * `www.` and a language segment (`/en/`, `/pt-BR/`). Group 1 is the guide number, group 2 the hash.
 */
export const DECK_URL =
  /^(?:https?:\/\/)?(?:www\.)?playgwent\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?decks\/(?:guides\/(\d+)|([0-9a-f]{8,}))\/?(?:[?#].*)?$/i

/**
 * The card list a pasted playgwent deck URL points to.
 *
 * @param decks - Indexed decks
 * @param text - What was typed or pasted
 * @returns The deck's {@link IndexedDeck.list}; `undefined` if it isn't a deck URL or the deck isn't in the data
 */
export function listForUrl(decks: IndexedDeck[], text: string): string | undefined {
  const m = DECK_URL.exec(text.trim())
  if (!m) return undefined
  const [, guide, hash] = m
  const found = guide
    ? decks.find((e) => e.deck.url.endsWith(`/guides/${guide}`))
    : decks.find((e) => e.deck.id === hash.toLowerCase())
  return found?.list
}

/**
 * Compares a deck's provisions used with `150 + leader bonus`.
 *
 * @param entry - The deck
 * @param cards - Card table holding the leader's current bonus
 * @returns Limit, used and delta
 */
export function provisionStatus(entry: Pick<IndexedDeck, 'deck' | 'leader'>, cards: Dataset['cards']): ProvisionStatus {
  const limit = BASE_PROVISIONS + cards[entry.leader].provisions
  const used = entry.deck.stats.provisions
  return { limit, used, delta: limit - used }
}

/**
 * The one faction a card's decks must belong to: none for neutral cards, or for dual-faction cards, which fit
 * either faction's decks.
 *
 * @param card - The card
 * @returns Its faction, or `undefined` if it fits more than one
 */
export function singleFaction(card: Card): Faction | undefined {
  return card.faction === 'NE' || card.secondaryFaction ? undefined : card.faction
}

/**
 * The cards among the picks.
 *
 * @param picks - {@link FilterState.picks}
 * @returns Card IDs, in pick order
 */
export function pickedCards(picks: FilterState['picks']): number[] {
  return picks.filter((p) => typeof p === 'number')
}

/**
 * A deck's cards besides its leader and stratagem: the leader is matched on its own, and stratagems are swapped freely.
 *
 * @param e - The deck
 * @returns `[cardId, copies]`
 */
export function deckBody(e: IndexedDeck): [number, number][] {
  return e.deck.cards.filter(([id]) => id !== e.leader && id !== e.stratagem)
}

/**
 * Cards two decks share besides leader and stratagem, copies counted: Chimera ×2 shares one with Chimera ×1.
 *
 * @param a - One deck
 * @param b - The other
 * @returns Shared card count
 */
export function overlap(a: IndexedDeck, b: IndexedDeck): number {
  const copies = new Map(deckBody(b))
  return deckBody(a).reduce((n, [id, c]) => n + Math.min(c, copies.get(id) ?? 0), 0)
}

/** Each deck's {@link overlap} with the `near` deck; `undefined` without one (or for an unknown ID). */
function sharedWithNear(decks: IndexedDeck[], s: FilterState): Map<IndexedDeck, number> | undefined {
  const near = s.near === undefined ? undefined : decks.find((e) => e.deck.id === s.near)
  return near && new Map(decks.map((e) => [e, overlap(near, e)]))
}

/**
 * The picks a deck should have: every pick that isn't excluded.
 *
 * @param s - Current filters
 * @returns Picks, in pick order
 */
export function wantedPicks(s: Pick<FilterState, 'picks' | 'excludes'>): FilterState['picks'] {
  return s.excludes?.length ? s.picks.filter((p) => !s.excludes?.includes(p)) : s.picks
}

/** Whether a deck has a card, tag or author. */
function has(e: IndexedDeck, p: number | TagKey): boolean {
  return typeof p === 'number' ? e.ids.has(p) : p.startsWith('@') ? e.authors.has(p.slice(1)) : e.tags.has(p)
}

/** How many of the wanted picks a deck has. */
function hits(e: IndexedDeck, s: FilterState): number {
  return wantedPicks(s).filter((p) => has(e, p)).length
}

/** Whether a deck has none of the excludes, and the wanted picks: all of them, or at least one with `match: 'any'`. */
function hasCards(e: IndexedDeck, s: FilterState): boolean {
  if (s.excludes?.some((p) => has(e, p))) return false
  const wanted = wantedPicks(s).length
  if (wanted === 0) return true
  const n = hits(e, s)
  return s.match === 'any' ? n > 0 : n === wanted
}

function matchesBase(
  e: IndexedDeck,
  s: Pick<
    FilterState,
    'factions' | 'sources' | 'budgets' | 'video' | 'langs' | 'leader' | 'stratagem' | 'deck' | 'near'
  >,
): boolean {
  return (
    (!s.video || e.deck.video !== undefined) &&
    (!s.langs?.length || s.langs.some((l) => e.langs.has(l))) &&
    (!s.sources?.length || e.deck.sources.some((src) => s.sources?.includes(src))) &&
    (!s.budgets?.length || s.budgets.includes(e.budget)) &&
    (s.factions.length === 0 || s.factions.includes(e.faction)) &&
    (s.leader === undefined || e.leader === s.leader) &&
    (s.stratagem === undefined || e.stratagem === s.stratagem) &&
    (s.deck === undefined || e.list === s.deck)
  )
}

/**
 * Decks matching every filter, sorted by name (then ID, so same-name alternates stay together). With
 * `match: 'any'`, decks with more of the picks come first; with `near`, only decks sharing at least `minShared` cards
 * with that deck, most first.
 *
 * @param decks - Indexed decks
 * @param state - Current filters
 * @param minShared - Cards a deck must share with the `near` deck ({@link overlap})
 * @returns Matching decks
 */
export function matchDecks(
  decks: IndexedDeck[],
  state: FilterState,
  minShared = CONFIG.similarMinShared,
): IndexedDeck[] {
  const byName = (a: IndexedDeck, b: IndexedDeck) =>
    a.deck.name.localeCompare(b.deck.name) || a.deck.id.localeCompare(b.deck.id)
  const shared = sharedWithNear(decks, state)
  const matched = decks.filter(
    (e) => matchesBase(e, state) && hasCards(e, state) && (!shared || (shared.get(e) ?? 0) >= minShared),
  )
  if (shared) {
    // The deck itself first, as the one to compare against (another deck can share all 25 with a different stratagem).
    const rank = (e: IndexedDeck) => (e.deck.id === state.near ? Number.POSITIVE_INFINITY : (shared.get(e) ?? 0))
    return matched
      .map((e) => [rank(e), e] as const)
      .sort(([na, a], [nb, b]) => nb - na || byName(a, b))
      .map(([, e]) => e)
  }
  if (state.match !== 'any') return matched.sort(byName)
  // Counted once per deck, not once per comparison.
  return matched
    .map((e) => [hits(e, state), e] as const)
    .sort(([na, a], [nb, b]) => nb - na || byName(a, b))
    .map(([, e]) => e)
}

function count<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

/**
 * Counts decks per option so controls only offer choices that still yield results.
 *
 * Each dimension ignores its own filter, so picking a leader doesn't hide the other leaders.
 *
 * @param decks - Indexed decks
 * @param state - Current filters
 * @param minShared - As for {@link matchDecks}
 * @returns Counts per faction, source, leader, stratagem, (non-leader, non-stratagem) card, tag and guide or video
 *   language, and of decks with a video
 */
export function facets(decks: IndexedDeck[], state: FilterState, minShared = CONFIG.similarMinShared): Facets {
  const shared = sharedWithNear(decks, state)
  const keep = (e: IndexedDeck, s: Partial<FilterState>) =>
    matchesBase(e, { ...state, ...s }) && hasCards(e, state) && (!shared || (shared.get(e) ?? 0) >= minShared)
  const result: Facets = {
    factions: new Map(),
    sources: new Map(),
    budgets: new Map(),
    leaders: new Map(),
    stratagems: new Map(),
    cards: new Map(),
    tags: new Map(),
    videos: 0,
    langs: new Map(),
    authors: new Map(),
  }
  for (const e of decks) {
    if (keep(e, { factions: [] })) count(result.factions, e.faction)
    if (keep(e, { sources: [] })) for (const src of e.deck.sources) count(result.sources, src)
    if (keep(e, { budgets: [] })) count(result.budgets, e.budget)
    if (e.deck.video && keep(e, { video: false })) result.videos++
    if (keep(e, { langs: [] })) for (const l of e.langs) count(result.langs, l)
    if (keep(e, { leader: undefined })) count(result.leaders, e.leader)
    if (keep(e, { stratagem: undefined })) count(result.stratagems, e.stratagem)
    if (!keep(e, {})) continue
    for (const id of e.ids) if (id !== e.leader && id !== e.stratagem) count(result.cards, id)
    for (const k of e.tags) count(result.tags, k)
    for (const a of e.authors) count(result.authors, a)
  }
  return result
}

/**
 * Cards every one of the decks runs (leaders and stratagems included), for dimming shared staples.
 *
 * @param decks - Currently matching decks
 * @returns Card IDs in all of them; empty for no decks
 */
export function sharedCards(decks: IndexedDeck[]): Set<number> {
  const [first, ...rest] = decks
  return new Set(first ? [...first.ids].filter((id) => rest.every((e) => e.ids.has(id))) : [])
}

/**
 * How many of the matching decks run each card not yet selected (leaders and stratagems excluded).
 *
 * `most` surfaces staples; `least` surfaces cards only a few decks run (tech or "gotcha" cards).
 *
 * @param decks - Currently matching decks
 * @param exclude - Cards already selected
 * @param order - `most` (default) or `least` common first; ties break by card ID
 * @returns `[cardId, deckCount]`
 */
export function cardFrequency(
  decks: IndexedDeck[],
  exclude: number[],
  order: 'most' | 'least' = 'most',
): [number, number][] {
  const skip = new Set(exclude)
  const counts = new Map<number, number>()
  for (const e of decks) {
    for (const id of e.ids) if (!skip.has(id) && id !== e.leader && id !== e.stratagem) count(counts, id)
  }
  const dir = order === 'most' ? -1 : 1
  return [...counts].sort((a, b) => dir * (a[1] - b[1]) || a[0] - b[0])
}
