# Contributing

Ways to help, most useful first:

1. **Fix the interface text in your language.** It was machine-translated. See
   [Translating the interface](#translating-the-interface).
2. **Fix English translations of deck names** written in your language. See
   [Fixing deck name translations](#fixing-deck-name-translations).
3. **Report a problem or a missing deck** by [opening an issue](https://github.com/el8ted/gwentdecksearch/issues/new/choose).
   Copy the page address into the report: it contains your filters, so it shows exactly what you saw.

You don't need to know how to code for any of these. Using AI tools is fine; see [AI.md](AI.md). Maintainers: see
[MAINTAINING.md](MAINTAINING.md) for updating the data and publishing releases.

## Translating the interface

Interface phrases live in one file per language in [`src/i18n/`](src/i18n/):

| File | Language | Status |
|---|---|---|
| `en.json` | English | Master list. Every other file follows its keys. |
| `de.json` | Deutsch | Machine-translated, needs review |
| `es.json` | Español | Machine-translated, needs review |
| `fr.json` | Français | Machine-translated, needs review |
| `it.json` | Italiano | Machine-translated, needs review |
| `ja.json` | 日本語 | Machine-translated, needs review |
| `ko.json` | 한국어 | Machine-translated, needs review |
| `pl.json` | Polski | Machine-translated, needs review |
| `pt-BR.json` | Português (Brasil) | Machine-translated, needs review |
| `ru.json` | Русский | Machine-translated, needs review |
| `zh-cn.json` | 简体中文 | Machine-translated, needs review |

Each file maps a key to a phrase:

```json
"results.expandAll": "Развернуть все",
"results.count": { "one": "Найдена {n} колода", "few": "Найдено {n} колоды", "many": "Найдено {n} колод", "other": "Найдено {n} колоды" }
```

### Rules

1. **Change only the text on the right.** Keys (on the left) must match `en.json` exactly.
2. **Keep every `{placeholder}`** such as `{n}`, `{name}` or `{date}`. Move it wherever your grammar needs it, but don't
   translate or remove it.
3. **Plural phrases** are objects. Use the forms your language needs (`zero`, `one`, `two`, `few`, `many`, `other`;
   see the [Unicode plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)).
   `other` is always required. Chinese, Japanese and Korean need only `other`.
4. **Reviewed a phrase?** Remove its key from the `_needsReview` list at the top of the file.
5. **Missing phrases are fine.** Anything not in your file shows in English, so partial translations help too.

The `help.*` phrases are the quick guide in the page's **?** panel. They also make up the short README in your
language (`docs/README.{lang}.md`), which is rebuilt from them with `pnpm readmes`. A maintainer can do that for you.

### What you don't need to translate

**Card names and official Gwent terms** come from playgwent.com in all 11 languages and override the phrase files:
faction names (`faction.*`), `filter.faction`, `filter.stratagem`, `filter.provisions`, `stat.scraps`, `stat.cards`
and `stat.units`. Those entries in the phrase files are only fallbacks.

**Deck names** are shown as their authors wrote them when the deck's language matches yours, and in English
otherwise. Those English names are machine-translated; to fix one, see
[Fixing deck name translations](#fixing-deck-name-translations).

### Adding a new language

Name the file after the playgwent language code: `de`, `es`, `fr`, `it`, `ja`, `ko`, `pl`, `pt-BR`, `ru` or `zh-cn`.
Copy `en.json`, translate it, and say in your pull request that it's a new language. A maintainer will switch it on.

### Checking your file

Open a pull request and the checks run automatically. To run them yourself:

```bash
pnpm install
pnpm test:run
```

The checks report unknown keys, changed or missing `{placeholders}` and invalid plural forms, naming the exact key.
They also list which phrases are still in English.

## Fixing deck name translations

Deck names not written in English are machine-translated into English, which is what everyone reading in another
language sees. If you read the original language, you can fix them in
[`data/source/translations.json`](data/source/translations.json). The file is grouped by the deck's **original**
language, and each entry maps the name as its author wrote it to its English translation:

```json
"de": {
  "Blutspur": "Blood Scent",
  "Mahakamer Schmiede": "Mahakam Forge"
}
```

1. **Change only the English on the right.** The original name on the left must match the deck exactly, emoji and
   spacing included, or the fix won't apply.
2. **Find a deck's original name** in [`data/decklist.md`](data/decklist.md): the *Original Name* column shows it with
   its language, e.g. `ru: Атака на Боклер`.
3. **Your fixes are kept.** The scraper only translates names that have no entry yet, so it never overwrites yours.
4. **Gwent terms stay official.** Use the English card, leader and keyword names from playgwent.com, e.g. *Blood Scent*
   for *Blutspur*, so names match what players see in the game.

To see your fixes in the site, run `pnpm build:data`, which regenerates `data/decks.json` and `data/decklist.md` from
`data/source/` without going online. You can also leave that to a maintainer and send just the edited file.

## License

By contributing, you agree that your contribution is licensed under the project's
[PolyForm Noncommercial License 1.0.0](LICENSE). See [NOTICE.md](NOTICE.md) for what the license does not cover.
