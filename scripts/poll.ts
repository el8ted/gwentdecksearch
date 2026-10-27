/**
 * Reads a Balance Council poll from a Google Form and writes it as a ballot for `pnpm whatif`: the form's power and
 * provision lists, every option unranked, its notes kept as comments. A name is written in full only when exactly
 * one card matches it; in a terminal, the rest are asked about (pick a suggestion, type the card or skip the line),
 * else they stay as written, for `pnpm whatif` to ask about or stop on.
 *
 * Run: `pnpm poll <form link> [--out <file>]`. Writes data/cache/polls/<title>-<date>.txt (local only) unless `--out`
 * says otherwise, then prints the `pnpm whatif` command to run on it.
 */
import { consola } from 'consola'
import { cliArgs, readAnalysisData } from './lib/analysis.ts'
import { createPoliteFetch } from './lib/polite-fetch.ts'
import { isFormUrl, parseForm, saveBallot } from './lib/poll.ts'

const USAGE = 'pnpm poll <Google Form link (docs.google.com/forms/… or forms.gle/…)> [--out <file>]'
const {
  values: { out },
  positionals: [url],
} = cliArgs({ out: { type: 'string' } }, USAGE)
if (!url || !isFormUrl(url)) {
  consola.error(`Usage: ${USAGE}`)
  process.exit(2)
}
// Google's robots.txt allows /forms with a one-second crawl delay.
const get = createPoliteFetch({ 'docs.google.com': 1_000, 'forms.gle': 1_000 })
const poll = parseForm(await get(url))
await saveBallot(poll, url, await readAnalysisData(), { out })
