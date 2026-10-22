/**
 * Prints a package report as Markdown: the decks built around a card, several cards or a deck-builder tag, who plays
 * them (factions, leaders), when (decks per half-year), how many are within today's limit or have a video, and the
 * cards that go with them. Uses the local data, so pull or `pnpm build:data` first.
 *
 * Run: `pnpm package <card…> [--min <n>] [--lang <code>]`, or `pnpm package tag:<tag> [--lang <code>]`. Cards by name
 * in any of the site's languages (quote names with spaces) or by ID; with several cards, `--min` is how many a deck
 * needs (default: all). Tags by key or name, e.g. `tag:defender`. A name that could mean more than one card stops the
 * run and lists them.
 */
import { consola } from 'consola'
import { readAnalysisData } from './lib/analysis.ts'
import { packageReport, parseSeed } from './lib/packages.ts'

const args = process.argv.slice(2)
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const lang = option('--lang') ?? 'en'
const min = option('--min')
const seeds = args.filter((a, i) => !a.startsWith('--') && !['--lang', '--min'].includes(args[i - 1]))
if (!seeds.length) {
  consola.error('Usage: pnpm package <card…> [--min <n>] [--lang <code>]  or  pnpm package tag:<tag>')
  process.exit(2)
}
const data = await readAnalysisData()
if (lang !== 'en' && !data.names[lang]) {
  consola.error(`No card names in "${lang}"; try one of: ${Object.keys(data.names).join(', ')}`)
  process.exit(2)
}
const parsed = parseSeed(seeds, min === undefined ? undefined : Number(min), data, lang)
if (!parsed.ok) {
  consola.error(`Fix and run again:\n${parsed.errors.join('\n')}`)
  process.exit(1)
}
console.log(packageReport(data, parsed.seed, lang))
