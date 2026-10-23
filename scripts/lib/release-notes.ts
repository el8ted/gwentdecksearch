import { CONFIG } from '../../src/config.ts'
import { type Card, type Dataset, SOURCE_NAMES, SOURCES } from '../../src/types.ts'

const num = new Intl.NumberFormat('en')
const signed = (n: number) => (n > 0 ? `+${num.format(n)}` : n < 0 ? `−${num.format(-n)}` : '±0')
/** Decks a source lists; none without a dataset (the first release). */
const listed = (data: Dataset | undefined, src: string) =>
  data?.decks.filter((d) => (d.sources as string[]).includes(src)).length ?? 0

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

/** A card's fields that changes are reported on. */
type CardFields = Pick<Card, 'name' | 'type' | 'provisions' | 'power'>

/**
 * Cards added, removed, or whose provisions, leader bonus or power changed (the Balance Council's effect).
 *
 * @param before - Cards by ID before
 * @param after - Cards by ID after
 * @returns One line per change, sorted
 */
export function cardChanges(before: Record<number, CardFields>, after: Record<number, CardFields>): string[] {
  const lines: string[] = []
  for (const [id, card] of Object.entries(after)) {
    const old = before[Number(id)]
    if (!old) {
      lines.push(`${card.name}: new`)
      continue
    }
    const what = card.type === 'leader' ? 'provision bonus' : 'provisions'
    if (old.provisions !== card.provisions) lines.push(`${card.name}: ${what} ${old.provisions} → ${card.provisions}`)
    if (old.power !== undefined && card.power !== undefined && old.power !== card.power)
      lines.push(`${card.name}: power ${old.power} → ${card.power}`)
  }
  for (const [id, card] of Object.entries(before)) if (!after[Number(id)]) lines.push(`${card.name}: removed`)
  return lines.sort()
}

/**
 * Sources that lost more than {@link CONFIG.maxSourceLoss} of their decks (a quarter): a sheet made private or rearranged still answers, but
 * yields no deck links, and an unattended update must not publish that.
 *
 * @param before - The published dataset
 * @param after - The refreshed dataset
 * @returns One line per shrunken source; empty if all is well
 */
export function shrunkSources(before: Dataset, after: Dataset): string[] {
  return SOURCES.flatMap((s) => {
    const [was, now] = [listed(before, s), listed(after, s)]
    return now < was * (1 - CONFIG.maxSourceLoss) ? [`${SOURCE_NAMES[s]}: ${was} → ${now} decks`] : []
  })
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
  const total = after.decks.length
  const lines = [
    `**${num.format(total)} decks** (${signed(total - (before?.decks.length ?? 0))}), data as of ${after.scrapedAt.slice(0, 16).replace('T', ' ')} UTC.`,
    '',
    ...SOURCES.map((s) => {
      const n = listed(after, s)
      return `- ${SOURCE_NAMES[s]}: ${num.format(n)} (${signed(n - listed(before, s))})`
    }),
  ]

  // Cards no deck uses aren't in the dataset, so "new" and "removed" only mean a card entered or left the decks.
  const changes = before ? cardChanges(before.cards, after.cards).filter((c) => !/: (new|removed)$/.test(c)) : []
  if (changes.length) lines.push('', '**Card changes**', '', ...changes.map((c) => `- ${c}`))
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
  // Release pages keep every line break, so an entry wrapped over lines in the changelog is joined back up; an
  // indented `- ` starts a sub-bullet, which keeps its own line.
  const changes = unreleased(changelog).replace(/\n[ \t]+(?![ \t]|[-*] )/g, ' ')
  return [
    ...(changes ? ['### Changes', '', changes, ''] : []),
    '### Data',
    '',
    dataNotes(before, after),
    '',
    '### Use it',
    '',
    `- **Online:** ${CONFIG.siteUrl}`,
    '- **Offline:** download the zip below, unzip it and open `gwent-deck-search/index.html` in your browser.',
  ].join('\n')
}
