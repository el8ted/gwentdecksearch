/**
 * Prints a polite Reddit reply (Markdown) for a shared playgwent deck: its gameplay video and, if it's over today's
 * provision limit, the close decks that still fit, linked into Gwent Deck Search. Prints nothing, and says why, when
 * there's nothing useful to add. Uses the local data/decks.json, so run `pnpm build:data` (or pull) first.
 *
 * Run: `pnpm reddit <playgwent.com deck or guide link> [--author]`, then copy the output into a Reddit comment.
 * `--author` adds a line saying you made the site: only for its author.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { consola } from 'consola'
import { indexDecks } from '../src/filter.ts'
import type { Dataset } from '../src/types.ts'
import { redditReply } from './lib/reddit.ts'

const args = process.argv.slice(2)
const url = args.find((a) => !a.startsWith('--'))
if (!url) {
  consola.error('Usage: pnpm reddit <playgwent.com deck or guide link> [--author]')
  process.exit(2)
}
const data: Dataset = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'data', 'decks.json'), 'utf8'))
const reply = redditReply(data, indexDecks(data), url, { author: args.includes('--author') })
if (!reply.ok) {
  consola.warn(reply.reason)
  process.exit(1)
}
console.log(reply.markdown)
