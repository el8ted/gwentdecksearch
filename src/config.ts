/**
 * Build-time display defaults for people who build their own copy. Change a value and run `pnpm build`; the
 * result is bundled, so `file://` still works. These are not visitor settings.
 */
export const CONFIG = {
  /** Deck rows rendered before "Show more", and how many each click adds. */
  resultsPageSize: 100,
  /** Cards listed in the "Most/Least common" panel. */
  frequencyBars: 20,
  /** Card suggestions shown while typing. */
  maxSuggestions: 12,
}
