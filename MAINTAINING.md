# Maintaining

How to update the data, publish a release and keep the generated files current. For translations and bug reports,
see [CONTRIBUTING.md](CONTRIBUTING.md).

## How it fits together

- `pnpm build` writes a self-contained site to `dist/`: `index.html`, `styles.css`, `app.iife.js` (with the deck
  data bundled in), `icons/`, `i18n/` (language packs), `LICENSE` and `NOTICE.md`. Every path is relative, so the
  same files work on GitHub Pages and opened straight from disk.
- [data/README.md](data/README.md) explains every data file, how the build turns them into what the app ships, and
  what each scrape warning or error means.
- The live site is <https://el8ted.github.io/gwentdecksearch/>, deployed from this repo by GitHub Actions.
- Each release is also a zip of `dist/` on the [Releases](https://github.com/el8ted/gwentdecksearch/releases) page,
  for offline use.
- Releases are named after the **data date**: the UTC date the decks were collected, e.g. `2026-10-16`. The page
  header shows the same date and time.

## Checks

Run before committing; CI runs the same on every push and pull request (`.github/workflows/ci.yml`):

```bash
pnpm check        # lint and formatting (pnpm check:fix to fix)
pnpm typecheck
pnpm test:coverage  # unit tests, failing any file under 80% coverage (as CI does)
pnpm test:e2e     # builds, then browser tests (Chromium and Firefox)
```

## Branches

- **`main`** is what's live. The scheduled updates commit new data straight to it.
- **`dev`** is where code changes happen. Merge `main` into `dev` before starting work, so you have the latest data:

  ```bash
  git switch dev && git pull && git merge origin/main
  ```

- When `dev` is ready, merge it into `main` and [publish a release](#publishing-a-release).

## Changelog

Players read [CHANGELOG.md](CHANGELOG.md) and the release notes, so write for them, not for developers. With every
change, add a line under `## Unreleased`, e.g. "Phones: the Language menu opens fully on screen (#3)." Put
`Fixes #3` in the commit message as well: the issue closes when the commit reaches `main`.

At release time the workflow puts those lines at the top of the release notes, adds what changed in the data, and
moves them under the release's own heading in the changelog. Data-only releases have no lines of their own.

## Before releasing a new feature

Tests check that a feature works, not that players can find it. Before merging anything players will see, check each
place they'd learn about it:

- **The Search box's placeholder**, if it changes what Search takes (it has to fit a phone: measure, don't guess).
- **Help** (`help.*` phrases): the steps and the sections. Then `pnpm readmes`, since the steps make up the translated
  READMEs.
- **[The guide](docs/guide.md)**: the walkthrough it belongs in, and the reference.
- **The changelog**: a line under `## Unreleased`.
- **Screenshots**, if it's visible: `pnpm build && pnpm screenshots`.
- **Translations**: new or changed phrases in every language, listed under `_needsReview`.

## Automatic data updates

`.github/workflows/update.yml` refreshes the data and, if any deck or card changed, commits it to `main` and publishes
a release. If nothing changed, nothing is released.

**If a source loses more than a quarter of its decks (`maxSourceLoss` in `src/config.ts`), the run fails and nothing
is released.** A sheet that was made private, renamed or rearranged still answers, but yields no deck links. GitHub
emails you about the failed run; the live site keeps its data. Check the source, fix the parser or its address if
needed, and run the update again.

| What | When (UTC) |
|---|---|
| Decks | Saturdays at 00:17 |
| Cards | 18:07, 21:07 and 23:07 on the 28th–31st, and 02:07, 06:07 and 12:07 on the 1st: around each month's end, when the Balance Council changes go live with the new season |

GitHub may start scheduled runs some minutes late. To update now, open **Actions → Update data → Run workflow** and
choose decks, cards or both.

After an automatic update, check:

- the release notes, for unexpected deck counts or card changes;
- `data/source/translations.json`, for new machine-translated deck names to fix. Fixes go in a normal commit; the
  scraper never overwrites them.
- **A new leader or stratagem** shows as text until its icon is added. See [Generated files](#generated-files).

GitHub turns off scheduled workflows in a public repo after 60 days without activity. If that happens, the Actions
tab says so; turn it back on there.

## Updating the data by hand

```bash
pnpm scrape
```

This runs four steps, which can also run on their own:

| Step | What it does |
|---|---|
| `pnpm scrape:cards` | Card data, names and game terms in all 11 languages (~33 requests). Only changes after the monthly Balance Council. |
| `pnpm scrape:decks` | Deck links from every source, then fetches only decks not stored yet. Translates new non-English deck names (MyMemory, which has a daily quota; leftovers wait for the next run). |
| `pnpm scrape:videos` | New uploads on Shinmiri2's YouTube channel, whose descriptions link their decks (1–2 requests). Needs `YOUTUBE_API_KEY`: a repository secret for the weekly update, and a `.env` file (`YOUTUBE_API_KEY=…`, gitignored) for local runs. Without it, videos are skipped with a warning. |
| `pnpm build:data` | Offline. Rebuilds `data/decks.json`, `data/decklist.md` and the language packs from `data/source/`. |

Then review before committing:

- `data/decklist.md`: every deck in one table. Look for odd names and missing decks.
- `data/source/translations.json`: new machine-translated deck names. Fix any that read badly.
- The scrape's warnings: dead links and decks with unknown cards are skipped and listed.

Commit on `dev`, merge to `main`, then [release](#publishing-a-release).

## Adding a deck list

Only with the author's permission (the **Suggest a feature or deck source** issue form asks). A new list needs:

- an entry in `SOURCES`, `SOURCE_NAMES` and `SOURCE_AUTHORS` (`src/types.ts`). `SOURCE_AUTHORS` is the author's
  **playgwent.com name**, exactly as on their community guides, so searching for the author finds their list and
  their guides together;
- the sheet in `SHEETS` (`scripts/lib/entries.ts`), with a parser in `scripts/lib/sources.ts`;
- a colour (`.s-<source>` in `src/styles.css`) and a line under **Where the decks come from** in `README.md`.

## Publishing a release

Automatic updates publish their own releases. To release code changes, after they're on `main`:

```bash
git switch main && git pull
date=$(node -p "require('./data/decks.json').scrapedAt.slice(0, 10)")
git tag "$date" && git push origin "$date"
```

If that date is already a release (the data hasn't changed), add a two-digit suffix: `2026-10-16.02`,
`2026-10-16.03` and so on, so tags sort in release order.

The tag starts `.github/workflows/release.yml`, which:

1. runs every check (the same jobs as CI);
2. stops if the tag doesn't match the data date;
3. builds `dist/` and deploys it to the live site;
4. creates a GitHub Release named after the tag, with `gwent-deck-search-<tag>.zip` attached and notes built from the
   changelog and the data changes;
5. moves the changelog's Unreleased lines under the tag and commits that to `main`.

Follow it in the **Actions** tab. A release takes a few minutes.

**If a release fails:** fix the problem, delete the tag and push it again:

```bash
git push --delete origin 2026-10-16 && git tag -d 2026-10-16
# fix, commit, push to main, then tag again
```

If the site deployed but the release step failed, delete the half-made release in the Releases page first.

## Generated files

These are committed, and rebuilt by a script when their inputs change:

| Files | Rebuild with | When |
|---|---|---|
| `src/icons/s-*.webp`, `l-*.webp`, `src/art.ts` | `python3 scripts/card-art.py && pnpm check:fix` (needs Pillow) | A new leader or stratagem appears (it shows as text until then). |
| `src/favicon/*` (site icons and `favicon.ico`) | `python3 scripts/favicon.py` (needs Pillow) | `src/favicon/source-16.png`, the 16×16 pixel-art original, changes. Larger sizes are whole-number enlargements, so keep the source 16×16. Drawn by el8ted's daughter: changing it would make el8ted sad and disappoint a young woman. |
| `docs/screenshots/*.png` | `pnpm build && pnpm screenshots` | The UI changes. Unchanged images are left alone. The script stops if new data breaks an example. |
| `docs/README.{lang}.md` | `pnpm readmes` | `help.*` phrases change in `src/i18n/`. |
| `data/decks.json`, `data/decklist.md`, `data/i18n/*.js` | `pnpm build:data` | Anything in `data/source/` changes. |

## Replying on Reddit

When someone shares a deck on Reddit, `pnpm reddit <playgwent.com deck or guide link>` prints a short comment to paste
in reply: the deck's gameplay video and, if it's over today's provision limit, the close decks that still fit, each
linked into the site. It uses the local `data/decks.json`, so pull or `pnpm build:data` first.

It prints nothing, and says why, when the deck has no video and fits: a reply with nothing new in it is just an ad.
Add `--author` when you're the site's author: it ends the comment with "I made Gwent Deck Search; happy to answer
questions." (true only for you, so it's not the default). A sentence of your own about the post reads better than any
template.
Post by hand, only where it helps, and check the subreddit's rules on links and self-promotion first.

## First-time setup

Done once, in the repo's **Settings**:

1. **Pages → Build and deployment → Source:** GitHub Actions.
2. **Environments → github-pages → Deployment branches and tags:** add a **tag** rule `20*`. Without it, GitHub only
   lets the default branch deploy, and the release workflow's deploy step is refused.
3. **General → Features:** turn on Issues.
4. **Issues → Labels:** create `data` and `translation` (`bug` and `enhancement` exist already). The issue forms in
   `.github/ISSUE_TEMPLATE/` use them.

## Keg value numbers

`pnpm kegs [faction]` (default `MO`) prints the Markdown tables behind the keg-buying guide: what faction, neutral and
general kegs are worth as a collection fills, and how many kegs it takes to own a faction's bronzes and half its golds.
It simulates players opening kegs against `data/source/cards.json`, counting as wanted either every card or only the
cards in at least 1% / 5% of `data/decks.json`'s decks that could run them. Seeded, so a rerun prints the same numbers
until the data changes; rerun after a balance patch and a refresh. The odds and mill values it assumes are in
`scripts/lib/kegs.ts`.
