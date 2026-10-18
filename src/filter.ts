import type { Card, Dataset, Deck, Faction, Source } from './types.ts'

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
  leader?: number
  stratagem?: number
  cards: number[]
  /** Deck must contain every selected card (`all`, default) or at least one (`any`). */
  match?: 'all' | 'any'
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
}

/**
 * Precomputes leader, stratagem, faction and card set per deck.
 *
 * @param data - The dataset
 * @returns One entry per deck, in dataset order
 * @throws {Error} If a deck lacks a leader or stratagem (the scraper guarantees both)
 */
export function indexDecks(data: Dataset): IndexedDeck[] {
  return data.decks.map((deck) => {
    const ofType = (type: Card['type']) => deck.cards.find(([id]) => data.cards[id]?.type === type)?.[0]
    const leader = ofType('leader')
    const stratagem = ofType('stratagem')
    if (leader === undefined || stratagem === undefined) throw new Error(`Deck ${deck.id} lacks a leader/stratagem`)
    // Faction comes from the leader: stratagems and many cards are neutral.
    const faction = data.cards[leader].faction
    const budget = budgetOf(provisionStatus({ deck, leader }, data.cards).delta)
    return { deck, leader, stratagem, faction, budget, ids: new Set(deck.cards.map(([id]) => id)) }
  })
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

/** How many of the selected cards a deck contains. */
function hits(e: IndexedDeck, cards: number[]): number {
  return cards.reduce((n, id) => n + (e.ids.has(id) ? 1 : 0), 0)
}

/** Whether a deck contains the selected cards: all of them, or at least one with `match: 'any'`. */
function hasCards(e: IndexedDeck, s: FilterState): boolean {
  if (s.cards.length === 0) return true
  const n = hits(e, s.cards)
  return s.match === 'any' ? n > 0 : n === s.cards.length
}

function matchesBase(
  e: IndexedDeck,
  s: Pick<FilterState, 'factions' | 'sources' | 'budgets' | 'leader' | 'stratagem'>,
): boolean {
  return (
    (!s.sources?.length || e.deck.sources.some((src) => s.sources?.includes(src))) &&
    (!s.budgets?.length || s.budgets.includes(e.budget)) &&
    (s.factions.length === 0 || s.factions.includes(e.faction)) &&
    (s.leader === undefined || e.leader === s.leader) &&
    (s.stratagem === undefined || e.stratagem === s.stratagem)
  )
}

/**
 * Decks matching every filter, sorted by name (then ID, so same-name alternates stay together). With
 * `match: 'any'`, decks containing more of the selected cards come first.
 *
 * @param decks - Indexed decks
 * @param state - Current filters
 * @returns Matching decks
 */
export function matchDecks(decks: IndexedDeck[], state: FilterState): IndexedDeck[] {
  const byName = (a: IndexedDeck, b: IndexedDeck) =>
    a.deck.name.localeCompare(b.deck.name) || a.deck.id.localeCompare(b.deck.id)
  const matched = decks.filter((e) => matchesBase(e, state) && hasCards(e, state))
  if (state.match !== 'any') return matched.sort(byName)
  // Counted once per deck, not once per comparison.
  return matched
    .map((e) => [hits(e, state.cards), e] as const)
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
 * @returns Counts per faction, source, leader, stratagem and (non-leader, non-stratagem) card
 */
export function facets(decks: IndexedDeck[], state: FilterState): Facets {
  const keep = (e: IndexedDeck, s: Partial<FilterState>) => matchesBase(e, { ...state, ...s }) && hasCards(e, state)
  const result: Facets = {
    factions: new Map(),
    sources: new Map(),
    budgets: new Map(),
    leaders: new Map(),
    stratagems: new Map(),
    cards: new Map(),
  }
  for (const e of decks) {
    if (keep(e, { factions: [] })) count(result.factions, e.faction)
    if (keep(e, { sources: [] })) for (const src of e.deck.sources) count(result.sources, src)
    if (keep(e, { budgets: [] })) count(result.budgets, e.budget)
    if (keep(e, { leader: undefined })) count(result.leaders, e.leader)
    if (keep(e, { stratagem: undefined })) count(result.stratagems, e.stratagem)
    if (keep(e, {})) for (const id of e.ids) if (id !== e.leader && id !== e.stratagem) count(result.cards, id)
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
