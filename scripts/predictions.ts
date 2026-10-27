/**
 * Reads a Balance Council predictions sheet (streamers' merged list of the changes they expect to pass, a column per
 * ballot list) and writes it as a ballot for `pnpm whatif`: every card unranked, with who recommended it kept as a
 * comment. Names are resolved as `pnpm poll` does: in full when exactly one card matches, else asked about in a
 * terminal, else left for `pnpm whatif`.
 *
 * Run: `pnpm predictions <sheet link> [--out <file>]`. The link's `gid` picks the tab. Writes
 * data/cache/polls/<title>-<date>.txt (local only) unless `--out` says otherwise, then prints the `pnpm whatif` command.
 */
import { consola } from 'consola'
import { cliArgs, readAnalysisData } from './lib/analysis.ts'
import { sheetCsv } from './lib/entries.ts'
import { createPoliteFetch } from './lib/polite-fetch.ts'
import { saveBallot } from './lib/poll.ts'
import { parsePredictions, sheetRef } from './lib/predictions.ts'

const USAGE = 'pnpm predictions <Google Sheet link (docs.google.com/spreadsheets/d/…)> [--out <file>]'
const {
  values: { out },
  positionals: [url],
} = cliArgs({ out: { type: 'string' } }, USAGE)
const ref = url ? sheetRef(url) : undefined
if (!url || !ref) {
  consola.error(`Usage: ${USAGE}`)
  process.exit(2)
}
// Google's robots.txt allows /spreadsheet… with a one-second crawl delay.
const get = createPoliteFetch({ 'docs.google.com': 1_000 })
const poll = parsePredictions(await get(sheetCsv(ref.id, ref.gid)))
await saveBallot(poll, url, await readAnalysisData(), { out, source: 'sheet', poll: false })
