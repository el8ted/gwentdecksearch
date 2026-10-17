/**
 * Release notes for the release workflow.
 *
 * - `node scripts/release-notes.ts notes <tag>` prints the notes: CHANGELOG.md's Unreleased entries, then what changed
 *   in the data since the previous release tag (needs the tags fetched).
 * - `node scripts/release-notes.ts file <tag>` moves the Unreleased entries under a `## <tag>` heading in CHANGELOG.md.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import type { Dataset } from '../src/types.ts'
import { fileUnreleased, releaseNotes } from './lib/release-notes.ts'

const [command, tag] = process.argv.slice(2)
if (!tag || !['notes', 'file'].includes(command)) {
  console.error('Usage: node scripts/release-notes.ts notes|file <tag>')
  process.exit(1)
}
const changelog = readFileSync('CHANGELOG.md', 'utf8')

if (command === 'file') writeFileSync('CHANGELOG.md', fileUnreleased(changelog, tag))
else {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1e9 })
  // Release tags are dates, so the newest other one sorts last.
  const previous = git('tag', '--list', '20*')
    .split('\n')
    .filter((t) => t && t !== tag)
    .sort()
    .at(-1)
  const before: Dataset | undefined = previous ? JSON.parse(git('show', `${previous}:data/decks.json`)) : undefined
  const after: Dataset = JSON.parse(readFileSync('data/decks.json', 'utf8'))
  console.log(releaseNotes(changelog, before, after))
}
