# Helper scripts

Command-line helpers over the site's data. The site doesn't need them: they answer questions about the decks and the
economy, or help share the site. For the scripts that keep the site running (scraping, building the data, releases), see
[MAINTAINING.md](../MAINTAINING.md).

Each reads the committed data (`data/decks.json` and `data/source/`), so pull or run `pnpm build:data` first, and prints
Markdown you can paste anywhere.

**What the data is:** decks published as playgwent guides and in two curated lists (Shinmiri2, MetallicDanny), not
ladder play. Provisions are checked against today's limit; power and ability changes don't show in deck lists. Every
report says so in its first line; keep that line when you quote the numbers.

## Naming cards

`whatif` and `package` take cards by name in any of the site's 11 languages, or by ID; case and accents don't matter.
A name that could mean more than one card stops the run and lists the candidates with their IDs, so nothing is guessed:

```text
line 1: "先知" could be any of these; use the full name or the ID:
  200136  先知 (Farseer) (ST unit, 6 provisions)
  203111  先知 (Prophet) (NG unit, 7 provisions)
```

`--lang <code>` shows names in that language beside the English (for example, `--lang zh-cn` or `--lang ru`).

## `pnpm whatif <ballot>`

What a Balance Council ballot would do to the published decks. The ballot has four lists (power increase, power
decrease, provision increase, provision decrease) of three ranked picks each, 3 being the top pick; each change that
passes moves a card by one. Copy [examples/ballot-template.txt](examples/ballot-template.txt) (the 12 empty slots)
and fill it in, or see [examples/ballot-example.txt](examples/ballot-example.txt):

```text
Provision increase
3. Kolgrim
2. Caranthir Ar-Feiniel
1. Baccalà
- Ulula                      # an extra
- Toussaintois Hospitality   # a leader: its bonus goes up, so its decks gain a provision

Provision decrease
3. Eldain
2. Sigi Reuven
1. Prince Stennis
1. Vilgefortz Renegade       # tied with the line above
```

- **More than three picks**, as coalition lists often have (several picks tied on votes): add lines under the same
  heading, ranked (`1. Card` again for a tie) or unranked (`- Card`). Empty slots are skipped.
- **Provision changes** count the decks pushed over today's limit, brought back within it, still within and still
  over. A leader's provisions are its bonus, so a provision increase there brings its decks back within the limit.
- **Power changes** count the decks running the card, as touched: deck lists can't show strength.
- Only units have power: a power change on a special, artifact or leader stops the run.
- A card can be on one power list and one provision list, not on both lists of either.
- The report is a table per ballot list (power increase, power decrease, provision increase, provision decrease), a
  row per change: the change (`5 → 6`), its rank, the card and its faction, the decks running it, its most common
  leader (a leader's own row shows 100%), and its decks in each of the last four half-years (so a live archetype and
  a fading one look different). The provision tables also count the decks that cross today's limit either way. For
  a ballot, a short section follows with all the changes together and the decks hit by two or more. `--detail` adds
  a section per change, under its list's table: every effect (still within, still over), and the decks' factions,
  leaders and half-years in full.

  ```text
  ## Provision increase
  | Change | Rank | Card | Faction | Decks | Pushed over | Back within | Top leader | 2025 H1 · 2025 H2 · 2026 H1 · 2026 H2 |
  | 9 → 10 | 2 | Caranthir Ar-Feiniel | MO | 107 | 32 | 0 | Force of Nature 41% | 15 · 34 · 25 · 17 |
  ```

  The newest half-year is only as far as the data goes, so it's usually partial.

Lists posted online often shorten names ("E. Eclipse Deacon", "DB Archer"). Punctuation doesn't matter, but a name
that isn't a card's full name stops the run with suggestions where it can find some; write the full name or the ID.

## `pnpm poll <form link> [--out <file>]`

Some Balance Council groups poll players with a Google Form before they vote: a checklist of candidate cards for each
of the ballot's four lists. `pnpm poll` reads such a form and writes it as a ballot for `pnpm whatif`, so you can see
what each candidate would do to the published decks before the vote:

```sh
pnpm poll https://docs.google.com/forms/d/e/…/viewform
pnpm whatif data/cache/polls/bc37-ideas-2026-10-22.txt
```

- The file goes to `data/cache/polls/` (local only), named after the form's title and the day it was read; `--out`
  puts it elsewhere. Forms change from vote to vote, so the link is the argument and the file keeps a dated copy.
