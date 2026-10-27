import { describe, expect, it } from 'vitest'
import type { Creator } from '../creators.ts'
import {
  deckLinks,
  readChannels,
  refreshChannel,
  type StoredVideo,
  titleLang,
  videoDeckName,
  videoEntries,
} from '../youtube.ts'

const CHANNEL = { id: 'UCZhWZdKjn0e3ctyVZxsMkKQ' }
const upload = (id: string, description = '') => ({
  snippet: {
    publishedAt: `2026-01-01T00:00:${id.slice(-2)}Z`,
    title: `Video ${id}`,
    description,
    resourceId: { videoId: id },
  },
})
const DECK = 'Deck: https://www.playgwent.com/en/decks/abc00000'

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
      decks: ['https://www.playgwent.com/decks/abc00000'],
    })
  })

  it('saves nothing when a page fails, so the next run reads those uploads again', async () => {
    // Arrange: the first page reads, the second fails
    let calls = 0
    const get = async () => {
      calls++
      if (calls > 1) throw new Error('HTTP 503')
      return JSON.stringify({ nextPageToken: 'p2', items: [upload('v06', DECK), upload('v05')] })
    }
    const known: Record<string, StoredVideo> = { v01: { published: '2026-01-01T00:00:01Z', title: 'x', decks: ['d'] } }

    // Act / Assert
    await expect(refreshChannel(CHANNEL, known, get)).rejects.toThrow('HTTP 503')
    expect(Object.keys(known)).toEqual(['v01'])
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

describe('videoDeckName', () => {
  it('drops hashtags, dates and "Gwent", and trims the separators left over', () => {
    // Act / Assert
    expect(videoDeckName("Gwent | Scoia'tael | Guerilla Tactics #gwent #ST")).toBe("Scoia'tael | Guerilla Tactics")
    expect(videoDeckName('GWENT: Casino Lippy is Always Fun')).toBe('Casino Lippy is Always Fun')
    expect(videoDeckName('Compass Renfri! (Gwent Skellige Deck)')).toBe('Compass Renfri! (Skellige Deck)')
    expect(videoDeckName('【公爵領衛兵隊】『帝国陣形』が強い！【Gwent】')).toBe('【公爵領衛兵隊】『帝国陣形』が強い！')
    expect(videoDeckName('GWENT / 2026.10 / Precision Strike')).toBe('Precision Strike')
    expect(videoDeckName('Symbiosis vs #monster Card Game261021')).toBe('Symbiosis vs Card Game')
    expect(videoDeckName('Collab Guide. Gwent.')).toBe('Collab Guide')
    expect(videoDeckName('#gwent')).toBe('')
  })
})

describe('titleLang', () => {
  it('reads the language from the script, else English', () => {
    // Act / Assert
    expect(['Ахеронтия', '帝国陣形が強い', '제국', '昆特牌', 'Nagroda Główna'].map(titleLang)).toEqual([
      'ru',
      'ja',
      'ko',
      'zh-cn',
      'en',
    ])
  })
})

describe('videoEntries', () => {
  it("turns each deck link of the window's uploads into a Community deck named after its video, newest first", () => {
    // Arrange
    const creators: Creator[] = [
      { gwent: ['Jim'], channels: [{ id: 'UC1', title: 'Jim', lang: 'en' }] },
      { gwent: ['Agro'], channels: [{ id: 'UC2', title: 'AgroeN', lang: 'pl' }] },
      { gwent: ['Gone'], channels: [{ id: 'UC3', title: 'Gone', lang: 'en' }], skip: true },
    ]
    const deck = (h: string) => `https://www.playgwent.com/decks/${h}`
    const videos = {
      UC1: {
        old: { published: '2025-09-01T00:00:00Z', title: 'Old', decks: [deck('a')] },
        v1: { published: '2026-10-01T00:00:00Z', title: 'GWENT | Lippy', decks: [deck('b'), `${deck('guides')}/1`] },
      },
      UC2: { v2: { published: '2026-10-02T00:00:00Z', title: 'Ахеронтия', decks: [deck('c')] } },
      UC3: { v3: { published: '2026-10-03T00:00:00Z', title: 'Skipped', decks: [deck('d')] } },
    }

    // Act
    const entries = videoEntries(videos, creators, new Date('2026-10-27T00:00:00Z'))

    // Assert: the 2025-09 upload is outside the 12 months, the guide link and the skipped creator are left out
    expect(entries).toEqual([
      {
        name: 'Ахеронтия',
        url: deck('c'),
        lang: 'ru',
        source: 'community',
        video: { url: 'https://youtu.be/v2', lang: 'pl' },
      },
      {
        name: 'Lippy',
        url: deck('b'),
        lang: 'en',
        source: 'community',
        video: { url: 'https://youtu.be/v1', lang: 'en' },
      },
    ])
  })
})
