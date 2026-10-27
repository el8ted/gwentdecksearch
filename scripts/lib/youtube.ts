import type { Creator, CreatorChannel } from './creators.ts'
import type { GetBody } from './entries.ts'
import { normalizeUrl } from './sources.ts'

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
