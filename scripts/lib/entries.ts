import { consola } from 'consola'
import { SOURCE_NAMES } from '../../src/types.ts'
import {
  type DeckEntry,
  type ListedGuide,
  monthsBefore,
  parseGuideListing,
  parseSheet,
  parseSheetTabs,
  parseShinmiriSheet,
  recentTabs,
} from './sources.ts'

/** Community guides are read back this many months: older guides are usually only a few provisions over. */
export const COMMUNITY_WINDOW_MONTHS = 12
/** Sheet patch tabs are read back this many months. */
export const SHEET_WINDOW_MONTHS = 6
const LISTING_PAGE = 500
const GUIDE_API = 'https://www.playgwent.com/en/decks/api/guides'
// Order matters: the first entry for a deck names it. Shinmiri2 precedes MetallicDanny because MetallicDanny's
// names are machine-translated from Russian; display order is SOURCES, not this.
const SHEETS = [
  {
    source: 'shinmiri2',
    id: '1h4m0zhPOiW2Tyaj26kGIvPdSXgtmgerR5uu7vBHM-BM',
    mainGid: '1592369710',
    parse: parseShinmiriSheet,
  },
  {
    source: 'metallic-danny',
    id: '1_nLQ_0y1t_3zRAwjRSPjSv4djBSRKHPyli3hNrjRgkg',
    mainGid: '1966172750',
    parse: parseSheet,
  },
] as const
const sheetCsv = (id: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`

/** Fetches a URL's body. */
export type GetBody = (url: string) => Promise<string>

/**
 * Collects deck links from every source: community guides (newest-first listing, paged until outside the
 * window), then each sheet's main list and recent patch tabs.
 *
 * @param get - Fetches a body
 * @param now - Reference time for the window
 * @returns Every entry in source-priority order (duplicates kept: each records a source), and the number of
 *   guides listed
 */
export async function collectEntries(get: GetBody, now: Date): Promise<{ entries: DeckEntry[]; listed: number }> {
  const sinceIso = monthsBefore(now, COMMUNITY_WINDOW_MONTHS).toISOString()
  const listed: ListedGuide[] = []
  for (let offset = 0; ; offset += LISTING_PAGE) {
    const body = await get(`${GUIDE_API}/offset/${offset}/limit/${LISTING_PAGE}`)
    const page: ListedGuide[] = JSON.parse(body).guides
    listed.push(...page)
    if (page.length < LISTING_PAGE || page.every((g) => g.modified < sinceIso)) break
  }

  const sheetsSince = monthsBefore(now, SHEET_WINDOW_MONTHS)
  const sheetEntries: DeckEntry[] = []
  for (const sheet of SHEETS) {
    const main = sheet.parse(await get(sheetCsv(sheet.id, sheet.mainGid)))
    const html = await get(`https://docs.google.com/spreadsheets/d/${sheet.id}/htmlview`)
    const tabs = recentTabs(parseSheetTabs(html), sheet.mainGid, sheetsSince)
    if (!tabs.length)
      consola.warn(`${SOURCE_NAMES[sheet.source]}: no patch tabs in the window; tab list layout may have changed`)
    // Tabs come newest first, so a deck in several tabs takes its newest name.
    const extra: DeckEntry[] = []
    for (const tab of tabs) {
      extra.push(...sheet.parse(await get(sheetCsv(sheet.id, tab.gid))))
    }
    const onMain = new Set(main.map((e) => e.url))
    const added = new Set(extra.filter((e) => !onMain.has(e.url)).map((e) => e.url)).size
    consola.info(
      `${SOURCE_NAMES[sheet.source]}: ${onMain.size} links on the main list; ${tabs.length} patch tabs (${tabs.map((t) => t.name).join(', ')}) add ${added}`,
    )
    sheetEntries.push(...main, ...extra)
  }
  return { entries: [...parseGuideListing(listed, sinceIso), ...sheetEntries], listed: listed.length }
}
