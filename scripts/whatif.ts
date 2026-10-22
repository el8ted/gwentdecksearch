/**
 * Prints what a Balance Council ballot would do to the published decks, as Markdown: per change and all together,
 * decks pushed over today's limit or brought back within it by provision changes, and the decks power changes touch,
 * with their leaders and half-years. Uses the local data, so pull or `pnpm build:data` first.
 *
 * Run: `pnpm whatif <ballot file> [--detail] [--lang <code>]`. Start from scripts/examples/ballot-template.txt:
 * four lists (power and provision, increase and decrease) of ranked picks, cards by name in any of the site's
 * languages or by ID. A name that could mean more than one card stops the run and lists them; nothing is guessed.
 * The report is one table, a row per change; `--detail` adds a section per change. `--lang` shows card names in that
 * language too (e.g. `--lang zh-cn`). See scripts/README.md.
 */
import { readFile } from 'node:fs/promises'
import { consola } from 'consola'
import { readAnalysisData } from './lib/analysis.ts'
import { parseChanges, whatifReport } from './lib/whatif.ts'

const args = process.argv.slice(2)
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'en'
const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--lang')
if (!file) {
  consola.error('Usage: pnpm whatif <ballot file> [--detail] [--lang <code>]')
  process.exit(2)
}
const data = await readAnalysisData()
if (lang !== 'en' && !data.names[lang]) {
  consola.error(`No card names in "${lang}"; try one of: ${Object.keys(data.names).join(', ')}`)
  process.exit(2)
}
const parsed = parseChanges(await readFile(file, 'utf8'), data, lang)
if (!parsed.ok) {
  consola.error(`Fix these lines and run again:\n${parsed.errors.join('\n')}`)
  process.exit(1)
}
if (!parsed.changes.length) {
  consola.error(`No cards in ${file}: fill in the slots (see scripts/examples/ballot-template.txt)`)
  process.exit(1)
}
console.log(whatifReport(data, parsed.changes, lang, { poll: parsed.poll, detail: args.includes('--detail') }))
