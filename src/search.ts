/**
 * The search's rules: what each change does to the filters, as pure functions. The page applies the result (URL,
 * history, redraw); keeping the rules here means they're tested without a browser.
 */
import {
  BUDGETS,
  budgetSide,
  type FilterState,
  type IndexedDeck,
  pickedCards,
  singleFaction,
  wantedPicks,
} from './filter.ts'
import { EMPTY_STATE, encodeState } from './hash.ts'
import type { Dataset, Faction } from './types.ts'

/** What the search remembers that isn't in the URL, so a reload or a shared link starts without it. */
export interface SearchMemory {
  /** The faction adding a card turned on; dropped again when the last such card goes (see {@link removePick}). */
  autoFaction?: Faction
  /** A deck link replaced an earlier search: the page says so, and that Back brings it back. */
  deckReplaced: boolean
  /** The search before ≈, which ✕ on the Similar pill restores. */
  beforeNear?: FilterState
}

/** Memory with nothing remembered. */
export const NO_MEMORY: SearchMemory = { deckReplaced: false }

/** A change to the search: the filters to set, what to remember, and whether Back should undo it. */
export interface Step {
  next: Partial<FilterState>
  memory: SearchMemory
  /** A new history entry; filter tweaks replace the current one so they don't flood the Back button. */
  push?: boolean
}

/** No filter at all; spread over a state to clear it, as the keys `EMPTY_STATE` leaves out are undefined. */
const NOTHING: Partial<FilterState> = {
  ...EMPTY_STATE,
  leader: undefined,
  stratagem: undefined,
  deck: undefined,
  near: undefined,
}

/**
 * Clear all: every filter goes, but All/Any and the Decks/Craft view stay, since they're how you search, not what for.
 *
 * @param s - Current filters
 * @returns The cleared search, as a new history entry
 */
export function clearAll(s: FilterState): Step {
  return { next: { ...NOTHING, match: s.match, tab: s.tab }, memory: NO_MEMORY, push: true }
}

/**
 * Picks a faction pill: exclusive, so it switches to that faction, and clicking the selected one clears it. The
 * choice becomes the visitor's own, so removing a card no longer undoes it.
 *
 * @param s - Current filters
 * @param m - Current memory
 * @param f - The faction clicked
 * @returns The change
 */
export function chooseFaction(s: FilterState, m: SearchMemory, f: Faction): Step {
  const only = s.factions.length === 1 && s.factions[0] === f
  return { next: { factions: only ? [] : [f] }, memory: { ...m, autoFaction: undefined } }
}

/**
 * Shows the decks with one card list (a pasted link, or ⧉), replacing the whole search; Back restores it. It opens
 * the deck list even from Craft, since a deck link is for seeing that deck.
 *
 * @param s - Current filters
 * @param list - The card list ({@link IndexedDeck.list})
 * @returns The change, remembering whether there was a search to replace
 */
export function showDeck(s: FilterState, list: string): Step {
  return {
    next: { ...NOTHING, match: s.match, deck: list, tab: undefined },
    memory: { ...NO_MEMORY, deckReplaced: encodeState({ ...s, match: 'all' }) !== '' },
    push: true,
  }
}

/**
 * Stops showing one card list.
 *
 * @param m - Current memory
 * @returns The change
 */
export function removeDeck(m: SearchMemory): Step {
  return { next: { deck: undefined }, memory: { ...m, deckReplaced: false } }
}

/**
 * ≈: ranks decks by cards in common with one, as visible filters (its faction and leader, and only decks that fit:
 * Spare or Exact). Picks and the other filters stay.
 *
 * @param s - Current filters
 * @param m - Current memory
 * @param target - The deck to compare with
 * @returns The change, remembering the search before the first ≈ so ✕ goes all the way back
 */
export function showNear(s: FilterState, m: SearchMemory, target: IndexedDeck): Step {
  return {
    next: {
      near: target.deck.id,
      deck: undefined,
      factions: [target.faction],
      leader: target.leader,
      stratagem: undefined,
      budgets: BUDGETS.filter((b) => budgetSide(b) !== 'over'),
    },
    memory: { deckReplaced: false, beforeNear: s.near === undefined ? s : m.beforeNear },
    push: true,
  }
}

/**
 * Undoes ≈: the search before it; or, opened from a shared link (nothing to restore), drops the leader and provision
 * steps ≈ set.
 *
 * @param m - Current memory
 * @returns The change
 */
export function removeNear(m: SearchMemory): Step {
  const next = m.beforeNear
    ? { ...NOTHING, ...m.beforeNear, near: undefined }
    : { near: undefined, leader: undefined, budgets: [] }
  return { next, memory: { ...m, beforeNear: undefined, autoFaction: undefined } }
}

/**
 * Adds a card, tag or author after the other picks, wanted or excluded. A pick searches across decks, so a shown card
 * list stops narrowing the results; a wanted faction card also selects its faction when none is.
 *
 * @param s - Current filters
 * @param m - Current memory
 * @param pick - Card ID, tag key, or `@` + author key
 * @param cards - The card table, for the card's faction
 * @param excluded - Whether it's a pick decks must not have
 * @returns The change; `undefined` if it's already picked
 */
export function addPick(
  s: FilterState,
  m: SearchMemory,
  pick: number | string,
  cards: Dataset['cards'],
  excluded = false,
): Step | undefined {
  if (s.picks.includes(pick)) return undefined
  const next = {
    picks: [...s.picks, pick],
    excludes: excluded ? [...(s.excludes ?? []), pick] : s.excludes,
    deck: undefined,
  }
  const faction = typeof pick === 'number' && !excluded ? singleFaction(cards[pick]) : undefined
  return faction && s.factions.length === 0
    ? { next: { ...next, factions: [faction] }, memory: { ...m, deckReplaced: false, autoFaction: faction } }
    : { next, memory: { ...m, deckReplaced: false } }
}

/** Clears the faction a card turned on once no wanted card of that faction remains. */
function undoAutoFaction(
  next: Pick<FilterState, 'picks' | 'excludes'>,
  m: SearchMemory,
  cards: Dataset['cards'],
): Step {
  const keep = pickedCards(wantedPicks(next)).some((c) => singleFaction(cards[c]) === m.autoFaction)
  return m.autoFaction === undefined || keep
    ? { next, memory: m }
    : { next: { ...next, factions: [] }, memory: { ...m, autoFaction: undefined } }
}

/**
 * Removes a card, tag or author.
 *
 * @param s - Current filters
 * @param m - Current memory
 * @param pick - The pick
 * @param cards - The card table, for factions
 * @returns The change
 */
export function removePick(s: FilterState, m: SearchMemory, pick: number | string, cards: Dataset['cards']): Step {
  const next = { picks: s.picks.filter((p) => p !== pick), excludes: s.excludes?.filter((p) => p !== pick) }
  return undoAutoFaction(next, m, cards)
}

/**
 * Switches a pick between wanted and excluded, keeping its place.
 *
 * @param s - Current filters
 * @param m - Current memory
 * @param pick - The pick
 * @param cards - The card table, for factions
 * @returns The change
 */
export function flipPick(s: FilterState, m: SearchMemory, pick: number | string, cards: Dataset['cards']): Step {
  const on = s.excludes ?? []
  const next = { picks: s.picks, excludes: on.includes(pick) ? on.filter((p) => p !== pick) : [...on, pick] }
  return undoAutoFaction(next, m, cards)
}
