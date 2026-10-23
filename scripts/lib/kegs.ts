import { craftList } from '../../src/filter.ts'
import { type Faction, RARITIES, type Rarity } from '../../src/types.ts'
import { type AnalysisData, factionScope } from './analysis.ts'
import { rarityOf } from './cards.ts'
import type { CatalogCard } from './store.ts'

/** Scraps to craft one copy, by rarity. */
export const CRAFT: Record<Rarity, number> = { common: 30, rare: 80, epic: 200, legendary: 800 }
/** Scraps for milling a spare copy, by rarity. */
export const MILL: Record<Rarity, number> = { common: 10, rare: 20, epic: 50, legendary: 200 }
/** Copies a deck can run: commons and rares are bronze (2), epics and legendaries gold (1). */
export const COPIES: Record<Rarity, number> = { common: 2, rare: 2, epic: 1, legendary: 1 }

/**
 * Rarity odds per card. CDPR publishes only per-keg rates (rare or better 100%, epic or better 26.2%, legendary 5.5%),
 * so these per-card splits are fitted to them, not official.
 */
export const ODDS = {
  /** Each of the first four cards. */
  slot: { common: 0.892, rare: 0.095, epic: 0.01, legendary: 0.003 },
  /** The fifth card, picked from three of one rarity. */
  pick: { common: 0, rare: 0.78, epic: 0.175, legendary: 0.045 },
} satisfies Record<string, Record<Rarity, number>>

/** A keg's card pool: a faction's (faction kegs), `NE` (neutral kegs) or `ALL` (general kegs). */
export type Keg = Faction | 'ALL'
/** Card IDs per rarity, for each kind of keg. */
export type Pools = Partial<Record<Keg, Record<Rarity, number[]>>>
/** Copies owned, by card ID. */
export type Owned = Map<number, number>
/** Returns a number in [0, 1), like `Math.random`. */
export type Rng = () => number

/**
 * Sorts the catalog into keg pools. Leaders and stratagems never come from kegs.
 *
 * @param catalog - The card catalog (`data/source/cards.json`)
 * @returns The pools, and each card's rarity
 */
export function kegPools(catalog: Record<string, CatalogCard>): { pools: Pools; rarity: Map<number, Rarity> } {
  const pools: Pools = {}
  const rarity = new Map<number, Rarity>()
  for (const [key, card] of Object.entries(catalog)) {
    if (card.type === 'leader' || card.type === 'stratagem') continue
    const id = Number(key)
    const r = rarityOf(card.rarity, id)
    rarity.set(id, r)
    for (const keg of [card.faction, 'ALL'] as const) {
      pools[keg] ??= { common: [], rare: [], epic: [], legendary: [] }
      pools[keg][r].push(id)
    }
  }
  return { pools, rarity }
}

/**
 * Every card in the given kegs' pools: the "you want every card" view of a collection.
 *
 * @param pools - From {@link kegPools}
 * @param kegs - Pools to take
 * @returns Their card IDs
 */
export function cardsIn(pools: Pools, kegs: Keg[]): Set<number> {
  return new Set(kegs.flatMap((k) => RARITIES.flatMap((r) => pools[k]?.[r] ?? [])))
}

/**
 * Cards the published decks actually play: the "you want what decks use" view of a collection.
 *
 * A card is measured against the decks that could run it ({@link factionScope}): its faction's, both for a
 * dual-faction card, every deck for a neutral.
 *
 * @param data - Published decks, card catalog and the site's card data (decks per card are counted as the Craft list
 *   counts them)
 * @param rarity - Each keg card's rarity, from {@link kegPools}; other cards (leaders, stratagems) are skipped
 * @param share - Smallest share of the decks that could run a card it must be in, e.g. 0.05
 * @returns The played card IDs
 */
export function playedCards(
  data: Pick<AnalysisData, 'decks' | 'catalog' | 'dataset'>,
  rarity: Map<number, Rarity>,
  share: number,
): Set<number> {
  const { decksThatCould } = factionScope(data)
  const played = new Set<number>()
  for (const { id, decks: n } of craftList(data.decks, [], data.dataset.cards)) {
    if (rarity.has(id) && n >= share * decksThatCould(id)) played.add(id)
  }
  return played
}

/**
 * A seeded generator, so a run prints the same numbers every time (mulberry32).
 *
 * @param seed - Any integer
 * @returns The generator
 */
