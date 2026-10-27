import { type IndexedDeck, provisionStatus } from '../../src/filter.ts'
import type { Dataset } from '../../src/types.ts'
import {
  type AnalysisData,
  cardLookup,
  cardName,
  caveat,
  explainLookup,
  halfYear,
  leaderCounts,
  profile,
} from './analysis.ts'

/**
 * The Balance Council ballot's four lists, in ballot order. Each passed change moves a card by one: a unit's power,
 * or any card's provisions (for a leader, its bonus, so a provision increase there is a buff).
 */
export const CATEGORIES = [
  { name: 'Power increase', kind: 'power', delta: 1 },
  { name: 'Power decrease', kind: 'power', delta: -1 },
  { name: 'Provision increase', kind: 'provisions', delta: 1 },
  { name: 'Provision decrease', kind: 'provisions', delta: -1 },
] as const

/** One of {@link CATEGORIES}. */
export type Category = (typeof CATEGORIES)[number]

/** One proposed change: a card, the list it's on, and its rank there (3 is the top pick; none for an extra). */
export interface Change {
  id: number
  category: Category
  rank?: number
}

// A heading names a list ("Power increase", "provisions decrease:"); an entry is "3. Card", "- Card" or "Card".
const heading = (line: string) =>
  CATEGORIES.find(
    (c) => c.name.toLowerCase() === line.toLowerCase().replace(/:$/, '').replace('provisions', 'provision').trim(),
  )
const ENTRY = /^(?:(\d+)[.)]|-)?\s*(.*)$/

/** A ballot line whose name isn't one card: its index in the text's lines, the name, its list and the suggestions. */
export interface Unresolved {
  line: number
  name: string
  category: Category
  matches: number[]
}

/**
 * Reads a ballot: a heading per list (`Power increase`, `Power decrease`, `Provision increase`, `Provision
 * decrease`), then its cards, one per line, by name in any of the site's languages or by ID. `3. Card` ranks a pick
 * (3 is the top); `- Card` or a bare name adds an unranked extra, as coalition lists do. A rank with no card (the
 * template's empty slots), blank lines and `#` comments are skipped. A `Poll` line marks a poll (candidates, as
 * `pnpm poll` writes them): a card may then be on both lists of a kind, each counted on its own.
 *
 * @param text - The ballot
 * @param data - Catalog and names
 * @param lang - Language for card names in error messages
 * @returns The changes and whether it's a poll, or, if any line is unknown, ambiguous, outside a list or
 *   contradictory, every such line explained (nothing guessed), and the names that aren't one card, to ask about
 */
