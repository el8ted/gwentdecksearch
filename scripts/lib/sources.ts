import type { Source } from '../../src/types.ts'

/** One deck link from a source list. */
export interface DeckEntry {
  /** Deck name in the source's language. */
  name: string
  /** Language-neutral playgwent URL (`https://www.playgwent.com/decks/…`). */
  url: string
  /**
   * playgwent language code (`en`, `ru`, `pt-BR`, …) used as the URL prefix when fetching; localized
   * pages carry card names in that language, which feed the translation glossary.
   */
  lang: string
  source: Source
  /** Community guides only. */
  guide?: { id: number; modified: string; votes: number; author: string }
}

/** A guide summary from playgwent's `/api/guides/offset/{n}/limit/{m}` listing (fields used). */
export interface ListedGuide {
  id: number
  name: string
  language: string
  modified: string
  votes: number
  author: string
  hidden: boolean
  published: boolean
  invalid: boolean
}

/**
 * Normalizes a playgwent link so the same deck from different sources compares equal.
 *
 * @param url - Any playgwent deck or guide URL, with or without a language segment
 * @returns `https://www.playgwent.com/decks/{hash}` or `…/decks/guides/{id}`, or `undefined` if not a deck link
 */
export function normalizeUrl(url: string): string | undefined {
  const path = url
    .trim()
    .match(/^https?:\/\/(?:www\.)?playgwent\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(decks\/\S+)$/i)?.[1]
  return path ? `https://www.playgwent.com/${path.replace(/\/+$/, '')}` : undefined
}

/**
 * Parses CSV (RFC 4180: quoted fields, doubled quotes, newlines inside quotes).
 *
 * @param text - CSV text
 * @returns Rows of fields
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') field += text[++i]
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) rows.push([...row, field])
  return rows
}

/**
 * Parses Shinmiri2's sheet (CSV export).
 *
 * The alternate-version column becomes its own entry with the same name, because the UI treats
 * alternates as independent decks. Rows without a link (unpublished decks) are skipped.
 *
 * @param csv - Columns: Faction, Leader, Deck Name, Deck Link, Alternate Version, …
 * @returns Entries in sheet order
 */
export function parseShinmiriSheet(csv: string): DeckEntry[] {
  return parseCsv(csv)
    .slice(1)
    .flatMap(([, , name = '', main = '', alt = '']) =>
      [main, alt].flatMap((link) => {
        const url = normalizeUrl(link)
        return name.trim() && url ? [{ name: name.trim(), url, lang: 'en', source: 'shinmiri2' as const }] : []
      }),
    )
}

/**
 * Parses a MetallicDanny sheet tab (CSV export): the "all decks" list, a meta report or a patch list.
 *
 * Tabs differ in layout, so each row's first playgwent link is taken with the nearest text to its left as
 * the name. Meta reports write "Name (Leader):"; the leader is dropped, since the deck page names it and it
 * garbles translation. Faction and leader rows have no playgwent link and are
 * skipped (the deck page names its own leader).
 *
 * @param csv - CSV export of the tab
 * @returns Entries in sheet order, names still in Russian
 */
export function parseSheet(csv: string): DeckEntry[] {
  return parseCsv(csv).flatMap((row) => {
    const at = row.findIndex((cell) => normalizeUrl(cell))
    const name = row
      .slice(0, Math.max(at, 0))
      .findLast((cell) => cell.trim())
      ?.trim()
      .replace(/\s*\([^()]*\):$|:$/, '')
    const url = at < 0 ? undefined : normalizeUrl(row[at])
    return name && url ? [{ name, url, lang: 'ru', source: 'metallic-danny' as const }] : []
  })
}

/** One tab of a public Google Sheet. */
export interface SheetTab {
  name: string
  gid: string
}

/**
 * Lists a public Google Sheet's tabs from its `htmlview` page.
 *
 * @param html - The `/htmlview` page
 * @returns Tabs in sheet order; empty if the page layout changed
 */
export function parseSheetTabs(html: string): SheetTab[] {
  return [...html.matchAll(/\{name: "((?:[^"\\]|\\.)*)", pageUrl: "[^"]*", gid: "(\d+)"/g)].map(([, name, gid]) => ({
    // The name is a JS string literal; JSON reads it once `\xNN` escapes are spelled `\u00NN`.
    name: JSON.parse(`"${name.replace(/\\x([0-9a-f]{2})/gi, '\\u00$1')}"`),
    gid,
  }))
}

/**
 * The patch a tab name refers to, as `major * 100 + minor` ("Патч 14.4" → 1404, "v 9.5" → 905).
 *
 * @param name - Tab name
 * @returns Comparable patch number, or `undefined` for tabs without one
 */
export function tabPatch(name: string): number | undefined {
  const m = name.match(/(\d+)\.(\d+)/)
  return m ? Number(m[1]) * 100 + Number(m[2]) : undefined
}

/**
 * The patch released in a date's month, comparable with {@link tabPatch}.
 *
 * shortcut: assumes Gwent's monthly numbering (14.1 = January 2026), update if the scheme changes.
 *
 * @param date - Any date
 * @returns `major * 100 + month`
 */
export function patchOf(date: Date): number {
  return (date.getUTCFullYear() - 2012) * 100 + date.getUTCMonth() + 1
}

/**
 * The same UTC day `months` months earlier, clamped to the end of a shorter month (Aug 31 − 6 → Feb 28, not
 * Mar 3).
 *
 * @param date - Start date
 * @param months - Months to go back
 * @returns A new date
 */
export function monthsBefore(date: Date, months: number): Date {
  const d = new Date(date)
  const month = d.getUTCMonth() - months
  const last = new Date(Date.UTC(d.getUTCFullYear(), month + 1, 0)).getUTCDate()
  d.setUTCMonth(month, Math.min(d.getUTCDate(), last))
  return d
}

/**
 * Patch tabs from `since`'s month onward, excluding the main list.
 *
 * @param tabs - All tabs of a sheet
 * @param mainGid - The main list's tab, which is read separately
 * @param since - Start of the window
 * @returns Tabs in sheet order
 */
export function recentTabs(tabs: SheetTab[], mainGid: string, since: Date): SheetTab[] {
  const from = patchOf(since)
  return tabs.filter((t) => t.gid !== mainGid && (tabPatch(t.name) ?? 0) >= from)
}

/**
 * Turns playgwent's public guide listing into entries, keeping published, valid guides modified on or
 * after `since`.
 *
 * @param guides - Listing items, newest first
 * @param since - ISO date cutoff
 * @returns Community entries
 */
export function parseGuideListing(guides: ListedGuide[], since: string): DeckEntry[] {
  return guides
    .filter((g) => g.published && !g.hidden && !g.invalid && g.modified >= since)
    .map((g) => ({
      name: g.name.trim(),
      url: `https://www.playgwent.com/decks/guides/${g.id}`,
      lang: g.language,
      source: 'community' as const,
      guide: { id: g.id, modified: g.modified, votes: g.votes, author: g.author },
    }))
}
