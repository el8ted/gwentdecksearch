import { type Dataset, SOURCE_NAMES, SOURCES } from '../../src/types.ts'

const num = new Intl.NumberFormat('en')
const signed = (n: number) => (n > 0 ? `+${num.format(n)}` : n < 0 ? `−${num.format(-n)}` : '±0')

/**
 * The `## Unreleased` section of the changelog.
 *
 * @param changelog - CHANGELOG.md
 * @returns Its entries, trimmed; empty if there are none
 */
export function unreleased(changelog: string): string {
  const start = changelog.indexOf('## Unreleased')
  if (start < 0) return ''
  const body = changelog.slice(start + '## Unreleased'.length)
  const end = body.search(/^## /m)
  return (end < 0 ? body : body.slice(0, end)).trim()
}

/**
 * Files the Unreleased entries under a release heading and leaves an empty Unreleased section above it.
 *
 * @param changelog - CHANGELOG.md
 * @param tag - Release tag, e.g. `2026-10-24`
 * @returns The new changelog, unchanged if there was nothing unreleased
 */
export function fileUnreleased(changelog: string, tag: string): string {
  const entries = unreleased(changelog)
  if (!entries) return changelog
  const start = changelog.indexOf('## Unreleased')
  const rest = changelog.slice(start + '## Unreleased'.length).trimStart()
  return `${changelog.slice(0, start)}## Unreleased\n\n## ${tag}\n\n${rest}`
}

/**
 * What changed in the data since the previous release: deck counts per source, and cards whose provisions or power
 * changed (the Balance Council's effect).
 *
 * @param before - The previous release's dataset; `undefined` for the first release
 * @param after - This release's dataset
 * @returns Markdown
 */
export function dataNotes(before: Dataset | undefined, after: Dataset): string {
  const listed = (data: Dataset | undefined, src: string) =>
    data?.decks.filter((d) => (d.sources as string[]).includes(src)).length ?? 0
  const total = after.decks.length
  const lines = [
    `**${num.format(total)} decks** (${signed(total - (before?.decks.length ?? 0))}), data as of ${after.scrapedAt.slice(0, 16).replace('T', ' ')} UTC.`,
    '',
    ...SOURCES.map((s) => {
      const n = listed(after, s)
      return `- ${SOURCE_NAMES[s]}: ${num.format(n)} (${signed(n - listed(before, s))})`
    }),
  ]

  const changes: string[] = []
  for (const [id, card] of Object.entries(after.cards)) {
    const old = before?.cards[Number(id)]
    if (!old) continue
    const what = card.type === 'leader' ? 'provision bonus' : 'provisions'
    if (old.provisions !== card.provisions) changes.push(`${card.name}: ${what} ${old.provisions} → ${card.provisions}`)
    if (old.power !== undefined && card.power !== undefined && old.power !== card.power)
      changes.push(`${card.name}: power ${old.power} → ${card.power}`)
  }
  if (changes.length) lines.push('', '**Card changes**', '', ...changes.sort().map((c) => `- ${c}`))
  return lines.join('\n')
}

/**
 * The release notes: the changelog's unreleased entries, then the data summary and how to use the release.
 *
 * @param changelog - CHANGELOG.md
 * @param before - The previous release's dataset, if any
 * @param after - This release's dataset
 * @returns Markdown
 */
export function releaseNotes(changelog: string, before: Dataset | undefined, after: Dataset): string {
  // Release pages keep every line break, so an entry wrapped over lines in the changelog is joined back up.
  const changes = unreleased(changelog).replace(/\n[ \t]+/g, ' ')
  return [
    ...(changes ? ['### Changes', '', changes, ''] : []),
    '### Data',
    '',
    dataNotes(before, after),
    '',
    '### Use it',
    '',
    '- **Online:** https://el8ted.github.io/gwentdecksearch/',
    '- **Offline:** download the zip below, unzip it and open `gwent-deck-search/index.html` in your browser.',
  ].join('\n')
}
