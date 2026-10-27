/**
 * Creator registry update: finds community guide authors' YouTube channels (a channel whose guide videos all belong
 * to one author, see `seedCreators`) and adds them to data/source/creators.json, so `pnpm scrape:videos` reads them
 * and search finds the author by their channel's name too. Entries already there are never changed: review what it
 * adds, and fix names, languages or `skip` by hand. Needs `YOUTUBE_API_KEY` (from `.env` locally).
 *
 * Run: `pnpm creators`.
 */
import { consola } from 'consola'
import { type Creator, creatorName, type GuideVideo, seedCreators } from './lib/creators.ts'
import { createPoliteFetch } from './lib/polite-fetch.ts'
import type { DeckEntry } from './lib/sources.ts'
import { readJson, STORE_PATHS, type StoredDeck, writeJson } from './lib/store.ts'

const key = process.env.YOUTUBE_API_KEY
if (!key) {
  consola.error('No YOUTUBE_API_KEY: put it in .env')
  process.exit(2)
}
const get = createPoliteFetch({ 'www.googleapis.com': 500 }, { 'x-goog-api-key': key })
const entries = await readJson<DeckEntry[]>(STORE_PATHS.entries, [])
const store = await readJson<Record<string, StoredDeck>>(STORE_PATHS.decks, {})
const registry = await readJson<Creator[]>(STORE_PATHS.creators, [])

// Each guide video once, with its guide's author and language.
const guides = new Map<string, { author: string; lang: string }>()
for (const e of entries) {
  const s = store[e.url]
  const id = s && !('missing' in s) ? s.guide?.video?.match(/youtu\.be\/([\w-]{11})/)?.[1] : undefined
  if (id && e.guide && !guides.has(id)) guides.set(id, { author: e.guide.author, lang: e.lang })
}
const videos: GuideVideo[] = []
const ids = [...guides.keys()]
// One call per 50 videos (1 quota unit each).
for (let i = 0; i < ids.length; i += 50) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&maxResults=50&id=${ids.slice(i, i + 50).join(',')}`
  const page: { items: { id: string; snippet: { channelId: string; channelTitle: string } }[] } = JSON.parse(
    await get(url),
  )
  for (const { id, snippet } of page.items) {
    const guide = guides.get(id)
    if (guide) videos.push({ ...guide, channel: snippet.channelId, channelTitle: snippet.channelTitle })
  }
}
const added = seedCreators(videos, registry)
await writeJson(STORE_PATHS.creators, [...registry, ...added])
consola.success(
  `${videos.length} guide videos on ${new Set(videos.map((v) => v.channel)).size} channels; ` +
    (added.length
      ? `added ${added.length} creators: ${added.map((c) => `${creatorName(c)} (${c.channels[0].title})`).join(', ')}`
      : 'no new creators'),
)
