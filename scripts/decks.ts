/**
 * Deck refresh: collects the current deck links from every source, fetches only decks the store doesn't have
 * (published decks never change), and translates new non-English names. Writes data/source/entries.json,
 * deck-store.json and translations.json; then run `pnpm build:data`.
 *
 * Run: `pnpm scrape:decks`.
 */
import { writeFile } from 'node:fs/promises'
import { consola } from 'consola'
import { buildDataset, glossaryFor } from './lib/build.ts'
import { refreshStore, translateNames } from './lib/deck-refresh.ts'
import { collectEntries } from './lib/entries.ts'
import { createPoliteFetch } from './lib/polite-fetch.ts'
import type { StoredDeck } from './lib/store.ts'
import { markRefreshed, readJson, STORE_PATHS, writeJson } from './lib/store.ts'

const get = createPoliteFetch({
  'www.playgwent.com': 1_000,
  'docs.google.com': 1_000,
  'api.mymemory.translated.net': 1_000,
})

const { entries, listed } = await collectEntries(get, new Date())
await writeJson(STORE_PATHS.entries, entries)
consola.info(`${entries.length} deck links (${listed} guides listed)`)

const store = await readJson<Record<string, StoredDeck>>(STORE_PATHS.decks, {})
let result: Awaited<ReturnType<typeof refreshStore>>
try {
  result = await refreshStore(entries, store, get)
} finally {
  // Keep what was fetched even if the run stops partway.
  await writeJson(STORE_PATHS.decks, store)
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
  categories,
  translations,
  scrapedAt: '',
})
const glossaries = new Map<string, ReturnType<typeof glossaryFor>>()
const glossary = (lang: string) => {
  if (!glossaries.has(lang)) glossaries.set(lang, glossaryFor(lang, { cards, cardNames, categories }))
  return glossaries.get(lang) ?? new Map()
}
const MM_LANG: Record<string, string> = { 'zh-cn': 'zh-CN' }
const mt = async (text: string, lang: string) => {
  const pair = `${MM_LANG[lang] ?? lang}|en`
  try {
    const res = JSON.parse(
      await get(
        `https://api.mymemory.translated.net/get?langpair=${encodeURIComponent(pair)}&q=${encodeURIComponent(text)}`,
      ),
    )
    if (res.responseStatus === 200 && res.responseData?.translatedText && !res.quotaFinished) {
      return res.responseData.translatedText as string
    }
    consola.warn(`MyMemory stopped (${res.responseDetails || res.responseStatus}); deferring the rest`)
  } catch (e) {
    consola.warn(`MyMemory failed (${(e as Error).message}); deferring the rest`)
  }
  return undefined
}
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
