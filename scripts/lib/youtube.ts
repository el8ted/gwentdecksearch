import type { Creator, CreatorChannel } from './creators.ts'
import type { GetBody } from './entries.ts'
import { type DeckEntry, monthsBefore, normalizeUrl } from './sources.ts'

/** Channel videos add decks from this many months back, like the deck sheets' patch tabs. */
export const VIDEO_WINDOW_MONTHS = 12

/** One upload that links a deck: when it went up, its title, and the deck links (normalized) its description names. */
export interface StoredVideo {
  published: string
  title: string
  decks: string[]
}

/** A page of the YouTube Data API's `playlistItems` (fields used). */
interface PlaylistPage {
  nextPageToken?: string
  items: {
    snippet: { publishedAt: string; title: string; description: string; resourceId: { videoId: string } }
  }[]
}

/**
 * The channels to read: every channel of every creator not marked `skip`, with its creator.
 *
 * @param creators - The registry
 * @returns Each channel once, in registry order
 */
export function readChannels(creators: Creator[]): { channel: CreatorChannel; creator: Creator }[] {
  return creators.filter((c) => !c.skip).flatMap((creator) => creator.channels.map((channel) => ({ channel, creator })))
}

/**
 * The playgwent deck links in a video description.
 *
 * @param description - The video's description
 * @returns Normalized deck and guide URLs, each once
 */
export function deckLinks(description: string): string[] {
  const urls = [...description.matchAll(/https?:\/\/\S+/g)].map(([url]) => normalizeUrl(url.replace(/[).,]+$/, '')))
  return [...new Set(urls.filter((u) => u !== undefined))]
}

/**
 * Adds a channel's new uploads that link a deck to `known`, newest first, stopping at the first page that reaches the
 * newest upload already stored. The channel's newest upload is kept even without a link, so the next run knows where
 * to stop; any older such bookmark is dropped.
 *
 * shortcut: a description edited after its video was stored isn't reread; clear the channel's store to reread all.
 *
 * @param channel - The channel
 * @param known - Its stored uploads by video ID, updated in place
 * @param get - Fetches a body (with the API key sent as a header)
 * @returns How many uploads that link a deck were added
 */
export async function refreshChannel(
  channel: Pick<CreatorChannel, 'id'>,
  known: Record<string, StoredVideo>,
  get: GetBody,
): Promise<number> {
  // A channel's uploads playlist is its ID with UC swapped for UU.
  const playlist = `UU${channel.id.slice(2)}`
  const newest = Object.values(known).reduce((max, v) => (v.published > max ? v.published : max), '')
  let added = 0
  let first = true
  let token: string | undefined
  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlist}${token ? `&pageToken=${token}` : ''}`
    const page: PlaylistPage = JSON.parse(await get(url))
    let reachedKnown = false
    for (const { snippet } of page.items) {
      if (snippet.publishedAt <= newest) {
        reachedKnown = true
        continue
      }
      const decks = deckLinks(snippet.description)
      if (decks.length) added++
      if (decks.length || first)
        known[snippet.resourceId.videoId] = { published: snippet.publishedAt, title: snippet.title, decks }
      first = false
    }
    token = reachedKnown ? undefined : page.nextPageToken
  } while (token)
  const latest = Object.values(known).reduce((max, v) => (v.published > max ? v.published : max), '')
  for (const [id, v] of Object.entries(known)) if (!v.decks.length && v.published !== latest) delete known[id]
  return added
}

/**
 * A deck name from a video title: hashtags, dates and "Gwent" (as a word or a bracketed tag) taken out, and the
 * separators left at either end trimmed. "GWENT | Scoia'tael | Guerilla Tactics #gwent" → "Scoia'tael | Guerilla Tactics".
 *
 * @param title - The video's title
 * @returns The name; empty if nothing is left (the build then names the deck after its leader)
 */
export function videoDeckName(title: string): string {
  return title
    .replace(/#\S+/g, '')
    .replace(/[【[(]\s*gwent\s*[】\])]/gi, '')
    .replace(/\bgwent\b/gi, '')
    .replace(/\b20\d\d[./-]\d{1,2}(?:[./-]\d{1,2})?\b|(?<!\d)\d{6}(?!\d)/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s*([|/·])(?:\s*[|/·:\-–—])+/g, ' $1')
    .replace(/^[\s|/·:\-–—]+|[\s|/·:\-–—.]+$/g, '')
    .replace(/\s{2,}/g, ' ')
}

/**
 * The language a video title is written in, for translating it as a deck name: by its script (Cyrillic, Japanese
 * kana, Hangul, Chinese), else English.
 *
 * shortcut: Latin-script titles count as English (most are, even on Polish or Indonesian channels); a Polish title
 * shows untranslated. Upgrade to language detection if that shows up often.
 *
 * @param title - The video's title
 * @returns A playgwent language code
 */
export function titleLang(title: string): string {
  if (/\p{Script=Cyrillic}/u.test(title)) return 'ru'
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(title)) return 'ja'
  if (/\p{Script=Hangul}/u.test(title)) return 'ko'
  if (/\p{Script=Han}/u.test(title)) return 'zh-cn'
  return 'en'
}

/**
 * Deck entries from the creators' videos: each deck link (not guide links, which the community listing has) in an
 * upload from the last {@link VIDEO_WINDOW_MONTHS} months, newest first, as a Community deck named after the video,
 * with the video in the channel's language.
 *
 * @param videos - Stored uploads by channel, then video ID
 * @param creators - The registry (skipped creators are left out)
 * @param now - Reference time for the window
 * @returns Entries, newest upload first; a deck in several videos appears once per video
 */
export function videoEntries(
  videos: Record<string, Record<string, StoredVideo>>,
  creators: Creator[],
  now: Date,
): DeckEntry[] {
  const since = monthsBefore(now, VIDEO_WINDOW_MONTHS).toISOString()
  return readChannels(creators)
    .flatMap(({ channel }) => Object.entries(videos[channel.id] ?? {}).map(([id, v]) => ({ id, v, channel })))
    .filter(({ v }) => v.published >= since)
    .sort((a, b) => b.v.published.localeCompare(a.v.published))
    .flatMap(({ id, v, channel }) =>
      v.decks
        .filter((url) => !url.includes('/decks/guides/'))
        .map((url) => ({
          name: videoDeckName(v.title),
          url,
          lang: titleLang(v.title),
          source: 'community' as const,
          video: { url: `https://youtu.be/${id}`, lang: channel.lang },
        })),
    )
}
