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
  /**
   * Cards (of a deck's 25 besides leader and stratagem) another deck must share to count as similar (≈). At 15, about
   * two in three decks find at least one, typically a handful; raise it for closer variants, lower it for more.
   */
  similarMinShared: 15,
}
