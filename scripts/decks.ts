/**
 * Deck refresh: collects the current deck links from every source (creators' videos as `pnpm scrape:videos` stored them), fetches only decks the store doesn't have
 * (published decks never change), and translates new non-English names. Writes data/source/entries.json,
 * deck-store.json and translations.json; then run `pnpm build:data`.
 *
 * Run: `pnpm scrape:decks`.
 */
import { writeFile } from 'node:fs/promises'
import { consola } from 'consola'
import { buildDataset, glossaryFor } from './lib/build.ts'
import type { Creator } from './lib/creators.ts'
import { refreshStore, translateNames } from './lib/deck-refresh.ts'
import { collectEntries } from './lib/entries.ts'
import { createPoliteFetch } from './lib/polite-fetch.ts'
import type { StoredDeck } from './lib/store.ts'
import { markRefreshed, readJson, STORE_PATHS, writeJson } from './lib/store.ts'
import { myMemory } from './lib/translate.ts'
import { type StoredVideo, videoEntries } from './lib/youtube.ts'

const get = createPoliteFetch({
  'www.playgwent.com': 1_000,
  'docs.google.com': 1_000,
  'api.mymemory.translated.net': 1_000,
})

const now = new Date()
const collected = await collectEntries(get, get.bytes, now)
// Creators' videos come last, so a deck a guide or list already names keeps that name (run scrape:videos first).
const videos = await readJson<Record<string, Record<string, StoredVideo>>>(STORE_PATHS.videos, {})
const fromVideos = videoEntries(videos, await readJson<Creator[]>(STORE_PATHS.creators, []), now)
const entries = [...collected.entries, ...fromVideos]
await writeJson(STORE_PATHS.entries, entries)
consola.info(
  `${entries.length} deck links (${collected.listed} guides listed; ${new Set(fromVideos.map((e) => e.url)).size} from creators' videos)`,
)

const store = await readJson<Record<string, StoredDeck>>(STORE_PATHS.decks, {})
const texts = await readJson<Record<string, string>>(STORE_PATHS.guideText, {})
let result: Awaited<ReturnType<typeof refreshStore>>
try {
  result = await refreshStore(entries, store, get, texts)
} finally {
  // Keep what was fetched even if the run stops partway.
  await writeJson(STORE_PATHS.decks, store)
  await writeJson(STORE_PATHS.guideText, texts)
}
await markRefreshed('decks')
if (result.warnings.length) consola.warn(`${result.warnings.length} warnings:\n  ${result.warnings.join('\n  ')}`)

// Names the build would show untranslated: translate and save them.
const cards = await readJson(STORE_PATHS.cards, {})
const cardNames = await readJson(STORE_PATHS.cardNames, {})
const categories = await readJson(STORE_PATHS.categories, {})
const translations = await readJson<Record<string, Record<string, string>>>(STORE_PATHS.translations, {})
const { dataset } = buildDataset({
  entries,
  store,
  cards,
  cardNames,
  terms: {},
  tags: {},
  videos: {},
  creators: [],
  categories,
  translations,
  scrapedAt: '',
})
const glossaries = new Map<string, ReturnType<typeof glossaryFor>>()
const glossary = (lang: string) => {
  if (!glossaries.has(lang)) glossaries.set(lang, glossaryFor(lang, { cards, cardNames, categories }))
  return glossaries.get(lang) ?? new Map()
}
const mt = myMemory(get)
const names = dataset.decks.flatMap((d) => (d.original ? [d.original] : []))
const { added, deferred } = await translateNames(names, translations, glossary, mt)
// Same order as the file has always had (locale order per language), so diffs stay small.
const sorted = Object.fromEntries(
  Object.entries(translations)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lang, map]) => [lang, Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b, lang)))]),
)
await writeFile(STORE_PATHS.translations, `${JSON.stringify(sorted, null, 2)}\n`)

consola.success(
  `${result.fetched} decks fetched; ${added} names translated` +
    (deferred ? `, ${deferred} awaiting machine translation (re-run later)` : '') +
    '; run pnpm build:data',
)
