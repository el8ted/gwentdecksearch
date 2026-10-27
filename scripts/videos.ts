/**
 * Video refresh: reads the deck links in the video descriptions of every channel in data/source/creators.json (see
 * scripts/lib/youtube.ts) into data/source/videos.json; then run `pnpm scrape:decks`, which adds their decks. Needs `YOUTUBE_API_KEY` (from `.env` locally, a repository
 * secret in Actions). Without it, or if YouTube fails, the stored videos stay as they are: videos never block a release.
 *
 * Run: `pnpm scrape:videos`.
 */
import { consola } from 'consola'
import { type Creator, creatorName } from './lib/creators.ts'
import { createPoliteFetch } from './lib/polite-fetch.ts'
import { readJson, STORE_PATHS, writeJson } from './lib/store.ts'
import { readChannels, refreshChannel, type StoredVideo } from './lib/youtube.ts'

const key = process.env.YOUTUBE_API_KEY
if (!key) {
  consola.warn('No YOUTUBE_API_KEY: channel videos not refreshed')
  process.exit(0)
}
const get = createPoliteFetch({ 'www.googleapis.com': 500 }, { 'x-goog-api-key': key })
const store = await readJson<Record<string, Record<string, StoredVideo>>>(STORE_PATHS.videos, {})
const creators = await readJson<Creator[]>(STORE_PATHS.creators, [])
for (const { channel, creator } of readChannels(creators)) {
  const name = `${creatorName(creator)} (${channel.title})`
  store[channel.id] ??= {}
  const known = store[channel.id]
  try {
    const added = await refreshChannel(channel, known, get)
    const linked = Object.values(known).filter((v) => v.decks.length).length
    consola.info(`${name}: ${added} new uploads link a deck; ${linked} in all`)
  } catch (e) {
    // Keep what this channel had; the next run tries again.
    consola.warn(`${name}: videos not refreshed: ${(e as Error).message}`)
  }
}
await writeJson(STORE_PATHS.videos, store)
