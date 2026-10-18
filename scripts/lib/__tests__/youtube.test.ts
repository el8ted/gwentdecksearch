import { describe, expect, it } from 'vitest'
import { CHANNELS, deckLinks, refreshChannel, type StoredVideo } from '../youtube.ts'

const upload = (id: string, description = '') => ({
  snippet: { publishedAt: `2026-01-01T00:00:${id.slice(-2)}Z`, description, resourceId: { videoId: id } },
})

describe('deckLinks', () => {
  it('finds each playgwent deck or guide link once, normalized, and ignores other links', () => {
    // Arrange
    const description = `https://forms.gle/x
Deck: https://www.playgwent.com/en/decks/d8bdb97b343c4f8f65401c94441874c1
Guide (https://www.playgwent.com/ru/decks/guides/389873).
Again: https://www.playgwent.com/decks/d8bdb97b343c4f8f65401c94441874c1
Live at https://www.twitch.tv/shinmiri2`

    // Act
    const links = deckLinks(description)

    // Assert
    expect(links).toEqual([
      'https://www.playgwent.com/decks/d8bdb97b343c4f8f65401c94441874c1',
      'https://www.playgwent.com/decks/guides/389873',
    ])
  })
})

describe('refreshChannel', () => {
  it("reads every page the first time, from the channel's uploads playlist", async () => {
    // Arrange
    const requested: string[] = []
    const pages = [
      { nextPageToken: 'p2', items: [upload('v03', 'Deck: https://www.playgwent.com/en/decks/abc'), upload('v02')] },
      { items: [upload('v01')] },
    ]
    const get = async (url: string) => {
      requested.push(url)
      return JSON.stringify(pages[requested.length - 1])
    }
    const known: Record<string, StoredVideo> = {}

    // Act
    const added = await refreshChannel(CHANNELS[0], known, get)

    // Assert
    expect(added).toBe(3)
    expect(requested[0]).toContain('playlistId=UUZhWZdKjn0e3ctyVZxsMkKQ')
    expect(requested[1]).toContain('pageToken=p2')
    expect(known.v03).toEqual({ published: '2026-01-01T00:00:03Z', decks: ['https://www.playgwent.com/decks/abc'] })
  })

  it('stops at the first page holding an upload it already has', async () => {
    // Arrange
    const requested: string[] = []
    const get = async (url: string) => {
      requested.push(url)
      return JSON.stringify({ nextPageToken: 'p2', items: [upload('v04'), upload('v03')] })
    }
    const known: Record<string, StoredVideo> = { v03: { published: 'x', decks: [] } }

    // Act
    const added = await refreshChannel(CHANNELS[0], known, get)

    // Assert
    expect(added).toBe(1)
    expect(requested).toHaveLength(1)
  })
})
