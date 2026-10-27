import type { Poll } from './poll.ts'
import { listOf } from './poll.ts'
import { parseCsv } from './sources.ts'
import { CATEGORIES } from './whatif.ts'

/**
 * The sheet and tab a Google Sheets link points to: the tab is the link's `gid` (in the `#` part or the query), else
 * the first tab.
 *
 * @param url - The link given
 * @returns Its ID and tab, or `undefined` if it isn't a Google Sheets link
 */
export function sheetRef(url: string): { id: string; gid: string } | undefined {
  try {
    const { protocol, hostname, pathname, hash, searchParams } = new URL(url)
    const id = /^\/spreadsheets\/d\/([\w-]+)/.exec(pathname)?.[1]
    if (protocol !== 'https:' || hostname !== 'docs.google.com' || !id) return undefined
    return { id, gid: /gid=(\d+)/.exec(hash)?.[1] ?? searchParams.get('gid') ?? '0' }
  } catch {
    return undefined
  }
}

// "NR Nenneke (VK***)", "0 Portal (OQ***, SL*)": a faction code, 0 for neutral, before the card.
const FACTION = /^(?:MO|NG|NR|SK|ST|SY|0)\s+/

/**
 * Reads a predictions sheet's CSV: a header row naming a ballot list per column ("-1 power", "+1 prov"), then that
 * list's cards down the column to the first blank cell, each as `<faction> <card> (<who recommended it>)`. The
 * faction is dropped (whatif shows the card's own); the brackets stay, as a comment. The cell above the header row is
 * the title; a legend below the lists (a cell with `=`, as in "MD = MetallicDanny") goes in the notes.
 *
 * @param csv - The tab's CSV export
 * @returns The lists as a {@link Poll}, the header row's other titles (a side table) skipped
 * @throws {Error} If no row names a ballot list, so a changed layout fails loudly
 */
export function parsePredictions(csv: string): Poll {
  const rows = parseCsv(csv).map((r) => r.map((c) => c.trim()))
  const h = rows.findIndex((r) => r.some((c) => listOf(c)))
  if (h < 0) throw new Error('No column names a power or provision list: the sheet layout may have changed')
  const lists: Poll['lists'] = []
  const skipped: string[] = []
  const notes: string[] = []
  for (const [col, title] of rows[h].entries()) {
    const category = listOf(title)
    if (!category) {
      if (title) skipped.push(title)
      continue
    }
    const below = rows.slice(h + 1).map((r) => r[col] ?? '')
    const end = below.indexOf('') < 0 ? below.length : below.indexOf('')
    lists.push({ category, options: below.slice(0, end).map((c) => c.replace(FACTION, '')) })
    notes.push(...below.slice(end).filter((c) => c.includes('=') && !notes.includes(c)))
  }
  lists.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category))
  const title =
    rows
      .slice(0, h)
      .flatMap((r) => r.filter(Boolean))
      .at(-1) ?? 'Predictions'
  return { title, lists, skipped, notes }
}
