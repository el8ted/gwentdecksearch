import { consola } from 'consola'
import { SOURCE_NAMES } from '../../src/types.ts'
import {
  type DeckEntry,
  type ListedGuide,
  monthsBefore,
  parseArchetypeSheet,
  parseGuideListing,
  parseSheet,
  parseSheetTabs,
  parseShinmiriSheet,
  recentTabs,
} from './sources.ts'
import { type SheetLinks, sheetLinks } from './xlsx.ts'

/**
 * Community guides are read back this many months. Older guides add variations of today's archetypes and the niche
 * ones published about once a month; past 18 months, decks over today's provision limit start to crowd the lists.
 */
export const COMMUNITY_WINDOW_MONTHS = 18
/**
 * Sheet patch tabs are read back this many months; each sheet's main list is always read in full. Older tabs are
 * mostly decks built to an old patch's limit.
 */
export const SHEET_WINDOW_MONTHS = 12
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
    archetypeGid: undefined,
    // Its video links are plain text, so the CSV has them.
    links: false,
  },
  {
    source: 'metallic-danny',
    id: '1_nLQ_0y1t_3zRAwjRSPjSv4djBSRKHPyli3hNrjRgkg',
    mainGid: '1966172750',
    parse: parseSheet,
    // Its Архетипы tab has no patch number and changes rarely, but names the archetype each deck plays: read it in
    // full every run, like the main list.
    archetypeGid: '663857777',
    // Its videos are link chips: the CSV has only their titles, the xlsx export their URLs.
    links: true,
  },
] as const
/** A sheet tab's CSV export URL. */
export const sheetCsv = (id: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`

/** Fetches a URL's body. */
export type GetBody = (url: string) => Promise<string>

/** Fetches a URL's body as bytes. */
export type GetBytes = (url: string) => Promise<Buffer>

/**
 * Collects deck links from every source: community guides (newest-first listing, paged until outside the
 * window), then each sheet's main list and recent patch tabs.
 *
 * @param get - Fetches a body
 * @param getBytes - Fetches a body as bytes (sheet exports with link chips)
 * @param now - Reference time for the window
 * @param windows - Months to read back, community guides and sheet patch tabs; defaults to the shipped windows
 * @returns Every entry in source-priority order (duplicates kept: each records a source), and the number of
 *   guides listed
 */
export async function collectEntries(
  get: GetBody,
  getBytes: GetBytes,
  now: Date,
  windows = { community: COMMUNITY_WINDOW_MONTHS, sheets: SHEET_WINDOW_MONTHS },
): Promise<{ entries: DeckEntry[]; listed: number }> {
  const sinceIso = monthsBefore(now, windows.community).toISOString()
  const listed: ListedGuide[] = []
  for (let offset = 0; ; offset += LISTING_PAGE) {
    const body = await get(`${GUIDE_API}/offset/${offset}/limit/${LISTING_PAGE}`)
    const page: ListedGuide[] = JSON.parse(body).guides
    listed.push(...page)
    if (page.length < LISTING_PAGE || page.every((g) => g.modified < sinceIso)) break
  }

  const sheetsSince = monthsBefore(now, windows.sheets)
  const sheetEntries: DeckEntry[] = []
  for (const sheet of SHEETS) {
    const tab = async (gid: string) => {
      const links: SheetLinks = sheet.links
        ? sheetLinks(await getBytes(`https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=xlsx&gid=${gid}`))
        : new Map()
      return sheet.parse(await get(sheetCsv(sheet.id, gid)), links)
    }
    const main = await tab(sheet.mainGid)
    const html = await get(`https://docs.google.com/spreadsheets/d/${sheet.id}/htmlview`)
    const tabs = recentTabs(parseSheetTabs(html), sheet.mainGid, sheetsSince)
    if (!tabs.length)
      consola.warn(`${SOURCE_NAMES[sheet.source]}: no patch tabs in the window; tab list layout may have changed`)
    // Tabs come newest first, so a deck in several tabs takes its newest name.
    const extra: DeckEntry[] = []
    for (const t of tabs) {
      extra.push(...(await tab(t.gid)))
    }
    // After the main list and patch tabs, so names already shown stay the same.
    if (sheet.archetypeGid) extra.push(...parseArchetypeSheet(await get(sheetCsv(sheet.id, sheet.archetypeGid))))
    const onMain = new Set(main.map((e) => e.url))
    const added = new Set(extra.filter((e) => !onMain.has(e.url)).map((e) => e.url)).size
    const videos = new Set([...main, ...extra].flatMap((e) => (e.video ? [e.url] : []))).size
    consola.info(
      `${SOURCE_NAMES[sheet.source]}: ${onMain.size} links on the main list; ${tabs.length} patch tabs (${tabs.map((t) => t.name).join(', ')})${sheet.archetypeGid ? ' and the archetype tab' : ''} add ${added}; ${videos} decks with a video`,
    )
    sheetEntries.push(...main, ...extra)
  }
  return { entries: [...parseGuideListing(listed, sinceIso), ...sheetEntries], listed: listed.length }
}
