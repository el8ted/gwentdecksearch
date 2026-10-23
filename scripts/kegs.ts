/**
 * Prints, as Markdown tables, what each kind of keg is worth as a collection fills: the numbers behind the keg-buying
 * guide. A card counts at its craft cost while it's a copy you want and don't have, else at its mill value. "Want"
 * is shown two ways: every card in the pools you play, and only the cards published decks run (data/decks.json, so
 * pull or `pnpm build:data` first). Seeded, so a rerun prints the same numbers until the data changes.
 *
 * Run: `pnpm kegs [faction]` (default MO; any of MO NG NR SK ST SY).
 */
import { consola } from 'consola'
import { FACTIONS, type Faction } from '../src/types.ts'
import { readAnalysisData } from './lib/analysis.ts'
import { cardsIn, type Keg, kegPools, type Plan, playedCards, seeded, simulate } from './lib/kegs.ts'

const faction = (process.argv[2] ?? 'MO').toUpperCase() as Faction
if (!FACTIONS.includes(faction)) {
  consola.error(`Usage: pnpm kegs [${FACTIONS.join('|')}]`)
  process.exit(2)
}
const data = await readAnalysisData()
const { pools, rarity } = kegPools(data.catalog)
const KEGS = 300
const WINDOWS = [
  [1, 10],
  [11, 25],
  [26, 50],
  [51, 100],
  [101, 150],
  [151, 200],
  [201, 300],
]
const all = Object.keys(pools).filter((k) => k !== 'ALL') as Keg[]
const mine: Keg[] = [faction, 'NE']
const VIEWS: [string, Set<number> | undefined][] = [
  ['You want every card', undefined],
  ...[0.01, 0.05].map((s): [string, Set<number>] => [
    `You want cards in at least ${s * 100}% of the ${data.decks.length} published decks that could run them`,
    playedCards(data, rarity, s),
  ]),
]
const fmt = (n: number | undefined) => n ?? `>${KEGS}`

console.log(`Pool sizes: ${all.map((k) => `${k} ${cardsIn(pools, [k]).size}`).join(', ')}`)
for (const [title, played] of VIEWS) {
  const want = (kegs: Keg[]) => {
    const pool = cardsIn(pools, kegs)
    return played ? new Set([...pool].filter((id) => played.has(id))) : pool
  }
  const rows: [string, Plan, Set<number>, boolean][] = [
    ['Faction kegs', { always: faction }, want([faction]), false],
    ['Faction kegs at Prestige 1', { always: faction }, want([faction]), true],
    ['Best of faction/neutral', { best: mine }, want(mine), false],
    ['Best of faction/neutral at P1', { best: mine }, want(mine), true],
    ['General kegs (you play 1 faction)', { always: 'ALL' }, want(mine), false],
    ['General kegs (you play everything)', { always: 'ALL' }, want(all), false],
  ]
  const counts = mine.map((k) => `${k} ${want([k]).size}`).join(', ')
  console.log(`\n### ${title}\n\nWanted cards: ${counts}\n`)
  console.log(`| Kegs opened | ${WINDOWS.map(([a, b]) => `${a}–${b}`).join(' | ')} | All bronzes | Half golds |`)
  console.log(`|---|${WINDOWS.map(() => '---:').join('|')}|---:|---:|`)
  let mix: ReturnType<typeof simulate>['mix'] = []
  for (const [name, plan, wanted, prestige] of rows) {
    const r = simulate(pools, { plan, wanted, kegs: KEGS, players: 200, prestige, track: faction }, seeded(1))
    const mean = WINDOWS.map(([a, b]) => Math.round(r.value.slice(a - 1, b).reduce((s, v) => s + v, 0) / (b - a + 1)))
    console.log(`| ${name} | ${mean.join(' | ')} | ${fmt(r.bronzes)} | ${fmt(r.halfGolds)} |`)
    if (name === 'Best of faction/neutral') mix = r.mix
  }
  console.log(`\nBest of faction/neutral, mean kegs per block of 25:\n`)
  console.log(`| Kegs | ${mix.map((_, i) => `${i * 25 + 1}–${i * 25 + 25}`).join(' | ')} |`)
  console.log(`|---|${mix.map(() => '---:').join('|')}|`)
  for (const k of mine) console.log(`| ${k} | ${mix.map((m) => (m[k] ?? 0).toFixed(1)).join(' | ')} |`)
}
