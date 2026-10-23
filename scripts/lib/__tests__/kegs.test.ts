import { describe, expect, it } from 'vitest'
import type { IndexedDeck } from '../../../src/filter.ts'
import type { Dataset } from '../../../src/types.ts'
import {
  CRAFT,
  cardsIn,
  kegPools,
  kegValue,
  MILL,
  type Owned,
  openKeg,
  playedCards,
  type Rng,
  seeded,
  simulate,
} from '../kegs.ts'
import type { CatalogCard } from '../store.ts'

const card = (faction: CatalogCard['faction'], rarity: number, type: CatalogCard['type'] = 'unit'): CatalogCard => ({
  name: 'x',
  type,
  faction,
  provisions: 5,
  craftingCost: 0,
  rarity,
})
// Rarity codes: 5 common, 15 rare, 20 epic, 25 legendary.
const CATALOG: Record<string, CatalogCard> = {
  1: card('MO', 25, 'leader'),
  2: card('MO', 25, 'stratagem'),
  10: card('MO', 5),
  11: card('MO', 15),
  12: card('MO', 20),
  13: card('MO', 25),
  20: card('NE', 5),
  21: card('NE', 15),
  22: card('NE', 20),
  23: card('NE', 25),
  // Syndicate, also playable in Monsters decks.
  30: { ...card('SY', 15), secondaryFaction: 'MO' },
}
const { pools, rarity } = kegPools(CATALOG)
/** Replays fixed numbers, then repeats the last. */
const fixed =
  (...xs: number[]): Rng =>
  () =>
    xs.length > 1 ? (xs.shift() as number) : xs[0]

describe('kegPools', () => {
  it('sorts cards by keg and rarity, leaving out leaders and stratagems', () => {
    // Assert
    expect(pools.MO).toEqual({ common: [10], rare: [11], epic: [12], legendary: [13] })
    expect(pools.ALL?.common).toEqual([10, 20])
  })
})

describe('playedCards', () => {
  it("measures a card against the decks that could run it: its factions', or every deck for a neutral", () => {
    // Arrange: two MO decks and two SK decks; 10 is in 1 of 2 MO decks, 20 in 1 of 4 decks, 1 is a leader; 30 is a
    // Syndicate card also playable in Monsters, so it's in 1 of the 2 decks (no Syndicate ones) that could run it
    const deck = (faction: IndexedDeck['faction'], ids: number[]) =>
      ({ faction, leader: 1, stratagem: 2, deck: { cards: ids.map((id) => [id, 1]) } }) as unknown as IndexedDeck
    const decks = [deck('MO', [1, 10, 20, 30]), deck('MO', [1, 11]), deck('SK', []), deck('SK', [])]
    const data = { decks, catalog: CATALOG, dataset: { cards: CATALOG } as unknown as Dataset }

    // Act
    const [half, quarter] = [0.5, 0.25].map((s) => playedCards(data, rarity, s))

    // Assert
    expect(half).toEqual(new Set([10, 11, 30]))
    expect(quarter).toEqual(new Set([10, 11, 20, 30]))
  })
})

describe('seeded', () => {
  it('repeats for a seed and stays in [0, 1)', () => {
    // Act
    const [a, b] = [seeded(7), seeded(7)]
    const xs = Array.from({ length: 100 }, a)

    // Assert
    expect(xs).toEqual(Array.from({ length: 100 }, b))
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
  })
})

describe('openKeg', () => {
  it('values wanted new copies at craft cost and the rest at mill value', () => {
    // Arrange: four commons (0.0), then a rare pick (0.0)
    const owned: Owned = new Map()

    // Act
    const value = openKeg(pools.MO ?? fail(), owned, new Set([10, 11]), false, fixed(0))

    // Assert: 2 new commons, 2 spare commons, 1 new rare
    expect(value).toBe(2 * CRAFT.common + 2 * MILL.common + CRAFT.rare)
    expect(owned).toEqual(
      new Map([
        [10, 2],
        [11, 1],
      ]),
    )
  })

  it('makes one of four commons rare at Prestige 1', () => {
    // Act
    const value = openKeg(pools.MO ?? fail(), new Map(), new Set(), true, fixed(0))

    // Assert: nothing wanted, so all mill value
    expect(value).toBe(3 * MILL.common + 2 * MILL.rare)
  })

  it('picks a legendary at the top of the odds', () => {
    // Act
    const value = openKeg(pools.MO ?? fail(), new Map(), new Set([13]), false, fixed(0.99999))

    // Assert: the first four roll legendary too, so one new copy and four spares
    expect(value).toBe(CRAFT.legendary + 4 * MILL.legendary)
  })
})

describe('kegValue', () => {
  it('drops as the collection fills, and to mill value once everything is owned', () => {
    // Arrange
    const wanted = new Set([10, 11, 12, 13])
    const full: Owned = new Map([
      [10, 2],
      [11, 2],
      [12, 1],
      [13, 1],
    ])

    // Act
    const [fresh, done] = [
      kegValue(pools.MO ?? fail(), new Map(), wanted, false),
      kegValue(pools.MO ?? fail(), full, wanted, false),
    ]

    // Assert
    expect(fresh).toBeGreaterThan(250)
    expect(done).toBeCloseTo(
      4 * (0.892 * 10 + 0.095 * 20 + 0.01 * 50 + 0.003 * 200) + 0.78 * 20 + 0.175 * 50 + 0.045 * 200,
    )
  })

  it('adds the Prestige 1 rare', () => {
    // Act
    const [plain, p1] = [false, true].map((p) => kegValue(pools.MO ?? fail(), new Map(), new Set([10, 11]), p))

    // Assert
    expect(p1).toBeGreaterThan(plain)
  })
})

describe('simulate', () => {
  it('fills a small pool, tracking milestones and the keg mix', () => {
    // Act
    const r = simulate(
      pools,
      { plan: { best: ['MO', 'NE'] }, wanted: cardsIn(pools, ['MO', 'NE']), kegs: 30, players: 5, track: 'MO' },
      seeded(1),
    )

    // Assert
    expect(r.value).toHaveLength(30)
    expect(r.bronzes).toBeLessThanOrEqual(30)
    expect(r.halfGolds).toBeLessThanOrEqual(30)
    expect((r.mix[0].MO ?? 0) + (r.mix[0].NE ?? 0)).toBeCloseTo(25)
  })

  it('reports a milestone not reached as undefined', () => {
    // Act
    const r = simulate(
      pools,
      { plan: { always: 'NE' }, wanted: cardsIn(pools, ['MO']), kegs: 3, players: 2, track: 'MO' },
      seeded(1),
    )

    // Assert
    expect(r.bronzes).toBeUndefined()
  })

  it('throws for a keg with no cards', () => {
    // Act / Assert
    expect(() =>
      simulate(pools, { plan: { always: 'SK' }, wanted: new Set(), kegs: 1, players: 1 }, seeded(1)),
    ).toThrow('SK')
  })
})

function fail(): never {
  throw new Error('missing pool')
}
