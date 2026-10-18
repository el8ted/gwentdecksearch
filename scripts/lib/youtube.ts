import type { GetBody } from './entries.ts'
import { normalizeUrl } from './sources.ts'

/** A YouTube channel whose video descriptions link the deck each video plays. */
export interface Channel {
  name: string
  id: string
  /** The language its videos are narrated in (playgwent code). */
  lang: string
}

/** Channels read for deck videos. Descriptions read e.g. "Deck: https://www.playgwent.com/en/decks/{hash}". */
export const CHANNELS: Channel[] = [{ name: 'Shinmiri2', id: 'UCZhWZdKjn0e3ctyVZxsMkKQ', lang: 'en' }]

/** One upload: when it went up, and the deck links (normalized) its description names. */
export interface StoredVideo {
  published: string
  decks: string[]
}

/** A page of the YouTube Data API's `playlistItems` (fields used). */
interface PlaylistPage {
  nextPageToken?: string
  items: { snippet: { publishedAt: string; description: string; resourceId: { videoId: string } } }[]
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
 * Adds a channel's new uploads to `known`, newest first, stopping at the first page with one already known.
 *
 * shortcut: a description edited after its video was stored isn't reread; clear the channel's store to reread all.
 *
 * @param channel - The channel
 * @param known - Its stored uploads by video ID, updated in place
 * @param get - Fetches a body (with the API key sent as a header)
 * @returns How many uploads were added
 */
export async function refreshChannel(
  channel: Channel,
  known: Record<string, StoredVideo>,
  get: GetBody,
): Promise<number> {
  // A channel's uploads playlist is its ID with UC swapped for UU.
  const playlist = `UU${channel.id.slice(2)}`
  let added = 0
  let token: string | undefined
  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlist}${token ? `&pageToken=${token}` : ''}`
    const page: PlaylistPage = JSON.parse(await get(url))
    let reachedKnown = false
    for (const { snippet } of page.items) {
      const id = snippet.resourceId.videoId
      if (known[id]) reachedKnown = true
      else {
        known[id] = { published: snippet.publishedAt, decks: deckLinks(snippet.description) }
        added++
      }
    }
    token = reachedKnown ? undefined : page.nextPageToken
  } while (token)
  return added
}
