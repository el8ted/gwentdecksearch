/**
 * The page's state in one place: the filters (also in the URL), what the search remembers beyond them, how the
 * results are shown, and the language. The other modules read and update this object, so every reset is in one file.
 */
import { CONFIG } from './config.ts'
import { decks, readHash } from './data.ts'
import { type Facets, type FilterState, facets } from './filter.ts'
import { LANG_KEY, type Locale, pickLanguage } from './i18n.ts'
import { NO_MEMORY, type SearchMemory } from './search.ts'
import { readStorage } from './ui/dom.ts'
import { makeLocale } from './ui/locale.ts'

/** View choices Clear all resets; they aren't in the URL, so a shared link opens without them. */
export const freshView = () => ({
  /** Decks opened to their card list, by ID. */
  expanded: new Set<string>(),
  /** Dim cards every listed deck shares, so each deck's own cards stand out; a Similar list compares each deck with
   * This deck instead (Show changes). */
  dimCommon: false,
  /** Deck rows rendered; back to one page whenever the results change. */
  limit: CONFIG.resultsPageSize,
})

const state: FilterState = readHash()

export const session = {
  /** The filters; the URL's hash mirrors them. */
  state,
  /** What the search remembers that isn't in the URL (see {@link SearchMemory}). */
  memory: NO_MEMORY as SearchMemory,
  /** Deck counts per filter option, for the current filters. */
  current: facets(decks, state) as Facets,
  loc: makeLocale(
    pickLanguage(new URLSearchParams(location.search).get('lang'), readStorage(LANG_KEY), navigator.languages),
  ) as Locale,
  /** How the results are shown, as opposed to which decks match. */
  view: {
    ...freshView(),
    /** Side-panel ordering; kept through Clear all. */
    freq: 'most' as 'most' | 'least',
    /** Craft cards ticked Have it, and the scraps typed in: about the player rather than the search, so they're kept
     * through Clear all, but only for this visit (nothing is stored). */
    have: new Set<number>(),
    scraps: undefined as number | undefined,
  },
  /** Deck IDs listed now, for Expand/Collapse all, and whether they're all open. */
  shown: [] as string[],
  allOpen: false,
  /** Decks matching now, for exclude suggestions' "would remain" counts. */
  matchCount: 0,
}
