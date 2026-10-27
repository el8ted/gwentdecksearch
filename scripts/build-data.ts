/**
 * Builds data/decks.json, data/decklist.md and the language packs (data/i18n/*.js) from the committed stores in
 * data/source/. No network: run it after either refresh, or any time the output format changes.
 *
 * Run: `pnpm build:data`.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { consola } from 'consola'
import { type BuildInput, buildDataset } from './lib/build.ts'
import { readJson, STORE_PATHS } from './lib/store.ts'

const refreshed = Object.values(await readJson<Record<string, string>>(STORE_PATHS.refreshed, {}))
const input: BuildInput = {
  entries: await readJson(STORE_PATHS.entries, []),
  store: await readJson(STORE_PATHS.decks, {}),
  cards: await readJson(STORE_PATHS.cards, {}),
  cardNames: await readJson(STORE_PATHS.cardNames, {}),
  terms: await readJson(STORE_PATHS.terms, {}),
  tags: await readJson(STORE_PATHS.tags, {}),
  videos: await readJson(STORE_PATHS.videos, {}),
  creators: await readJson(STORE_PATHS.creators, []),
  categories: await readJson(STORE_PATHS.categories, {}),
  translations: await readJson(STORE_PATHS.translations, {}),
  // The newer refresh: card data is current as of the monthly vote, so one date is enough.
  scrapedAt: refreshed.sort().at(-1) ?? new Date().toISOString(),
}
const { dataset, decklist, packs, warnings, errors } = buildDataset(input)

if (warnings.length) consola.warn(`${warnings.length} warnings:\n  ${warnings.join('\n  ')}`)
if (errors.length) {
  consola.error(`${errors.length} sanity check failures; nothing written:\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
await writeFile('data/decks.json', `${JSON.stringify(dataset)}\n`)
await writeFile('data/decklist.md', decklist)
await mkdir('data/i18n', { recursive: true })
for (const [lang, pack] of Object.entries(packs)) await writeFile(`data/i18n/${lang}.js`, pack)
consola.success(
  `Wrote data/decks.json, data/decklist.md and ${Object.keys(packs).length} language packs: ` +
    `${dataset.decks.length} decks, ${Object.keys(dataset.cards).length} cards`,
)
