/**
 * Card refresh: refetches card data from playgwent (provisions, names, tags, official terms) into data/source/. Cards
 * only change with the monthly Balance Council vote, so most runs change nothing. Then run `pnpm build:data`.
 *
 * Run: `pnpm scrape:cards`.
 */
import { consola } from 'consola'
import { fetchCardData } from './lib/card-refresh.ts'
import { createPoliteFetch } from './lib/polite-fetch.ts'
import { cardChanges } from './lib/release-notes.ts'
import { markRefreshed, readJson, STORE_PATHS, writeJson } from './lib/store.ts'

const get = createPoliteFetch({ 'www.playgwent.com': 1_000 })
const before = await readJson(STORE_PATHS.cards, {})
const { cards, cardNames, terms, tags } = await fetchCardData(get)

await markRefreshed('cards')
const changes = cardChanges(before, cards)
if (changes.length) consola.info(`${changes.length} card changes:\n  ${changes.join('\n  ')}`)
const written = [
  (await writeJson(STORE_PATHS.cards, cards)) && STORE_PATHS.cards,
  (await writeJson(STORE_PATHS.cardNames, cardNames)) && STORE_PATHS.cardNames,
  (await writeJson(STORE_PATHS.terms, terms)) && STORE_PATHS.terms,
  (await writeJson(STORE_PATHS.tags, tags)) && STORE_PATHS.tags,
].filter(Boolean)
consola.success(
  written.length
    ? `Updated ${written.join(', ')}; run pnpm build:data`
    : `${Object.keys(cards).length} cards, no changes`,
)
