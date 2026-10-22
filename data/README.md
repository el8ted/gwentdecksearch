# The data folder

Everything the site knows about decks and cards lives here. This guide explains what each file is, how the scripts
turn the raw sources into what the app ships, and how to read the files when something looks wrong: a deck missing, a
name untranslated, a scrape that stops with an error.

For running the scrape and publishing, see [MAINTAINING.md](../MAINTAINING.md). For adding your own deck list, see
[Adding a deck list](../MAINTAINING.md#adding-a-deck-list).

## At a glance

```text
data/
├── source/               inputs: what the scrapers fetched (committed)
│   ├── entries.json        every deck link from every source, in priority order
│   ├── deck-store.json     each link's card list, as fetched (and guide measures)
│   ├── cards.json          the card catalog: costs, factions, tags
│   ├── card-names.json     card names in the 10 other languages
│   ├── terms.json          official game terms in the 10 other languages
│   ├── tags.json           deck-builder tag names, all 11 languages
│   ├── videos.json         YouTube uploads that link a deck
│   ├── translations.json   English names for non-English deck names (hand-fixable)
│   ├── categories.json     extra glossary for translating deck names (hand-kept)
│   └── refreshed.json      when each refresh last ran
├── decks.json            OUTPUT: the dataset bundled into the app
├── decklist.md           OUTPUT: every deck in one table, for review
├── i18n/{lang}.js        OUTPUT: language packs the app loads on demand
└── cache/                local only (gitignored); see "The cache folder"
```

**Rule of thumb:** `source/` is what the outside world said; the three outputs are rebuilt from it by
`pnpm build:data`, offline, every time. Never edit an output by hand: the next build overwrites it. The one input meant
for hand edits is `translations.json`.

## How the data flows

```text
playgwent card search ─┐
playgwent deck builder ─┴─ pnpm scrape:cards ──► cards.json, card-names.json, terms.json, tags.json
                                                                              │
playgwent guide listing ─┐                                                    │
Shinmiri2's sheet ───────┼─ pnpm scrape:decks ─► entries.json ──┐             │
MetallicDanny's sheet ───┘   (fetches only new decks)  deck-store.json ──────┤
                             (translates new names)  translations.json ──────┤
                                                                              │
Shinmiri2's YouTube ──────── pnpm scrape:videos ─► videos.json ──────────────┤
                                                                              ▼
                                                     pnpm build:data (offline)
                                                                              │
                                     ┌────────────────────┬───────────────────┤
                                     ▼                    ▼                   ▼
                                decks.json          i18n/{lang}.js       decklist.md
                                     │                    │
                       pnpm build ───┤ bundled into       │ copied to
                                     ▼ dist/app.iife.js   ▼ dist/i18n/
```

`pnpm scrape` runs all four steps in order. The scheduled GitHub Action refreshes decks and videos every Saturday,
and cards around each month's end, then builds.

## How the app uses it

- **`decks.json` is compiled into the app.** `src/data.ts` imports it, and `pnpm build` bundles it into
  `dist/app.iife.js`. There's no server and no fetching at runtime, which is why the site also works opened straight
  from disk. Changing the data means rebuilding the app.
- **On load, the app indexes every deck once** (`indexDecks` in `src/filter.ts`): it finds each deck's leader and
  stratagem, takes the faction from the leader, and works out the provision status against today's limit
  (**150 + the leader's bonus**, from `cards.json`'s current numbers). A deck without exactly one leader and one
  stratagem stops the page with an error, which is why the build refuses to write such a deck.
- **Language packs load on demand.** Picking a language adds a `<script src="i18n/ru.js">` tag; the pack registers
  itself on `globalThis.GDS_I18N`. Until it loads, or if it fails, the page shows English card names.
- **Everything is keyed by playgwent IDs:** card IDs (numbers) and deck codes (the hash in a deck's URL). Names are
  only for display, and change with language.

## Inputs: `data/source/`

Written by the scrapers, except where noted. All are JSON with sorted keys, so diffs between runs stay readable.

### `entries.json`: every deck link

An array, one object per link a source lists. The order matters: community guides first, then Shinmiri2, then
MetallicDanny. When two sources list the same deck, **the first entry names it** and every source is kept.

```json
{
  "name": "Накер Реликты",
  "url": "https://www.playgwent.com/decks/369b571a547bc69c7538d77c220f95ce",
  "lang": "ru",
  "source": "metallic-danny",
  "video": { "url": "https://youtu.be/7cBS4D6jgbo", "lang": "ru" }
}
```

| Field | Meaning |
|---|---|
| `url` | The link, **normalized**: no language segment, so `…/en/decks/x` and `…/decks/x` compare equal. It's the key into `deck-store.json`. Guides look like `…/decks/guides/408411`, other decks `…/decks/{deck code}`. |
| `lang` | The language the deck is fetched in, and its name's language. |
| `guide` | Community guides only: `id`, `modified` (the listing's date), `votes`, `author`. |
| `video` | A video the source links for this deck, if any. |

Rewritten in full on every deck refresh. Sheets are read back 12 months of patch tabs (each sheet's main list, and MetallicDanny's archetype list, always in full), guides 18 months.

### `deck-store.json`: what each link holds

An object keyed by normalized URL. A published deck never changes, so a link is fetched once and kept; a guide is
fetched again only when its author edits it (the listing's `modified` moves). Links that disappear from every source
stay here but aren't built.

```json
"https://www.playgwent.com/decks/guides/391053": {
  "hash": "02538565e2b0e7eef4f5427e6bc1b915",
  "cards": [[201580, 1], [162315, 2], …],
  "modified": "2026-09-30T22:04:54+00:00",
  "guideModified": "2026-01-14T05:57:04+00:00",
  "guide": { "words": 93, "unique": 68, "images": 1, "lang": "en", "video": "https://youtu.be/ulPXihVSQ00" }
}
"https://www.playgwent.com/decks/b2931ab079cb7bbbe67686c24b7e": { "missing": true }
```

| Field | Meaning |
|---|---|
| `hash` | The deck code. Two links with the same code are the same deck, listed once. |
| `cards` | `[card ID, copies]` exactly as playgwent returned them, in no guaranteed order (find the leader and stratagem by their `type` in `cards.json`). playgwent leaves out the default stratagem (Tactical Advantage, 202140); the build adds it back. |
| `modified`, `guideModified` | The deck's own date, and the guide listing's date when it was fetched. A different listing date on the next run means the guide was edited. |
| `guide` | Guides only: word counts (`unique` = distinct words), images, the language the text reads as (when the detector is sure) and the first YouTube video it embeds or links. The guide's text itself isn't kept here. |
| `missing` | The link answered "not found". It's retried on every run. |

### `cards.json`: the card catalog

Every card in the game, keyed by card ID, from playgwent's deck-builder search. These are **current** values: when the
Balance Council changes a cost, this file changes, and every deck's provisions and status follow at the next build.

```json
"202294": {
  "name": "Courier", "type": "unit", "faction": "SY", "secondaryFaction": "NG",
  "provisions": 4, "power": 5, "craftingCost": 30, "rarity": 5,
  "tags": ["c78", "c75", "c99", "deploy", "melee", "ranged"]
}
```

- `faction`: `MO` Monsters, `NG` Nilfgaard, `NR` Northern Realms, `SK` Skellige, `ST` Scoia'tael, `SY` Syndicate,
  `NE` neutral. `secondaryFaction` marks a dual-faction card.
- `type`: `leader`, `stratagem`, `unit`, `special` or `artifact`. For a leader, `provisions` is its bonus to the
  150 limit.
- `tags`: categories as `c{id}` (`c12` is Beast) and abilities by slug (`deploy`). Names are in `tags.json`.

### `card-names.json`, `terms.json`, `tags.json`: names in other languages

| File | Shape | Example |
|---|---|---|
| `card-names.json` | language → card ID → name | `"ru": { "112101": "Цири" }` |
| `terms.json` | language → phrase key → official term | `"de": { "faction.NG": "Nilfgaard" }` |
| `tags.json` | language → tag key → name (English included) | `"ru": { "c12": "Зверь", "devotion": "Преданность" }` |

English card names are in `cards.json`; English terms come from the site's own phrase file (`src/i18n/en.json`).
`terms.json` covers the few phrases where the site uses playgwent's official wording (faction names, "Stratagem",
"Provisions"…), which then override the site's own translation.

### `videos.json`: channel uploads

Channel ID → video ID → the deck links in that video's description. Read through the YouTube Data API (needs
`YOUTUBE_API_KEY`); each run adds only new uploads.

```json
"UCZhWZdKjn0e3ctyVZxsMkKQ": {
  "-6jRkb1iCrs": { "published": "2026-02-12T12:00:37Z", "decks": ["https://www.playgwent.com/decks/5b44…"] }
}
```

A deck's video is chosen in this order: the guide's own embedded video, then a video its list links, then the
newest channel upload whose description links the same deck code.

### `translations.json`: English deck names (hand-fixable)

Language → original deck name → English name. When a non-English deck has no entry, the deck refresh fills one in:
first word by word from a glossary (card names, plus `categories.json`), then by machine translation (MyMemory) for
what's left. **Fix a bad translation by editing it here**; the scraper never overwrites an existing entry.

### `categories.json`: glossary extra (hand-kept)

Language → localized card-category phrase → English, e.g. `"de": { "Bestie, Verflucht": "Beast, Cursed" }`. Only used to
translate deck names word by word. No script writes it.

### `refreshed.json`

`{ "cards": "…", "decks": "…" }`: when each refresh last ran. The newer one is the **data date**: shown in the page
header, and the name of the release.

## Outputs

### `decks.json`: the dataset

```json
{
  "scrapedAt": "2026-10-18T17:02:03.534Z",
  "cards": { "122105": { "name": "Lined Pockets", "type": "leader", "faction": "SY", "provisions": 15, "tags": […] } },
  "tags": { "c12": "Beast", "devotion": "Devotion", … },
  "decks": [ … ]
}
```

- `cards` holds only cards some deck uses, with only the fields the app needs. `tags` holds the English name of every
  tag on those cards.
- `decks` holds each deck once (by deck code):

```json
{
  "name": "Brute Bounty",
  "id": "9080a8ec62ff74faf61b004484d0cc4d",
  "url": "https://www.playgwent.com/decks/guides/408386",
  "updated": "2026-10-17T06:13:56+00:00",
  "stats": { "scraps": 8700, "cards": 25, "units": 17, "provisions": 166 },
  "sources": ["community"],
  "votes": 1, "author": "GOSU..",
  "guideLang": "ko",
  "video": { "url": "https://youtu.be/56liX4qBcAQ", "lang": "ko" },
  "original": { "lang": "ko", "name": "Brute Bounty(브루트 현상금)" },
  "cards": [[202303, 1], [202786, 1], …]
}
```

| Field | How it's made |
|---|---|
| `name` | English: the original if it was English, else `translations.json`. A guide published without a name gets its leader's name. |
| `original` | The source's own name and language, for visitors using that language. |
| `stats` | Computed from today's `cards.json`: `provisions` excludes the leader; `scraps` counts only the fetched copies. |
| `guideLang` | Guides with real text only: the detected language, else the author's setting. Filler text ("text text text") gets none. |
| `cards` | As fetched, with the default stratagem added when playgwent left it out. |

### `i18n/{lang}.js`: language packs

One small script per language (not English), registering `{ terms, cards, tags }` for that language: official terms,
the names of the cards in use, and tag names. Anything missing falls back to English.

### `decklist.md`: the review table

Every deck in one Markdown table (faction, leader, name, original name, code, sources, votes). Not used by the app:
it's for reading a refresh's result at a glance, or diffing it in a pull request.

## The cache folder

`data/cache/` is gitignored and only ever on your own machine.

- `guide-text.json` holds each guide's plain text, written by the deck refresh. It's there so guide measures can be
  recomputed without refetching every guide. Safe to delete; it fills again as guides are fetched.
- Other folders there (`card-search/`, `decks/`, `guides/`, `listing/`, `mt/`, `sheets/`, …) are left over from an
  earlier version of the scraper. Nothing writes them now. **Known issue:** `scripts/card-art.py` still reads
  `data/cache/card-search/`, so on a fresh clone it can't find its input.

## Decoding: recipes

Run these from the repo root. Each prints JSON.

```bash
# A card by ID
node -p 'require("./data/source/cards.json")[202140]'

# A deck by the start of its code (the 8 characters shown on the site)
node -p 'require("./data/decks.json").decks.find((d) => d.id.startsWith("9080a8ec"))'

# What a deck's card IDs are, by name
node -p 'const d = require("./data/decks.json"); d.decks.find((x) => x.id.startsWith("9080a8ec")).cards.map(([id, n]) => `${n}× ${d.cards[id].name}`)'

# Every source link for a deck code, and what was stored for it
node -p 'const s = require("./data/source/deck-store.json"); Object.entries(s).filter(([, v]) => v.hash?.startsWith("9080a8ec"))'

# Every entry a source gave for a link
node -p 'require("./data/source/entries.json").filter((e) => e.url.endsWith("/guides/408386"))'

# A card's tags, by name
node -p 'const c = require("./data/source/cards.json")[202294], t = require("./data/source/tags.json").en; c.tags.map((k) => t[k])'
```

**Following one deck end to end:** find its link in `entries.json` (who lists it, in which language), look the link up
in `deck-store.json` (its code and cards, or `missing`), then find the code in `decks.json` (the built deck). If it's
in the first two but not the third, the build skipped it: the build's warnings say why.

## When something goes wrong

Each step prints warnings (the run carries on) or stops with an error (nothing is written).

| Message | Step | What it means | What to do |
|---|---|---|---|
| `not found: [source] name — url` | decks, build | The link answers "not found": deleted or made private. Stored as `missing`, retried every run. | Nothing, unless it's many: then check the source. |
| `not fetched: …` | build | A link in `entries.json` has no entry in `deck-store.json`. | Run `pnpm scrape:decks`. |
| `…: skipped, unknown cards 203300, …` | build | The deck uses cards `cards.json` doesn't have: new cards from a patch. | Run `pnpm scrape:cards`, then build again. |
| `…: not exactly one leader/stratagem` | build (stops) | A stored deck is malformed. | Look the link up in `deck-store.json`; remove its entry to refetch it. |
| `guide deck changed: …` | decks | An author edited a guide's deck. | Nothing: the new list replaces the old. |
| `{lang}: N cards have no localized name; using English` | build | `card-names.json` lacks some cards. | Run `pnpm scrape:cards`. |
| `tags with no English name, left out: …` | build | A card has a tag `tags.json` has no name for. | Run `pnpm scrape:cards`; if it stays, playgwent added a tag. |
| `MyMemory stopped (…); deferring the rest` | decks | The translation service's daily quota ran out. | Nothing: untranslated names wait for the next run. Or add them to `translations.json`. |
| `…: no patch tabs in the window; tab list layout may have changed` | decks | A sheet's tab names no longer look like patches. | Check the sheet; adjust `tabPatch` in `scripts/lib/sources.ts`. |
| `Not a zip archive` | decks | A sheet's spreadsheet export came back as a web page, usually because the sheet was made private. | Check the sheet's sharing. |
| `Unknown card type code …`, `Unknown faction code …` | cards (stops) | playgwent changed its card data. | Update the maps in `scripts/lib/cards.ts`. |
| `No data-translations…`, `No data-state attribute on playgwent deck builder`, `playgwent translation "…" missing`, `…lists no tags` | cards (stops) | playgwent changed its deck-builder page. | Update `scripts/lib/terms.ts`. |
| `No data-state attribute`, `data-state has no deck` | decks (stops) | A deck page (not a guide) no longer carries its deck where expected: playgwent changed its deck pages. | Update `scripts/lib/extract.ts`. |
| `No throttle configured for host` | any (stops) | A script fetched from a site it has no request delay for. | Add the host to the script's `createPoliteFetch` delays, after checking its robots.txt. |
| `HTTP 429/5xx …; retrying` | any | The site is busy or rate-limiting. Retried three times, then the run stops. | Wait and run again; stored data is kept. |
| `No YOUTUBE_API_KEY: channel videos not refreshed` | videos | No key, so channel videos are skipped. Never blocks a release. | Add `YOUTUBE_API_KEY=…` to `.env` (see MAINTAINING.md). |
| `A source lost more than a quarter of its decks; not releasing` | weekly update | A source shrank sharply, often a sheet made private or rearranged. | Check the source before releasing. |

## Quirks worth knowing

- **Deck codes repeat across sources.** The same list can be a guide, a Shinmiri2 row and a MetallicDanny row. It's one
  deck with three sources; its name comes from the first entry.
- **The default stratagem is invisible upstream.** playgwent omits Tactical Advantage from a deck's card list, so a
  stored deck may have no stratagem; the build adds it.
- **Costs are always today's.** A deck published two patches ago is shown with current costs, which is what makes
  "spare" and "over" meaningful.
- **A few tag keys are capitalised** (`Deploy`, `Spring`, `Bloodthirst`) in `tags.json` for most languages: card texts
  occasionally use them that way. They're unused extras; cards use the lowercase keys.
