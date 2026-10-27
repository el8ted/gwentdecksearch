import { describe, expect, it } from 'vitest'
import type { Creator } from '../creators.ts'
import { deckLinks, readChannels, refreshChannel, type StoredVideo } from '../youtube.ts'

const CHANNEL = { id: 'UCZhWZdKjn0e3ctyVZxsMkKQ' }
const upload = (id: string, description = '') => ({
  snippet: {
    publishedAt: `2026-01-01T00:00:${id.slice(-2)}Z`,
    title: `Video ${id}`,
    description,
    resourceId: { videoId: id },
  },
})
const DECK = 'Deck: https://www.playgwent.com/en/decks/abc'

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

describe('readChannels', () => {
  it("lists every channel of every creator who isn't skipped", () => {
    // Arrange
    const a: Creator = {
      gwent: ['a'],
      channels: [
        { id: 'UC1', title: 'A', lang: 'en' },
        { id: 'UC2', title: 'A2', lang: 'ru' },
      ],
    }
    const b: Creator = { gwent: ['b'], channels: [{ id: 'UC3', title: 'B', lang: 'en' }], skip: true }

    // Act / Assert
    expect(readChannels([a, b])).toEqual([
      { channel: a.channels[0], creator: a },
      { channel: a.channels[1], creator: a },
    ])
  })
})

describe('refreshChannel', () => {
  it('reads every page the first time, keeping uploads that link a deck and the newest as a bookmark', async () => {
    // Arrange
    const requested: string[] = []
    const pages = [
      { nextPageToken: 'p2', items: [upload('v04'), upload('v03', DECK), upload('v02')] },
      { items: [upload('v01', DECK)] },
    ]
    const get = async (url: string) => {
      requested.push(url)
      return JSON.stringify(pages[requested.length - 1])
    }
    const known: Record<string, StoredVideo> = {}

    // Act
    const added = await refreshChannel(CHANNEL, known, get)

    // Assert
    expect(added).toBe(2)
    expect(requested[0]).toContain('playlistId=UUZhWZdKjn0e3ctyVZxsMkKQ')
    expect(requested[1]).toContain('pageToken=p2')
    expect(Object.keys(known).sort()).toEqual(['v01', 'v03', 'v04'])
    expect(known.v03).toEqual({
      published: '2026-01-01T00:00:03Z',
      title: 'Video v03',
      decks: ['https://www.playgwent.com/decks/abc'],
    })
  })

  it('stops at the first page that reaches the newest stored upload, and moves the bookmark', async () => {
    // Arrange
    const requested: string[] = []
    const get = async (url: string) => {
      requested.push(url)
      return JSON.stringify({ nextPageToken: 'p2', items: [upload('v06'), upload('v05', DECK), upload('v04')] })
    }
    const known: Record<string, StoredVideo> = {
      v04: { published: '2026-01-01T00:00:04Z', title: 'x', decks: [] },
      v03: { published: '2026-01-01T00:00:03Z', title: 'y', decks: ['d'] },
    }

    // Act
    const added = await refreshChannel(CHANNEL, known, get)

    // Assert
    expect(added).toBe(1)
    expect(requested).toHaveLength(1)
    expect(Object.keys(known).sort()).toEqual(['v03', 'v05', 'v06'])
  })
})
