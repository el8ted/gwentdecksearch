# Gwent Deck Search

**English** · [Deutsch](docs/README.de.md) · [Español](docs/README.es.md) · [Français](docs/README.fr.md) ·
[Italiano](docs/README.it.md) · [日本語](docs/README.ja.md) · [한국어](docs/README.ko.md) · [Polski](docs/README.pl.md) ·
[Português (Brasil)](docs/README.pt-BR.md) · [Русский](docs/README.ru.md) · [简体中文](docs/README.zh-cn.md)

Gwent Deck Search lists published decks for _GWENT: The Witcher Card Game_ and narrows them down as you pick a
faction, a leader and the cards you've seen. Use it during a match to work out what your opponent is playing, or
between matches to find a deck to build.

- **Open it:** <https://el8ted.github.io/gwentdecksearch/>
- **Use it offline:** once you've opened the site, it keeps working if you lose your connection, with the data from
  your last visit. Or download the zip from [Releases](https://github.com/el8ted/gwentdecksearch/releases), unzip it
  and open `index.html`. No install, no account.

![The page with the Monsters faction and the Fruits of Ysgith leader picked: filters at the top, matching decks below, and the most common cards in those decks on the right](docs/screenshots/overview.png)

## Quick start

1. Pick a **faction**, then a **leader**. In a match, start with your opponent's.
2. Type the cards you see into the **Search** box (press <kbd>/</kbd> to jump there), a tag such as Beast or
   Devotion, or an author. Each one narrows the list. Type `-` first to exclude one, or click its name once added.
3. **Most common** shows the cards the remaining decks run; **Least common** shows rare surprises. Click a card to
   add it.
4. **All** lists decks with everything you've added; **Any** lists decks with at least one, best matches first.
5. Click a deck's **▸** to see its cards. **↗** opens it on playgwent.com, where you can import it; **▶** plays a
   gameplay video, when there is one; **⧉** shows only that deck.
6. **Craft**, next to **Decks**, lists the cards the matching decks run and what each costs to craft: a guide to
   where to spend your scraps. See [Plan your crafting](docs/guide.md#plan-your-crafting).
7. **Spare** means room to upgrade a card. **Over** means card costs have changed and the deck no longer fits.
8. **Clear all** starts over. Your browser's Back button undoes it.

The same steps are in the page's **?** (Help) panel, with search tips and keyboard shortcuts.

## Learn more

The [full guide](docs/guide.md) walks through the three jobs the page does, then covers every control, with pictures:

- [During a match](docs/guide.md#during-a-match): work out what your opponent is playing, one card at a time
- [Find a deck to play](docs/guide.md#find-a-deck-to-play): from a deck link, cards you like or want to avoid, a
  creator, or a deck that's over its provisions
- [Plan your crafting](docs/guide.md#plan-your-crafting): new or back after a break? See which cards today's decks
  run, across every deck, a faction or a leader, and how far your scraps go
- [Reference](docs/guide.md#reference): Search, filters, provisions, `≈` Similar decks, Craft, sharing links,
  languages, display and keyboard shortcuts
- [Common questions](docs/guide.md#common-questions)

What changed lately: [CHANGELOG.md](CHANGELOG.md).

## Where the decks come from

| Source | What it is |
|---|---|
| **Community** | Published deck guides on playgwent.com from the last 18 months, in every language, with votes and author; and the decks Gwent creators link in their YouTube video descriptions from the last 12 months, each with its video and the creator credited (▶ name). |
| **MetallicDanny** | A Russian-language deck list ([deck list](https://docs.google.com/spreadsheets/d/1_nLQ_0y1t_3zRAwjRSPjSv4djBSRKHPyli3hNrjRgkg/edit?gid=1966172750)), including his archetype list and decks from the last 12 months of his per-patch meta reports and new-deck lists. Deck names are machine-translated into English, keeping official card names. |
| **Shinmiri2** | A curated list of competitive decks ([deck list](https://docs.google.com/spreadsheets/d/1h4m0zhPOiW2Tyaj26kGIvPdSXgtmgerR5uu7vBHM-BM/edit?gid=1592369710)), including alternate versions and decks from the last 12 months of per-patch tabs. Alternates appear as separate decks with the same name. |

Gameplay videos come from the guides themselves, from both deck lists, and from the deck links in creators' YouTube
video descriptions (the creators are listed, with links to their channels, in [data/creators.md](data/creators.md)). Those decks
credit the channel by its name; searching it finds the creator, and so does their Gwent name once the creator or the
maintainer has confirmed it. Names are never guessed.

A deck listed by more than one source appears once, with every source badge; so does a deck link whose cards match a
deck already listed (the same deck saved twice). Two guides with the same cards stay separate, even when they share a deck code. Card lists, costs and card data come
from playgwent.com. Provisions, scraps and card counts are worked out from current card data, so they follow every
Balance Council change.

## Credits

Deck lists belong to their authors: the playgwent.com community, MetallicDanny
([YouTube](https://www.youtube.com/@metallicdanny), [Twitch](https://www.twitch.tv/metallicdanny)) and Shinmiri2
([YouTube](https://www.youtube.com/@shinmiri2101), [Twitch](https://www.twitch.tv/shinmiri2)), and the creators
whose videos feature them, named on each deck. A creator who wants their names fixed or to opt out can use the
**I'm a creator** issue form. **Credits** on
the page (in the header, or at the bottom of Help on phones) links to them.

The site icon was drawn by el8ted's daughter. It's licensed under a father's love: changing it would make el8ted sad
and disappoint a young woman.

Gwent Deck Search is built and maintained with the help of AI tools, for code and translations. [AI.md](AI.md) lists
the tools and what they're used for.

This is an unofficial fan project, not affiliated with or endorsed by CD PROJEKT RED. GWENT and The Witcher are
trademarks of CD PROJEKT S.A. Card data, art and icons belong to CD PROJEKT S.A. and are used under its
[Fan Content Guidelines](https://www.cdprojektred.com/en/fan-content).

## Contributing

The most useful help is fixing translations, of the interface or of deck names. See [CONTRIBUTING.md](CONTRIBUTING.md).
To report a problem or a missing deck, [open an issue](https://github.com/el8ted/gwentdecksearch/issues/new/choose).

## License

The source code is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE): you may use, change and share
it for any noncommercial purpose. Commercial use is not permitted.

The license covers the code only, not deck lists or GWENT material. See [NOTICE.md](NOTICE.md).
