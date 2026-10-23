import { type AnalysisData, cardLookup, slug } from './analysis.ts'
import { CATEGORIES, type Category } from './whatif.ts'

/** A Balance Council poll read from a Google Form: its title, and the candidate cards for each ballot list. */
export interface Poll {
  title: string
  lists: { category: Category; options: string[] }[]
  /** Questions that aren't one of the ballot's lists (an intro, a nickname box), left out. */
  skipped: string[]
}

/**
 * Whether a URL is a Google Form (`docs.google.com/forms/…`, or a `forms.gle` short link).
 *
 * @param url - The address given
 * @returns Whether it's one
 */
export function isFormUrl(url: string): boolean {
  try {
    const { protocol, hostname, pathname } = new URL(url)
    return (
      protocol === 'https:' &&
      (hostname === 'forms.gle' || (hostname === 'docs.google.com' && pathname.startsWith('/forms/')))
    )
  } catch {
    return false
  }
}

// "Power + / Siła +", "Provisions – / Koszt –", "…support for Power Increase?"
const listOf = (title: string): Category | undefined => {
  const t = title.toLowerCase()
  const kind = /provision/.test(t) ? 'provisions' : /power/.test(t) ? 'power' : undefined
  const up = /increase|\+/.test(t)
  const down = /decrease|[-–−]/.test(t.replace(/[a-z]-[a-z]/g, ''))
  if (!kind || up === down) return undefined
  return CATEGORIES.find((c) => c.kind === kind && c.delta === (up ? 1 : -1))
}

/**
 * Reads a Google Form's page: its questions are in the page's `FB_PUBLIC_LOAD_DATA_` script, a JSON array (title at
 * `[1][8]`, questions at `[1][1]`, each `[id, title, description, type, [[id, [[option], …]]]]`).
 *
 * @param html - The form's `viewform` page
 * @returns The poll
 * @throws {Error} If the page has no form data or none of the ballot's lists, so a changed layout fails loudly
 */
export function parseForm(html: string): Poll {
  const json = /FB_PUBLIC_LOAD_DATA_ = (.*?);<\/script>/s.exec(html)?.[1]
  if (!json) throw new Error('No form data in the page: not a Google Form, or the form layout changed')
  const data = JSON.parse(json)
  const lists: Poll['lists'] = []
  const skipped: string[] = []
  for (const q of data[1]?.[1] ?? []) {
    const title = String(q[1] ?? '').trim()
    const options = (q[4] ?? []).flatMap((item: unknown[]) =>
      ((item?.[1] as unknown[][]) ?? []).map((o) => String(o[0] ?? '').trim()).filter(Boolean),
    )
    const category = listOf(title)
    if (category && options.length) lists.push({ category, options })
    else if (title) skipped.push(title)
  }
  if (!lists.length) throw new Error('No power or provision lists in the form: its questions may be worded differently')
  return { title: String(data[1]?.[8] ?? 'Balance poll').trim(), lists, skipped }
}

/**
 * An option as written to the ballot: the card's English name when exactly one card matches, else the option as
 * written, for `pnpm whatif` to stop on with suggestions. Tries the name (notes in brackets dropped), then each
 * translation after a `/`, then, if nothing matches, each part of an "A & B" option.
 *
 * @param option - The form's option
 * @param data - Catalog and names
 * @returns The ballot lines for it, each with the option as a comment when it was changed
 */
export function optionLines(option: string, data: Pick<AnalysisData, 'catalog' | 'names'>): string[] {
  const lookup = cardLookup(data)
  const bare = option.replace(/\s*\([^()]*\)/g, '').trim()
  const resolve = (text: string) => {
    for (const name of text.split('/').map((s) => s.trim())) {
      const found = name ? lookup(name) : undefined
      if (found?.ok) return data.catalog[found.value].name
    }
    return undefined
  }
  const note = (line: string) => (line === option ? `- ${line}` : `- ${line}   # ${option}`)
  const whole = resolve(bare)
  if (whole) return [note(whole)]
  const parts = bare.split(/\s+&\s+/)
  const each = parts.map(resolve)
  if (parts.length > 1 && each.every(Boolean)) return each.map((name) => note(name as string))
  return [note(bare.split('/')[0].trim() || option)]
}

/**
 * The ballot file for a poll: a `Poll` line, so `pnpm whatif` counts each candidate on its own (a card can be on both
 * lists of a kind, and there's no all-together total), then each list with every option, unranked.
 *
 * @param poll - From {@link parseForm}
 * @param url - Where it was read from
 * @param date - When (`YYYY-MM-DD`)
 * @param data - Catalog and names
 * @returns The file's text
 */
export function pollBallot(
  poll: Poll,
  url: string,
  date: string,
  data: Pick<AnalysisData, 'catalog' | 'names'>,
): string {
  const out = [
    `# ${poll.title}`,
    `# Read from ${url} on ${date}: every option, unranked. Notes from the form are kept as comments.`,
    '# A name the run stops on: write the card’s full name or ID (the error lists suggestions).',
    'Poll',
  ]
  for (const { category, options } of poll.lists)
    out.push('', category.name, ...options.flatMap((o) => optionLines(o, data)))
  return `${out.join('\n')}\n`
}

/**
 * A file name for a poll: its title as a {@link slug}, then the date.
 *
 * @param title - The poll's title
 * @param date - `YYYY-MM-DD`
 * @returns E.g. `ofir-x-qcento-balance-poll-no-37-2026-10-22.txt`
 */
export function pollFileName(title: string, date: string): string {
  return `${slug(title) || 'poll'}-${date}.txt`
}
