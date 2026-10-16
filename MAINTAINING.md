# Maintaining

How to update the data, publish a release and keep the generated files current. For translations and bug reports,
see [CONTRIBUTING.md](CONTRIBUTING.md).

## How it fits together

- `pnpm build` writes a self-contained site to `dist/`: `index.html`, `styles.css`, `app.iife.js` (with the deck
  data bundled in), `icons/`, `i18n/` (language packs), `LICENSE` and `NOTICE.md`. Every path is relative, so the
  same files work on GitHub Pages and opened straight from disk.
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
pnpm test:run     # unit tests
pnpm test:e2e     # builds, then browser tests (Chromium and Firefox)
```

## Updating the data

```bash
pnpm scrape
```

This runs three steps, which can also run on their own:

| Step | What it does |
|---|---|
| `pnpm scrape:cards` | Card data, names and game terms in all 11 languages (~33 requests). Only changes after the monthly Balance Council. |
| `pnpm scrape:decks` | Deck links from every source, then fetches only decks not stored yet. Translates new non-English deck names (MyMemory, which has a daily quota; leftovers wait for the next run). |
| `pnpm build:data` | Offline. Rebuilds `data/decks.json`, `data/decklist.md` and the language packs from `data/source/`. |

Then review before committing:

- `data/decklist.md`: every deck in one table. Look for odd names and missing decks.
- `data/source/translations.json`: new machine-translated deck names. Fix any that read badly.
- The scrape's warnings: dead links and decks with unknown cards are skipped and listed.

Commit on `dev`, merge to `main`, then [release](#publishing-a-release).

## Publishing a release

After the data and code you want are on `main`:

```bash
git switch main && git pull
date=$(node -p "require('./data/decks.json').scrapedAt.slice(0, 10)")
git tag "$date" && git push origin "$date"
```

The tag starts `.github/workflows/release.yml`, which:

1. runs every check (the same jobs as CI);
2. stops if the tag doesn't match the data date;
3. builds `dist/` and deploys it to the live site;
4. creates a GitHub Release named after the tag, with `gwent-deck-search-<tag>.zip` attached.

Follow it in the **Actions** tab. A release takes a few minutes.

**Releasing again with the same data** (a code fix, say): add a suffix, `2026-10-16.2`, `2026-10-16.3` and so on.

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
| `docs/screenshots/*.png` | `pnpm build && pnpm screenshots` | The UI changes. Unchanged images are left alone. The script stops if new data breaks an example. |
| `docs/README.{lang}.md` | `pnpm readmes` | `help.*` phrases change in `src/i18n/`. |
| `data/decks.json`, `data/decklist.md`, `data/i18n/*.js` | `pnpm build:data` | Anything in `data/source/` changes. |

## First-time setup

Done once, in the repo's **Settings**:

1. **Pages → Build and deployment → Source:** GitHub Actions.
2. **Environments → github-pages → Deployment branches and tags:** add a **tag** rule `20*`. Without it, GitHub only
   lets the default branch deploy, and the release workflow's deploy step is refused.
3. **General → Features:** turn on Issues.
4. **Issues → Labels:** create `data` and `translation` (`bug` and `enhancement` exist already). The issue forms in
   `.github/ISSUE_TEMPLATE/` use them.
