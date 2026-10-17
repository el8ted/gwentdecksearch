# AI use

Gwent Deck Search is built and maintained with the help of AI tools. This page says which tools, what they're used
for, and what isn't AI.

## Tools

- [pi](https://pi.dev): the coding agent used to work with the models below
- [llama.cpp - TurboQuant](https://github.com/TheTom/llama-cpp-turboquant) +
  [HF DavidAU Qwen 3.8](https://huggingface.co/DavidAU/Qwen3.8-27B-TURBO-Fable-Cold-Fusion-735-882-Heretic-Uncensored-NEO-CODER-MAX-MTP-GGUF),
  run locally
- [Strata](https://github.com/Niko1221/Strata) +
  [ISTA IQ2_XS](https://huggingface.co/ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-GGUF), run locally
- [Claude Opus 5.5](https://claude.ai) by Anthropic

## What AI is used for

AI is part of every stage of the project, from design to code to maintenance, not a one-off:

- **Source code:** writing and changing the site, the data scripts and the tests; reviewing changes; finding and
  fixing bugs.
- **Interface translations:** the interface text in the 10 languages other than English (`src/i18n/`), the Help
  panel's quick guide, and the short README in each language.
- **Documentation:** drafting the README, CONTRIBUTING and other docs.
- **Design and accessibility:** proposing layouts and checking them against contrast and keyboard requirements.

The maintainer decides what gets built, directs and reviews the work, and is responsible for the result. Changes are
checked by the project's lint, type checks, unit tests and browser tests before they're committed.

## What isn't AI

- **Deck lists** come from their authors: playgwent.com community guides, and MetallicDanny's and Shinmiri2's deck lists.
- **Card names, card data, game terms, art and icons** come from playgwent.com, in all 11 languages.
- **English translations of deck names** come from the [MyMemory](https://mymemory.translated.net/) translation
  service, with official card names kept as they are in the game. Some are corrected by hand.
- **The site itself** uses no AI. It runs entirely in your browser and sends nothing to any AI service.

## Translations need native speakers

AI-translated phrases are listed under `_needsReview` in each language file until a native speaker checks them. If
something reads wrong in your language, corrections are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

## Contributions

You may use AI tools for contributions. Changes are reviewed and tested the same way whoever, or whatever, wrote
them. Mentioning AI use in your pull request helps the review.

## Problems

Found a bug or a wrong translation? [Open an issue](https://github.com/el8ted/gwentdecksearch/issues/new/choose).