export function seeded(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

function roll(odds: Record<Rarity, number>, rng: Rng): Rarity {
  let x = rng()
  for (const r of RARITIES) {
    x -= odds[r]
    if (x < 0) return r
  }
  return 'legendary'
}

/** What a card is worth to you: its craft cost while you want another copy, else what it mills for. */
function take(id: number, r: Rarity, owned: Owned, wanted: Set<number>): number {
  const n = owned.get(id) ?? 0
  if (!wanted.has(id) || n >= COPIES[r]) return MILL[r]
  owned.set(id, n + 1)
  return CRAFT[r]
}

/**
 * Opens one keg: four random cards, then the best of three offered cards of one rarity (one you still want, if any).
 *
 * @param pool - The keg's pool
 * @param owned - The collection, updated in place
 * @param wanted - Cards you'd play; the rest only count for their mill value
 * @param prestige - Prestige 1 or higher: at least one rare among the first four
 * @param rng - Random source
 * @returns The keg's value in scraps
 */
export function openKeg(
  pool: Record<Rarity, number[]>,
  owned: Owned,
  wanted: Set<number>,
  prestige: boolean,
  rng: Rng,
): number {
  const four = [0, 1, 2, 3].map(() => roll(ODDS.slot, rng))
  // `every` would narrow `four` to commons, so test the opposite.
  if (prestige && !four.some((r) => r !== 'common')) four[0] = 'rare'
  let value = 0
  for (const r of four) value += take(pool[r][Math.floor(rng() * pool[r].length)], r, owned, wanted)
  const r = roll(ODDS.pick, rng)
  const offer = sample(pool[r], 3, rng)
  const need = offer.find((id) => wanted.has(id) && (owned.get(id) ?? 0) < COPIES[r])
  return value + take(need ?? offer[0], r, owned, wanted)
}

function sample(ids: number[], n: number, rng: Rng): number[] {
  const copy = [...ids]
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const j = i + Math.floor(rng() * (copy.length - i))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

/**
 * The expected value of the next keg from a pool: exact for the four random cards, and for the pick treats the three
 * offers as independent draws.
 *
 * @param pool - The keg's pool
 * @param owned - The collection
 * @param wanted - Cards you'd play
 * @param prestige - Prestige 1 or higher
 * @returns Expected value in scraps
 */
export function kegValue(pool: Record<Rarity, number[]>, owned: Owned, wanted: Set<number>, prestige: boolean): number {
  const fresh = (r: Rarity) =>
    pool[r].length
      ? pool[r].filter((id) => wanted.has(id) && (owned.get(id) ?? 0) < COPIES[r]).length / pool[r].length
      : 0
  const slot = (r: Rarity) => fresh(r) * CRAFT[r] + (1 - fresh(r)) * MILL[r]
  let value = 4 * RARITIES.reduce((sum, r) => sum + ODDS.slot[r] * slot(r), 0)
  if (prestige) value += ODDS.slot.common ** 4 * (slot('rare') - slot('common'))
  for (const r of RARITIES) {
    const any = 1 - (1 - fresh(r)) ** 3
    value += ODDS.pick[r] * (any * CRAFT[r] + (1 - any) * MILL[r])
  }
  return value
}

/** How one simulated player picks kegs: always the same one, or whichever is worth most right now. */
export type Plan = { always: Keg } | { best: Keg[] }

/** Averages over many simulated players. */
export interface SimResult {
  /** Mean value of keg #k (index k - 1), in scraps. */
  value: number[]
  /** Mean kegs of each type opened, per block of 25. */
  mix: Partial<Record<Keg, number>>[]
  /** Median kegs until every wanted bronze of `track` is owned twice; `undefined` if not within the run. */
  bronzes?: number
  /** Median kegs until half the wanted golds of `track` are owned. */
  halfGolds?: number
}

/**
 * Simulates players opening kegs from an empty collection.
 *
 * @param pools - From {@link kegPools}
 * @param opts - What to buy, the cards you want, how many kegs and players, and the faction to track milestones for
 * @param rng - Random source
 * @returns Averages per keg
 */
export function simulate(
  pools: Pools,
  opts: { plan: Plan; wanted: Set<number>; kegs: number; players: number; prestige?: boolean; track?: Faction },
  rng: Rng,
): SimResult {
  const pool = (k: Keg) => {
    const p = pools[k]
    if (!p) throw new Error(`No cards for keg ${k}`)
    return p
  }
  const { wanted } = opts
  const track = opts.track && pool(opts.track)
  const bronze = track ? [...track.common, ...track.rare].filter((id) => wanted.has(id)) : []
  const gold = track ? [...track.epic, ...track.legendary].filter((id) => wanted.has(id)) : []
  const value = Array<number>(opts.kegs).fill(0)
  const mix: Partial<Record<Keg, number>>[] = Array.from({ length: Math.ceil(opts.kegs / 25) }, () => ({}))
  const bronzes: number[] = []
  const halfGolds: number[] = []
  for (let p = 0; p < opts.players; p++) {
    const owned: Owned = new Map()
    let b = Infinity
    let g = Infinity
    for (let k = 0; k < opts.kegs; k++) {
      const plan = opts.plan
      const keg =
        'always' in plan
          ? plan.always
          : plan.best.reduce((a, c) =>
              kegValue(pool(c), owned, wanted, !!opts.prestige) > kegValue(pool(a), owned, wanted, !!opts.prestige)
                ? c
                : a,
            )
      const block = mix[Math.floor(k / 25)]
      block[keg] = (block[keg] ?? 0) + 1 / opts.players
      value[k] += openKeg(pool(keg), owned, wanted, !!opts.prestige, rng) / opts.players
      if (track && b === Infinity && bronze.every((id) => (owned.get(id) ?? 0) >= 2)) b = k + 1
      if (track && g === Infinity && gold.filter((id) => owned.has(id)).length * 2 >= gold.length) g = k + 1
    }
    bronzes.push(b)
    halfGolds.push(g)
  }
  const median = (xs: number[]) => {
    const m = xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)]
    return Number.isFinite(m) ? m : undefined
  }
  return { value, mix, ...(track && { bronzes: median(bronzes), halfGolds: median(halfGolds) }) }
}
