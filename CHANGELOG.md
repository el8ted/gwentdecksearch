# Changelog

Changes players will notice, newest first. Each release on the
[Releases](https://github.com/el8ted/gwentdecksearch/releases) page also lists the decks and card costs that changed.

<!-- Add a line under Unreleased with each change, written for players. The release workflow renames the heading to
the release tag and starts a new Unreleased section. -->

## Unreleased

- Decks from Gwent creators' YouTube videos are now in the list, under **Community**, each with its video. A deck
  shows who features it in a video (▶ name), and searching a creator finds their guides, lists and videos by their
  Gwent name or their channel's name. **Credits** links the list of creators.
- Pasting a deck link with text stuck to its end, as some video descriptions have it (`…/decks/9ae2…(Dwarf`), now
  finds the deck.
- An author's chip in Search shows its person icon centred, not riding high.

## 2026-10-24.02

- The site keeps working if you lose your connection: once you've visited, it opens and shows every icon offline,
  using the data from your last visit (its date is at the top of the page).
- The filters follow a match: Faction, Leader, Stratagem and Search come first, and Source, Guide & video and
  Provisions sit below Search to refine the list.
- On phones the filters fold away as you go: picking a leader folds Faction and Leader into one line and shows only
  the stratagems that faction's decks run; a stratagem or your first card folds that too. Source, Guide & video and
  Provisions fold behind one **Filters** line, and **Card frequency** can fold away to reach the decks. The header
  fits on one line: the language shows as its code, and Credits is at the bottom of Help.
- On computers and tablets, the filters shrink to one line each as you scroll into the decks. Tap a line to open
  them over the list; scroll, tap the page or press <kbd>Esc</kbd> to shrink them again. Clear all takes you back
  to the top with every filter showing.
- On computers and tablets, **Decks**/**Craft**, **Dim common** and **Expand all** stay pinned under the filters as
  you scroll, and a new list from **Only this**, **Similar** or a Craft card starts at the top.
- The Faction buttons are bigger and easier to tap, as tall as the leader icons.
- Searching with **Any** and several cards, each deck shows how many of them it has (**2/3**), which is the order the
  decks are listed in.
- **Copy link**, beside Clear all, copies a link to your current search to share or bookmark; on a phone it opens the
  share menu. From the offline download it copies the same search on the live site.
- Keyboard: <kbd>j</kbd> and <kbd>k</kbd> move to the next and previous deck (or Craft card); <kbd>Esc</kbd> in the
  Search box, pressed again after the suggestions close, takes you to the results. A deck you move to is no longer
  hidden under the filters at the top of the page.
- A cleaner look: Faction is one bar (you pick one), set apart from the filters you can combine; buttons, switches and
  badges have squarer corners, leader and stratagem art stays round, and numbers line up in columns.
- Icons that look the same on every device replace the text symbols on deck buttons (Similar, Only this,
  playgwent.com, video), chips, Clear all, Copy link and the language button; Community guides are marked with a
  group icon. Icons by Lucide (see Credits).
- The site's title has its own lettering (Spectral SC).
- On narrow phones at the largest text size, the page no longer scrolls sideways.
- On computers, **Most common** and **Least common** no longer slide under the filters at the top: the switch and
  the top cards stay in view, and a long list scrolls on its own.
- **Credits** is a little wider on computers and tablets, so the site's version stays on one line with its name.
- `pnpm whatif` and `pnpm poll`: a card name that doesn't match exactly one card is now asked about instead of
  stopping the run. Pick a suggestion, type the card (any language, or its ID) or skip the line; your picks are saved
  to the ballot file. Misspelled names get suggestions too ("Kolgirm" finds Kolgrim).
- Scripts: a mistyped option (`--detial`) or one missing its value now stops with the usage line instead of being
  ignored; `pnpm package --min` must be a whole number; and `pnpm export --out` only empties a new folder or an
  earlier export, so a typo can't delete anything else.

## 2026-10-22

- More decks: community guides from the last 18 months (was 12) and the sheets' per-patch tabs from the last 12
  (was 6), so archetypes show more of their variations and more decks have a video. Older decks are checked against
  today's provision limit like the rest; the guide notes that the check sees provisions only.
- MetallicDanny's archetype list is read too: about 110 decks he files by faction and archetype, 34 of them new to
  the site.
- For anyone digging into the data: `pnpm whatif` shows what a Balance Council ballot (power and provision changes,
  ranked) would do to the published decks; `pnpm poll` turns a Balance Council poll (a Google Form) into one;
  `pnpm package` shows the decks built around a card or tag and what they run with; `pnpm kegs` estimates what each
  kind of keg is worth as your collection fills, counting either every card or only the cards decks play (a card in
  two factions counts against both factions' decks); and `pnpm export` writes the decks and cards as spreadsheets.
  Card names work in any of the site's languages. See scripts/README.md.
- Cards that tie in **Craft** and **Most/Least common** are listed legendary first, then by name, instead of in an
  arbitrary order. On a single deck, where every card ties, Craft now goes from the most expensive cards down.
- Decks are listed in alphabetical order of the name you see: a deck shown under its author's own name, in your
  language, used to be sorted by its English translation, so lists in Russian, Polish and other languages looked
  unordered.
- Clicking a faction's card in **Craft** turns that faction on, as adding the card from Search does, so its leaders
  show straight away.
- The **Display** menu's chosen options stay readable when you hover over them: their text no longer fades into the
  highlight.

## 2026-10-18.04

- **Craft: where to spend your scraps.** New, or back after a break, and not sure which cards are worth crafting?
  **Craft**, next to the deck list, shows the cards today's published decks actually run, most used first, with what
  each costs to craft ([#10](https://github.com/el8ted/gwentdecksearch/issues/10)).
  - **Across every deck:** with no filters, the top is the key cards nearly every deck runs, whatever its faction,
    such as Oneiromancy and Royal Decree.
  - **Across a faction:** pick one to see what its decks rely on.
  - **For a leader or archetype:** pick a leader, or a card or tag (Devotion, Beast…), for what that style of deck
    needs.
  - **For one deck:** **⧉ Only this** on a deck, then Craft, lists what that deck costs.
  - **With your scraps:** type how many you have to see how far down the list they go, and tick the cards you
    already own. Nothing is saved.
  - **Elsewhere:** **Most common** and **Least common** show each card's crafting cost too.
  - It's a guide to what published decks use, not a promise that a card is worth crafting for you: how you like to
    play, and what the next balance change does, matter too.
  - How to use it: [Plan your crafting](https://github.com/el8ted/gwentdecksearch/blob/main/docs/guide.md#plan-your-crafting)
    in the guide.
- **⧉** on any deck shows only that deck, just as pasting its link does; Back brings your search back. Then **Craft**
  shows what that deck costs you ([#11](https://github.com/el8ted/gwentdecksearch/issues/11)).
- Deck rows are easier to read: a **▸** before each name shows it opens to its cards, and rows leave out what rarely
  helps: the deck ID moves under the opened card list, a guide and video in the same language show one badge, and the
  card count shows only when it isn't 25. On wide screens a deck's buttons say what they do: **⧉ Only this**,
  **≈ Similar**, **↗ playgwent.com**.
- **Clear all** (and Shift+Backspace) now empties the Search box too: a pasted deck link that wasn't found, or a
  half-typed name, no longer stays behind ([#12](https://github.com/el8ted/gwentdecksearch/issues/12)).
- In a **≈ Similar** list, **Dim common** becomes **Show changes**: each deck is compared with the one you started from,
  even while it's hidden. Shared cards fade, added cards are marked `+`, and the cards it swapped out are listed. When
  the Provisions filter hides the deck you started from, a note says so, with a button to show it
  ([#9](https://github.com/el8ted/gwentdecksearch/issues/9)).
- **Accessibility:** text that was too faint now meets WCAG AA contrast (4.5:1) in every theme, high contrast
  included: cards faded by **Dim common**, the notes under the filters and above the results, and card costs in the
  light theme.

## 2026-10-18.03

- The Search box's hint mentions that it takes a deck link too, in every language.

## 2026-10-18.02

- The bug report form opens again: GitHub had rejected it since 2026-10-17.
- Search ignores accents: typing "coen" finds Coën, "sile" finds Síle de Tansarville, and a plain ' matches Raffard’s
  ([#5](https://github.com/el8ted/gwentdecksearch/issues/5)).
- Paste a playgwent.com deck link (a guide or a deck) into Search to find that deck, with its guide and video. It
  replaces your other filters, and Back brings them back. A link to a deck that isn't in the list says so. Sites and
  bots can link straight to a deck with `?deck=` and its playgwent.com link
  ([#6](https://github.com/el8ted/gwentdecksearch/issues/6)).
- **≈ Similar decks** on every deck: the decks with its leader that fit (Spare or Exact) and share at least 15 of its
  25 cards, most in common first. Use it to find a playable version of a deck that's now over its provisions, or
  variations of your own. The deck itself leads, marked **This deck**, when its provision step is on
  ([#7](https://github.com/el8ted/gwentdecksearch/issues/7)).
- Search can exclude: click a card, tag or author you've added to find decks *without* it, or type `-` before a name.
  For example, Skellige Warrior decks without Tyr. Shared links keep it
  ([#8](https://github.com/el8ted/gwentdecksearch/issues/8)).
- Help (**?**) has more to say, in every language: search tips, similar decks, filters and keyboard shortcuts, each
  in its own section that opens on a tap, so it still fits a phone.
- A new [full guide](https://github.com/el8ted/gwentdecksearch/blob/main/docs/guide.md), opened from Help's **Full guide** link: what to do during a match, how to find a
  deck to play, then every control explained, with pictures and common questions.

## 2026-10-18

- The site has its own icon, drawn by el8ted's daughter: a pixel-art card and magnifier, in browser tabs, bookmarks and
  on phone home screens. She's in the Credits.
- The Provisions filter picks how far a deck is off the limit: 3+, 2 or 1 spare, Exact, or 1, 2 or 3+ over. Old links
  to Spare or Over still work ([#4](https://github.com/el8ted/gwentdecksearch/issues/4)).
- The Cards box also finds the game's deck-builder tags: categories like Beast, Ogroid or Spell, and abilities like
  Devotion or Order. One tag each, so "Orders" and "Order" find the same one, and only tags in the remaining decks
  are suggested.
- Cards and tags stay in the order you add them, also in shared links, so Backspace always removes the last one
  you tried.
- Decks with a gameplay video show a ▶ link with the video's language: about 1,360 decks, with videos from the guide
  itself, Shinmiri2's or MetallicDanny's list, or Shinmiri2's YouTube channel.
- Community guides show the language they're actually written in (EN, RU, PL…) next to the deck ID; guides that are
  only filler text show none.
- A new **Guide & video** filter: **▶ Has video** shows only decks with a video (about 1,360), and a language keeps
  decks whose guide or video is in it.
- MetallicDanny's badge is orchid instead of grey, easier to tell apart from the other sources.
- The Cards box also finds authors by their playgwent name: a community guide's author, or Shinmiri2 and MetallicDanny
  for their guides and their lists together.
- The Cards box is now **Search**, since it finds cards, tags and authors.
- Phones: the card suggestions are no longer covered by the Most common list below them.

## 2026-10-17

- MetallicDanny's deck list is included, with his permission: about 400 more decks, with names translated from Russian.
- Phones: adding a card from Most common or Least common no longer jumps back to the card search
  ([#1](https://github.com/el8ted/gwentdecksearch/issues/1)).
- "Pick a faction to choose a leader", the "Show more" button and the skip links are now translated in every
  language ([#2](https://github.com/el8ted/gwentdecksearch/issues/2)).
- Phones: the Language and Display menus open fully on screen
  ([#3](https://github.com/el8ted/gwentdecksearch/issues/3)).
- Phones: a deck name with no spaces no longer zooms the page out (which also switched Most common to two columns).
- The Fan Content Guidelines link in Credits opens CD PROJEKT RED's page in your language.
- Credits shows the version you're using, linked to its release notes, and Help links to What's new.

## 2026-10-16

- First release: about 2,900 decks from playgwent.com community guides and Shinmiri2's deck list, in 11 languages.
