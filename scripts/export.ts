/**
 * Writes the deck data as spreadsheets for anyone's own analysis: decks.csv, deck-cards.csv, cards.csv (names in all
 * 11 languages), card-pairs.csv (cards played together, and how much more often than chance), a report per leader in
 * each language, manifest.json, and a README in each language. Uses the local data, so pull or `pnpm build:data`
 * first. Not part of a release: run it and zip the folder to share.
 *
 * Run: `pnpm export [--out <folder>]` (default: gwent-deck-data/, gitignored). The folder is emptied first, so it
 * must be new or an earlier export (one with a manifest.json); any other folder stops the run.
 */
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { consola } from 'consola'
import { LANGUAGES } from '../src/i18n.ts'
import { cliArgs, readAnalysisData } from './lib/analysis.ts'
import { cardPairsCsv, cardsCsv, deckCardsCsv, decksCsv, leaderReports, manifest } from './lib/export.ts'
import { exportReadme } from './lib/export-readme.ts'

const USAGE = 'pnpm export [--out <folder>]  (a new folder, or an earlier export: it is emptied first)'
const {
  values: { out },
} = cliArgs({ out: { type: 'string', default: 'gwent-deck-data' } }, USAGE)
// Only an earlier export (it has a manifest) is emptied, so a mistyped --out can't delete anything else.
if (existsSync(out) && !existsSync(join(out, 'manifest.json'))) {
  consola.error(`${out} exists and isn't an earlier export (no manifest.json); pick a new folder.\nUsage: ${USAGE}`)
  process.exit(2)
}
const data = await readAnalysisData()
const m = manifest(data)
await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
const files: [string, string][] = [
  ['decks.csv', decksCsv(data)],
  ['deck-cards.csv', deckCardsCsv(data)],
  ['cards.csv', cardsCsv(data)],
  ['card-pairs.csv', cardPairsCsv(data)],
  ['manifest.json', `${JSON.stringify(m, null, 2)}\n`],
  ...LANGUAGES.map((l): [string, string] => [l === 'en' ? 'README.md' : `README.${l}.md`, exportReadme(l, m)]),
]
for (const [name, text] of files) await writeFile(join(out, name), text)
let reports = 0
for (const lang of LANGUAGES) {
  const dir = join(out, 'leaders', lang)
  await mkdir(dir, { recursive: true })
  for (const [name, text] of leaderReports(data, lang)) {
    await writeFile(join(dir, name), text)
    reports++
  }
}
consola.success(
  `Wrote ${out}/: ${m.decks} decks, ${m.cards} cards, ${reports} leader reports (${m.leaders} × 11 languages)`,
)
