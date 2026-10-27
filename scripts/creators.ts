/**
 * Creator registry update: finds YouTube channels whose videos a community guide author embeds (see `seedCreators`)
 * and adds them, channel only, to data/source/creators.json, so `pnpm scrape:videos` reads them. Entries already there
 * are never changed; Gwent IDs are never guessed. Review what it adds; set languages, `skip` or confirmed IDs by hand.
 * `--check` changes nothing and prints, per creator, the guide authors the data ties to them and which of those
 * aren't confirmed IDs: check those in a video. Needs `YOUTUBE_API_KEY` (from `.env` locally).
 *
 * Run: `pnpm creators [--check]`.
 */
import { consola } from 'consola'
import { type Creator, creatorEvidence, creatorName, type GuideVideo, seedCreators } from './lib/creators.ts'
import { createPoliteFetch } from './lib/polite-fetch.ts'
import type { DeckEntry } from './lib/sources.ts'
import { readJson, STORE_PATHS, type StoredDeck, writeJson } from './lib/store.ts'
import type { StoredVideo } from './lib/youtube.ts'

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
if (process.argv.includes('--check')) {
  const stored = await readJson<Record<string, Record<string, StoredVideo>>>(STORE_PATHS.videos, {})
  const links = Object.fromEntries(
    Object.entries(stored).map(([id, ups]) => [id, Object.values(ups).flatMap((v) => v.decks)]),
  )
  const guideAuthor = new Map(entries.flatMap((e) => (e.guide ? [[e.url, e.guide.author] as const] : [])))
  const top = (list: [string, number][]) =>
    list
      .slice(0, 3)
      .map(([a, n]) => `${a} ${n}`)
      .join(', ') || '—'
  for (const c of registry.filter((c) => !c.skip)) {
    const { linked, embedding, toCheck } = creatorEvidence(c, links, guideAuthor, videos)
    console.log(
      `${creatorName(c)} [${(c.gwent ?? []).join(', ') || 'no ID'}]: links guides by ${top(linked)}; embedded by ${top(embedding)}` +
        (toCheck.length ? `; CHECK ${toCheck.join(', ')}` : ''),
    )
  }
  process.exit(0)
}
const added = seedCreators(videos, registry)
await writeJson(STORE_PATHS.creators, [...registry, ...added])
consola.success(
  `${videos.length} guide videos on ${new Set(videos.map((v) => v.channel)).size} channels; ` +
    (added.length
      ? `added ${added.length} creators: ${added.map((c) => `${creatorName(c)} (${c.channels[0].title})`).join(', ')}`
      : 'no new creators'),
)
