/**
 * Reads a Balance Council poll from a Google Form and writes it as a ballot for `pnpm whatif`: the form's power and
 * provision lists, every option unranked, its notes kept as comments. A name is written in full only when exactly
 * one card matches it; the rest stay as written, for `pnpm whatif` to stop on with suggestions.
 *
 * Run: `pnpm poll <form link> [--out <file>]`. Writes data/cache/polls/<title>-<date>.txt (local only) unless `--out`
 * says otherwise, then prints the `pnpm whatif` command to run on it.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { consola } from 'consola'
import { readAnalysisData } from './lib/analysis.ts'
import { createPoliteFetch } from './lib/polite-fetch.ts'
import { isFormUrl, parseForm, pollBallot, pollFileName } from './lib/poll.ts'

const args = process.argv.slice(2)
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : undefined
const url = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')
if (!url || !isFormUrl(url)) {
  consola.error('Usage: pnpm poll <Google Form link (docs.google.com/forms/… or forms.gle/…)> [--out <file>]')
  process.exit(2)
}
// Google's robots.txt allows /forms with a one-second crawl delay.
const get = createPoliteFetch({ 'docs.google.com': 1_000, 'forms.gle': 1_000 })
const poll = parseForm(await get(url))
const date = new Date().toISOString().slice(0, 10)
const file = out ?? join('data/cache/polls', pollFileName(poll.title, date))
const text = pollBallot(poll, url, date, await readAnalysisData())
await mkdir(dirname(file), { recursive: true })
await writeFile(file, text)
const counts = poll.lists.map((l) => `${l.category.name} ${l.options.length}`).join(', ')
if (poll.skipped.length) consola.info(`Skipped questions that aren't a ballot list: ${poll.skipped.join(' · ')}`)
consola.success(`${poll.title}: ${counts}. Wrote ${file}\nNext: pnpm whatif "${file}"`)