export function parseChanges(
  text: string,
  data: Pick<AnalysisData, 'catalog' | 'names'>,
  lang = 'en',
): { ok: true; changes: Change[]; poll: boolean } | { ok: false; errors: string[]; unresolved: Unresolved[] } {
  const lookup = cardLookup(data)
  const changes: Change[] = []
  const errors: string[] = []
  const unresolved: Unresolved[] = []
  let category: Category | undefined
  let poll = false
  for (const [n, raw] of text.split('\n').entries()) {
    const line = raw.replace(/#.*/, '').trim()
    if (!line) continue
    if (/^poll$/i.test(line)) {
      poll = true
      continue
    }
    const list = heading(line)
    if (list) {
      category = list
      continue
    }
    const [, rank, name = ''] = ENTRY.exec(line) ?? []
    if (!name) continue
    if (!category) {
      errors.push(`line ${n + 1}: put "${name}" under a heading: ${CATEGORIES.map((c) => c.name).join(', ')}`)
      continue
    }
    const found = lookup(name)
    if (!found.ok) {
      errors.push(`line ${n + 1}: ${explainLookup(found, name, data, lang)}`)
      unresolved.push({ line: n, name, category, matches: found.matches })
      continue
    }
    const kind = category.kind
    const card = data.catalog[found.value]
    if (kind === 'power' && card.type !== 'unit') {
      errors.push(`line ${n + 1}: ${cardName(data, found.value, lang)} is a ${card.type}: only units have power`)
      continue
    }
    // A ballot can't move a card both ways; a poll may offer both.
    const twice = changes.find(
      (c) => c.id === found.value && (poll ? c.category === category : c.category.kind === kind),
    )
    if (twice) {
      errors.push(`line ${n + 1}: ${cardName(data, found.value, lang)} is already under ${twice.category.name}`)
      continue
    }
    changes.push({ id: found.value, category, ...(rank && { rank: Number(rank) }) })
  }
  return errors.length ? { ok: false, errors, unresolved } : { ok: true, changes, poll }
}

/**
 * A ballot line with its name fixed: the card's English name in its place, the name as written kept as a comment
 * (unless the line has one already, as `pnpm poll` writes it); or, with no card, the line commented out.
 *
 * @param raw - The line
 * @param name - The name as {@link parseChanges} read it
 * @param card - The card's English name, or undefined to skip the line
 * @returns The new line
 */
export function fixLine(raw: string, name: string, card: string | undefined): string {
  if (card === undefined) return `# skipped: ${raw}`
  const line = raw.replace(name, () => card)
  return raw.includes('#') ? line : `${line}   # was: ${name}`
}

/** What a set of changes does to a deck. */
export type Effect = 'pushed over' | 'back within' | 'still within' | 'still over' | 'touched'
/** Report order of {@link Effect}s. */
export const EFFECTS: readonly Effect[] = ['pushed over', 'back within', 'still within', 'still over', 'touched']

/**
 * The effect of a set of changes on one deck: provision changes move it against today's limit; power changes only
 * touch it, since deck lists can't show strength.
 *
 * @param deck - The deck
 * @param changes - Changes it's hit by
 * @param cards - Today's cards, as the site checks decks against them
 * @returns The effect, and its distance from the limit before and after (positive is spare), as the site counts it
 */
export function effectOn(
  deck: IndexedDeck,
  changes: Change[],
  cards: Dataset['cards'],
): { effect: Effect; before: number; after: number } {
  const moved = changes.filter((c) => c.category.kind === 'provisions')
  const before = provisionStatus(deck, cards).delta
  // A leader's provisions raise the limit; any other card's use it up, once per copy.
  const shift = moved.reduce((n, c) => {
    const copies = deck.deck.cards.find(([id]) => id === c.id)?.[1] ?? 0
    return n + (c.id === deck.leader ? c.category.delta : -c.category.delta * copies)
  }, 0)
  const after = before + shift
  const effect: Effect = !moved.length
    ? 'touched'
    : before >= 0
      ? after >= 0
        ? 'still within'
        : 'pushed over'
      : after >= 0
        ? 'back within'
        : 'still over'
  return { effect, before, after }
}

// A deck's ids include its leader, so a leader change hits its decks too.
const hits = (deck: IndexedDeck, c: Change) => deck.ids.has(c.id)
const rankOf = (c: Change) => (c.rank === undefined ? 'extra' : String(c.rank))

/**
 * The what-if report: one table, a row per change (its decks, the provision effect, its top leader and the trend of
 * its decks over the last half-years), then, for a ballot, all the changes together. `detail` adds a section per
 * change with every effect and the decks' factions, leaders and half-years.
 *
 * @param data - Decks, catalog and names
 * @param changes - From {@link parseChanges}
 * @param lang - Language for card names
 * @param options - `poll`: a poll's candidates, each counted on its own, with no all-together total (they won't all
 *   pass); `detail`: the per-change sections
 * @returns Markdown
 */
export function whatifReport(
  data: AnalysisData,
  changes: Change[],
  lang = 'en',
  { poll = false, detail = false } = {},
): string {
  const decksOf = (c: Change) => data.decks.filter((d) => hits(d, c))
  const counts = (decks: IndexedDeck[], set: Change[]) => {
    const rows = decks.map((d) =>
      effectOn(
        d,
        set.filter((c) => hits(d, c)),
        data.dataset.cards,
      ),
    )
    return (e: Effect) => rows.filter((r) => r.effect === e).length
  }
  // "5 → 6": every change is one, so the arrow says it all; the table says whether it's power or provisions. Power
  // changes are units only (parseChanges refuses the rest), and every unit has power.
  const what = (c: Change) => {
    const card = data.catalog[c.id]
    const from = c.category.kind === 'power' ? (card.power ?? 0) : card.provisions
    return `${from} → ${from + c.category.delta}`
  }
  const out = [`# What if${poll ? ': poll' : ''}`, '', caveat(data), '']
  out.push(
    poll
      ? `${changes.length} candidates, each counted on its own: a poll lists options, not what passes.`
      : `${changes.length} changes.`,
  )
  // A Rank column of "extra" on every row says nothing: shown only when some change is ranked.
  const ranked = !poll && changes.some((c) => c.rank !== undefined)
  // The last four half-years any deck is dated in, oldest first: the trend columns.
  const halves = [...new Set(data.decks.map(halfYear))]
    .filter((h) => h !== 'undated')
    .sort()
    .slice(-4)
  const topLeader = (decks: IndexedDeck[]) => {
    const [id, k] = leaderCounts(decks)[0] ?? []
    return id === undefined ? '' : `${cardName(data, id, lang)} ${Math.round((k / decks.length) * 100)}%`
  }
  const table = (decks: IndexedDeck[], set: Change[]) => {
    const n = counts(decks, set)
    const shown = EFFECTS.filter((e) => n(e) || (e !== 'touched' && set.some((c) => c.category.kind === 'provisions')))
    return [`| ${shown.join(' | ')} |`, `|${shown.map(() => '---:').join('|')}|`, `| ${shown.map(n).join(' | ')} |`]
  }
  // A table per ballot list, in ballot order; with `detail`, each change's section follows its list's table. Only
  // provision changes move decks against the limit, so only those tables have those columns. A poll's candidates are
  // unranked, so each list is sorted by the decks it hits, most first.
  for (const category of CATEGORIES) {
    const listed = changes.filter((c) => c.category === category)
    if (!listed.length) continue
    const rows = poll ? listed.sort((a, b) => decksOf(b).length - decksOf(a).length) : listed
    const moves = category.kind === 'provisions'
    const cols = [
      'Change',
      ...(ranked ? ['Rank'] : []),
      'Card',
      'Faction',
      'Decks',
      ...(moves ? ['Pushed over', 'Back within'] : []),
      'Top leader',
      halves.join(' · '),
    ]
    const right = ['Rank', 'Decks', 'Pushed over', 'Back within']
    out.push(
      '',
      `## ${category.name}`,
      '',
      `| ${cols.join(' | ')} |`,
      `|${cols.map((c) => (right.includes(c) ? '---:' : '---')).join('|')}|`,
    )
    for (const c of rows) {
      const decks = decksOf(c)
      const n = counts(decks, [c])
      const cells = [
        what(c),
        ...(ranked ? [rankOf(c)] : []),
        cardName(data, c.id, lang),
        data.catalog[c.id].faction,
        decks.length,
        ...(moves ? [n('pushed over'), n('back within')] : []),
        topLeader(decks),
        halves.map((h) => decks.filter((d) => halfYear(d) === h).length).join(' · '),
      ]
      out.push(`| ${cells.join(' | ')} |`)
    }
    for (const c of detail ? rows : []) {
      const card = data.catalog[c.id]
      const decks = decksOf(c)
      out.push(
        '',
        `### ${ranked ? `${rankOf(c)}: ` : ''}${cardName(data, c.id, lang)} (${card.faction} ${card.type}): ${what(c)}`,
        '',
      )
      out.push(`In ${decks.length} decks.`)
      if (decks.length) out.push('', ...table(decks, [c]), '', profile(data, decks, lang))
    }
  }
  out.push(
    '',
    `_Pushed over / back within: decks that cross today's limit. Last column: decks by guide date per half-year; sheet ` +
      `decks are undated. ${detail ? '' : 'Add --detail for every effect, faction and leader per change.'}_`,
  )
  if (changes.length > 1 && !poll) {
    const decks = data.decks.filter((d) => changes.some((c) => hits(d, c)))
    const multi = decks.filter((d) => changes.filter((c) => hits(d, c)).length > 1)
    out.push(
      '',
      `## All ${changes.length} changes together`,
      '',
      `${decks.length} decks hit; ${multi.length} by two or more.`,
    )
    out.push('', ...table(decks, changes))
    if (multi.length) out.push('', 'Decks hit by two or more:  ', profile(data, multi, lang))
  }
  return `${out.join('\n')}\n`
}
