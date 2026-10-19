import { BUDGETS, type Budget, type FilterState } from './filter.ts'
import { LANGUAGES } from './i18n.ts'
import { type Card, type CardType, FACTIONS, type Faction, SOURCES, type Source } from './types.ts'

/** The state when nothing is selected. */
export const EMPTY_STATE: FilterState = {
  factions: [],
  sources: [],
  budgets: [],
  picks: [],
  excludes: [],
  video: false,
  langs: [],
  match: 'all',
}

/** An encoded author key; `undefined` for broken encoding. */
function decodeAuthor(text: string): string | undefined {
  try {
    return decodeURIComponent(text)
  } catch {
    return undefined
  }
}

/**
 * Serializes filters into a URL hash, omitting defaults so the URL stays short.
 *
 * @param state - Current filters
 * @returns Hash including the leading `#`, or `''` when nothing is selected
 */
export function encodeState(state: FilterState): string {
  const params = new URLSearchParams()
  if (state.match === 'any') params.set('k', 'any')
  if (state.factions.length) params.set('f', state.factions.join(','))
  if (state.sources?.length) params.set('src', state.sources.join(','))
  if (state.budgets?.length) params.set('b', state.budgets.join(','))
  if (state.video) params.set('v', '1')
  // Not `lang`: that's the page language, in the query string.
  if (state.langs?.length) params.set('gl', state.langs.join(','))
  if (state.leader !== undefined) params.set('l', String(state.leader))
  if (state.stratagem !== undefined) params.set('s', String(state.stratagem))
  // An author's key can hold any letter, so it's encoded to keep a comma in it from splitting the list.
  const pick = (p: number | string) =>
    typeof p === 'string' && p.startsWith('@') ? `@${encodeURIComponent(p.slice(1))}` : p
  // An excluded pick is the same with a leading `-`; no card ID, tag key or `@` starts with one.
  const sign = (p: number | string) => (state.excludes?.includes(p) ? `-${pick(p)}` : String(pick(p)))
  if (state.picks.length) params.set('c', state.picks.map(sign).join(','))
  if (state.deck !== undefined) params.set('d', state.deck)
  if (state.near !== undefined) params.set('n', state.near)
  const query = params.toString()
  return query ? `#${query}` : ''
}

/**
 * Parses a URL hash back into filters.
 *
 * Hashes come from bookmarks and may predate a data refresh, so unknown factions or card IDs are
 * dropped rather than rejected (tags too), as is a leader or stratagem ID that isn't one, or a leader outside the chosen faction
 * (the page would show that faction's leaders, none of them selected, and no decks).
 *
 * @param hash - `location.hash`, with or without `#`
 * @param cardOf - A card in the current dataset, or `undefined` if it isn't there
 * @param isTag - Whether a tag key is in the current dataset
 * @param isAuthor - Whether an author key is in the current dataset
 * @param listOf - A deck ID's card list (`IndexedDeck.list`), or `undefined` if the deck isn't there
 * @returns Parsed filters; defaults for anything missing or invalid
 */
export function decodeState(
  hash: string,
  cardOf: (id: number) => Pick<Card, 'type' | 'faction'> | undefined,
  isTag: (key: string) => boolean,
  isAuthor: (key: string) => boolean = () => false,
  listOf: (id: string) => string | undefined = () => undefined,
): FilterState {
  const typeOf = (id: number) => cardOf(id)?.type
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const ids = (key: string, type?: CardType) =>
    (params.get(key) ?? '')
      .split(',')
      .filter(Boolean)
      .map(Number)
      .filter((id) => Number.isInteger(id) && (type ? typeOf(id) === type : typeOf(id) !== undefined))
  const factions = (params.get('f') ?? '').split(',').filter((f): f is Faction => FACTIONS.includes(f as Faction))
  const leader = ids('l', 'leader')[0]
  const deck = params.get('d')
  // Card IDs, tag keys and authors share `c`, in pick order: a number is a card, `@…` an author, anything else a tag;
  // a leading `-` excludes it. A repeated pick keeps its first place and sign.
  const picks = new Map<number | string, boolean>()
  for (const token of (params.get('c') ?? '').split(',')) {
    const excluded = token.startsWith('-')
    const p = excluded ? token.slice(1) : token
    const key = p.startsWith('@') ? decodeAuthor(p.slice(1)) : undefined
    const pick = /^\d+$/.test(p)
      ? typeOf(Number(p)) && Number(p)
      : p.startsWith('@')
        ? key !== undefined && isAuthor(key) && `@${key}`
        : isTag(p) && p
    if (pick !== undefined && pick !== false && !picks.has(pick)) picks.set(pick, excluded)
  }
  const near = params.get('n')
  return {
    deck: deck ? listOf(deck) : undefined,
    near: near && listOf(near) !== undefined ? near : undefined,
    match: params.get('k') === 'any' ? 'any' : 'all',
    factions,
    video: params.get('v') === '1',
    langs: [
      ...new Set((params.get('gl') ?? '').split(',').filter((l) => (LANGUAGES as readonly string[]).includes(l))),
    ],
    budgets: [
      ...new Set(
        (params.get('b') ?? '')
          .split(',')
          // Links from before the steps say just `spare` or `over`: every step on that side.
          .flatMap((b) => (b === 'spare' || b === 'over' ? [`${b}1`, `${b}2`, `${b}3`] : [b]))
          .filter((b): b is Budget => BUDGETS.includes(b as Budget)),
      ),
    ],
    sources: (params.get('src') ?? '').split(',').filter((s): s is Source => SOURCES.includes(s as Source)),
    leader:
      leader !== undefined && factions.length && !factions.includes(cardOf(leader)?.faction as Faction)
        ? undefined
        : leader,
    stratagem: ids('s', 'stratagem')[0],
    picks: [...picks.keys()],
    excludes: [...picks].filter(([, excluded]) => excluded).map(([p]) => p),
  }
}
