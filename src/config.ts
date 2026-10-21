/**
 * Build-time settings for people who build their own copy: display limits, the data checks, and where the project
 * lives. Change a value and run `pnpm build` (the page) or the script that reads it; the page bundles them, so
 * `file://` still works. These are not visitor settings, and game rules (deck size, the provision limit) aren't here:
 * they're constants beside the code that applies them (`src/filter.ts`).
 */
export const CONFIG = {
  /** Deck rows rendered before "Show more", and how many each click adds; Craft pages its cards the same way. */
  resultsPageSize: 100,
  /** Cards listed in the "Most/Least common" panel. */
  frequencyBars: 20,
  /** Card suggestions shown while typing. */
  maxSuggestions: 12,
  /** Of those, author suggestions at most: names are many and short, so a few letters would crowd out cards. */
  maxAuthorSuggestions: 3,
  /**
   * Cards (of a deck's 25 besides leader and stratagem) another deck must share to count as similar (≈). At 15, about
   * two in three decks find at least one, typically a handful; raise it for closer variants, lower it for more.
   */
  similarMinShared: 15,
  /**
   * Craft with no faction picked says neutral cards fit every faction when at least half of this many top cards are
   * neutral.
   */
  craftNeutralSample: 10,
  /**
   * The filter labels' column, in em: as wide as the longest label in the page language, within these bounds, so one
   * long label (Russian's are) can't take the row.
   */
  filterLabelEm: { min: 6.9, max: 14 },
  /**
   * The weekly update releases nothing if a source lost more than this share of its decks: a sheet made private or
   * rearranged still answers, but with no deck links.
   */
  maxSourceLoss: 0.25,
  /** The repository: Help's guide link, Credits, version and issue links, and the release notes. */
  repoUrl: 'https://github.com/el8ted/gwentdecksearch',
  /** The live site, linked from release notes, Reddit replies and the translated READMEs. */
  siteUrl: 'https://el8ted.github.io/gwentdecksearch/',
}
