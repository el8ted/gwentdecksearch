# Changelog

Changes players will notice, newest first. Each release on the
[Releases](https://github.com/el8ted/gwentdecksearch/releases) page also lists the decks and card costs that changed.

<!-- Add a line under Unreleased with each change, written for players. The release workflow renames the heading to
the release tag and starts a new Unreleased section. -->

## Unreleased

- **Most common** and **Least common** show what each card costs to craft, in scraps, so you can see what a deck's
  staples will cost you ([#10](https://github.com/el8ted/gwentdecksearch/issues/10)).
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
