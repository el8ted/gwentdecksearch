/**
 * Release helpers for the workflows.
 *
 * - `node scripts/release-notes.ts check` compares data/decks.json with the last commit's. Prints `changed=true` or
 *   `changed=false` (only a deck or card change counts, not the "data as of" time), and fails if a source lost more
 *   than a quarter of its decks.
 * - `node scripts/release-notes.ts notes <tag>` prints the notes: CHANGELOG.md's Unreleased entries, then what changed
 *   in the data since the previous release tag (needs the tags fetched).
 * - `node scripts/release-notes.ts file <tag>` moves the Unreleased entries under a `## <tag>` heading in CHANGELOG.md.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import type { Dataset } from '../src/types.ts'
import { fileUnreleased, releaseNotes, shrunkSources } from './lib/release-notes.ts'

const [command, tag] = process.argv.slice(2)
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1e9 })
const after: Dataset = JSON.parse(readFileSync('data/decks.json', 'utf8'))

if (command === 'check') {
  const before: Dataset = JSON.parse(git('show', 'HEAD:data/decks.json'))
  const shrunk = shrunkSources(before, after)
  if (shrunk.length) {
    console.error(`A source lost more than a quarter of its decks; not releasing:\n  ${shrunk.join('\n  ')}`)
    process.exit(1)
  }
  const same = (d: Dataset) => JSON.stringify({ cards: d.cards, decks: d.decks })
  console.log(`changed=${same(before) !== same(after)}`)
} else if (tag && (command === 'notes' || command === 'file')) {
  const changelog = readFileSync('CHANGELOG.md', 'utf8')
  if (command === 'file') writeFileSync('CHANGELOG.md', fileUnreleased(changelog, tag))
  else {
    // Release tags are dates with two-digit suffixes (2026-10-16.02), so the newest other one sorts last.
    const previous = git('tag', '--list', '20*')
      .split('\n')
      .filter((t) => t && t !== tag)
      .sort()
      .at(-1)
    const before: Dataset | undefined = previous ? JSON.parse(git('show', `${previous}:data/decks.json`)) : undefined
    console.log(releaseNotes(changelog, before, after))
  }
} else {
  console.error('Usage: node scripts/release-notes.ts check | notes <tag> | file <tag>')
  process.exit(1)
}
