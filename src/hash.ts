import { BUDGETS, type Budget, type FilterState } from './filter.ts'
import { type Card, type CardType, FACTIONS, type Faction, SOURCES, type Source } from './types.ts'

/** The state when nothing is selected. */
export const EMPTY_STATE: FilterState = {
  factions: [],
  sources: [],
  budgets: [],
  picks: [],
  match: 'all',
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
  if (state.leader !== undefined) params.set('l', String(state.leader))
  if (state.stratagem !== undefined) params.set('s', String(state.stratagem))
  if (state.picks.length) params.set('c', state.picks.join(','))
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
 * @returns Parsed filters; defaults for anything missing or invalid
 */
export function decodeState(
  hash: string,
  cardOf: (id: number) => Pick<Card, 'type' | 'faction'> | undefined,
  isTag: (key: string) => boolean,
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
  return {
    match: params.get('k') === 'any' ? 'any' : 'all',
    factions,
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
    // Card IDs and tag keys share `c`, in pick order: a number is a card, anything else a tag.
    picks: [
      ...new Set(
        (params.get('c') ?? '')
          .split(',')
          .flatMap((p): (number | string)[] =>
            /^\d+$/.test(p) ? (typeOf(Number(p)) ? [Number(p)] : []) : isTag(p) ? [p] : [],
          ),
      ),
    ],
  }
}
