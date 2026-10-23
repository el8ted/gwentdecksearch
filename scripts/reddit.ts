/**
 * Prints a polite Reddit reply (Markdown) for a shared playgwent deck: its gameplay video and, if it's over today's
 * provision limit, the close decks that still fit, linked into Gwent Deck Search. Prints nothing, and says why, when
 * there's nothing useful to add. Uses the local data/decks.json, so run `pnpm build:data` (or pull) first.
 *
 * Run: `pnpm reddit <playgwent.com deck or guide link> [--author]`, then copy the output into a Reddit comment.
 * `--author` adds a line saying you made the site: only for its author.
 */
import { consola } from 'consola'
import { cliArgs, readAnalysisData } from './lib/analysis.ts'
import { redditReply } from './lib/reddit.ts'

const USAGE = 'pnpm reddit <playgwent.com deck or guide link> [--author]'
const {
  values: { author },
  positionals: [url],
} = cliArgs({ author: { type: 'boolean', default: false } }, USAGE)
if (!url) {
  consola.error(`Usage: ${USAGE}`)
  process.exit(2)
}
const { dataset, decks } = await readAnalysisData()
const reply = redditReply(dataset, decks, url, { author })
if (!reply.ok) {
  consola.warn(reply.reason)
  process.exit(1)
}
console.log(reply.markdown)