- Each question is matched to a list by its wording ("Power +", "…support for Provision Decrease?"); other questions
  are skipped and listed.
- Every option is written unranked. Its notes in brackets ("(nerf)", "(if … is buffed)") stay as a comment beside it,
  and so does the option as written whenever the line differs from it.
- A name is written in full only when exactly one card matches it: as written, then as the translation after a `/`,
  then, if neither, split at ` & ` when that's two cards. Anything else stays as written, for `pnpm whatif` to stop on
  with suggestions: short names ("Caranthir"), misspellings, a card the data doesn't have. Fix those lines and rerun.
- The file starts with a `Poll` line, which tells `pnpm whatif` it holds candidates, not a ballot: a card may be on
  both lists of a kind (a power increase or decrease), each candidate is counted on its own, and there is no
  all-together total, since they won't all pass. Candidates are unranked, so the tables drop the Rank column and
  sort each list by the decks a card is in, most first.

## `pnpm package <card…> [--min <n>]` · `pnpm package tag:<tag>`

The decks built around one or more cards (all of them, or with `--min`, at least that many) or a deck-builder tag such
as `tag:defender` or `tag:dragon`:

```sh
pnpm package Kingslayer Cantarella "Matta Hu'uri" Teleportation --min 3
pnpm package tag:defender --lang zh-cn
```

It shows their factions, leaders and half-years, how many fit today's limit or have a video, and the cards that go
with them, ranked by lift: how much more often a card is in these decks than in all decks that could run it (its
faction's, or every deck for a neutral). Tags miss some roles, so `ROLE_EXTRAS` in `lib/packages.ts` adds them by hand
(Azar Javed's scarabs are defenders; the card isn't tagged).

## `pnpm export [--out <folder>]`

The decks and cards as spreadsheets, for analysis in Excel, Google Sheets, LibreOffice, Python or R without running
anything here. Each release attaches it as `gwent-deck-data-<tag>.zip`; `pnpm export` writes the same folder locally
(`gwent-deck-data/` by default, emptied first).

- `decks.csv`: a row per deck: faction, leader, stratagem, provisions against today's limit, sources, author, guide
  date, video.
- `deck-cards.csv`: every deck's cards and copies, one row each, leader and stratagem marked.
- `cards.csv`: every card's stats and tags, how many decks run it out of those that could, and its name in all 11
  languages.
- `card-pairs.csv`: pairs of cards in at least 10 decks together, and their lift: how much more often than chance,
  counted over the decks that could run both. Groups of cards with high lift to each other are archetypes; the file
  leaves naming them to whoever reads it.
- `leaders/<language>/`: a `pnpm package` report per leader, card names in that language beside the English.
- `manifest.json`, and a README in each of the site's languages (the column reference is in the English one).

The CSV files are UTF-8 with a byte-order mark, so Excel shows every language's names correctly.

## `pnpm kegs [faction]`

What faction, neutral and general kegs are worth as a collection fills (default faction `MO`), and how many kegs it
takes to own a faction's bronzes and half its golds. It simulates players opening kegs against `data/source/cards.json`,
counting as wanted either every card or only the cards in at least 1% / 5% of the decks that could run them. Seeded,
so a rerun prints the same numbers until the data changes. The odds and mill values it assumes are in `lib/kegs.ts`;
the per-card odds are fitted to CDPR's published per-keg rates, not official.

## `pnpm reddit <deck link> [--author]`

When someone shares a playgwent deck or guide on Reddit, prints a short comment to paste in reply: the deck's gameplay
video and, if it's over today's provision limit, the close decks that still fit, each linked into the site.

It prints nothing, and says why, when the deck has no video and fits: a reply with nothing new in it is just an ad.
`--author` ends the comment with "I made Gwent Deck Search; happy to answer questions." (true only for the site's
author, so it's not the default). A sentence of your own about the post reads better than any template. Post by hand,
only where it helps, and check the subreddit's rules on links and self-promotion first.

## Code

Each script is a thin command line in this folder over pure, tested functions in `lib/`: `analysis.ts` holds the
shared loading and name lookup; `whatif.ts`, `poll.ts`, `packages.ts`, `export.ts` (with `export-readme.ts`),
`kegs.ts` and `reddit.ts` the reports. Tests are in `lib/__tests__/`; the example ballot above is tested against the
real data, so it can't go stale unnoticed.
