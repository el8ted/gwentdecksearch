import { consola } from 'consola'
import { describe, expect, it, vi } from 'vitest'
import { collectEntries } from '../entries.ts'

vi.mock('consola', () => ({ consola: { info: vi.fn(), warn: vi.fn() } }))

const guide = (id: number, modified: string) => ({
  id,
  name: `Guide ${id}`,
  language: 'en',
  modified,
  votes: 0,
  author: 'a',
  hidden: false,
  published: true,
  invalid: false,
})
const TABS = '{name: "14.5", pageUrl: "x", gid: "105"}, {name: "13.8", pageUrl: "x", gid: "102"}'
const NOW = new Date('2026-10-15T00:00:00Z')
// An empty zip: a sheet without links.
const noLinks = async () => Buffer.from([0x50, 0x4b, 0x05, 0x06, ...Array(18).fill(0)])
const SHINMIRI_HEADER =
  'Faction,Leader,Deck Name,Deck Link,Alternate Version,Alternate Description,Youtube video,Last Edited,'
const shinmiriRow = (name: string, hash: string, video = '') =>
  `MO,Arachas Swarm,${name},https://www.playgwent.com/en/decks/${hash},,,${video},12/5/2025,`
/** A `get` serving no guides, the given Shinmiri2 CSV per tab, an empty MetallicDanny sheet, and these tab lists. */
const sheets =
  (csvByGid: Record<string, string>, tabs = TABS) =>
  async (url: string) => {
    if (url.includes('/api/guides/')) return JSON.stringify({ guides: [] })
    if (url.endsWith('/htmlview')) return tabs
    const gid = /gid=(\d+)/.exec(url)?.[1] ?? ''
    return url.includes('1h4m0zh') ? (csvByGid[gid] ?? SHINMIRI_HEADER) : 'header\n'
  }

describe('collectEntries', () => {
  it('reads community guides 18 months back but sheet patch tabs only 12', async () => {
    // Arrange
    const requested: string[] = []
    const get = async (url: string) => {
      requested.push(url)
      if (url.includes('/api/guides/')) {
        return JSON.stringify({
          guides: [
            guide(1, '2026-10-01T00:00:00+00:00'),
            guide(2, '2025-06-01T00:00:00+00:00'),
            guide(3, '2025-03-01T00:00:00+00:00'),
          ],
        })
      }
      return url.endsWith('/htmlview') ? TABS : 'header\n'
    }

    // Act
    const getBytes = async (url: string) => {
      requested.push(url)
      // An empty zip: a sheet without links.
      return Buffer.from([0x50, 0x4b, 0x05, 0x06, ...Array(18).fill(0)])
    }
    const { entries } = await collectEntries(get, getBytes, new Date('2026-10-15T00:00:00Z'))

    // Assert
    expect(entries.map((e) => e.name)).toEqual(['Guide 1', 'Guide 2'])
    expect(requested.some((u) => u.endsWith('gid=105'))).toBe(true)
    expect(requested.some((u) => u.endsWith('gid=102'))).toBe(false)
    // Only MetallicDanny's sheet has link chips, so only its tabs are read as xlsx.
    expect(requested.filter((u) => u.includes('format=xlsx')).map((u) => u.split('/')[5])).toEqual([
      '1_nLQ_0y1t_3zRAwjRSPjSv4djBSRKHPyli3hNrjRgkg',
      '1_nLQ_0y1t_3zRAwjRSPjSv4djBSRKHPyli3hNrjRgkg',
    ])
  })

  it('takes other windows, as experiments with the window do', async () => {
    // Arrange
    const requested: string[] = []
    const get = async (url: string) => {
      requested.push(url)
      if (url.includes('/api/guides/')) {
        return JSON.stringify({
          guides: [guide(1, '2026-10-01T00:00:00+00:00'), guide(2, '2025-06-01T00:00:00+00:00')],
        })
      }
      return url.endsWith('/htmlview') ? TABS : 'header\n'
    }

    // Act
    const { entries } = await collectEntries(get, noLinks, NOW, { community: 12, sheets: 6 })

    // Assert
    expect(entries.map((e) => e.name)).toEqual(['Guide 1'])
    expect(requested.some((u) => u.endsWith('gid=105'))).toBe(true)
    expect(requested.some((u) => u.endsWith('gid=102'))).toBe(false)
  })

  it('pages through the guide listing until a page is short', async () => {
    // Arrange: a full page of recent guides, then one more
    const requested: string[] = []
    const get = async (url: string) => {
      requested.push(url)
      if (!url.includes('/api/guides/')) return url.endsWith('/htmlview') ? TABS : 'header\n'
      const full = url.includes('/offset/0/')
      const ids = full ? Array.from({ length: 500 }, (_, i) => i) : [500]
      return JSON.stringify({ guides: ids.map((id) => guide(id, '2026-10-01T00:00:00+00:00')) })
    }

    // Act
    const { listed } = await collectEntries(get, noLinks, NOW)

    // Assert
    expect(listed).toBe(501)
    expect(requested.filter((u) => u.includes('/api/guides/'))).toEqual([
      'https://www.playgwent.com/en/decks/api/guides/offset/0/limit/500',
      'https://www.playgwent.com/en/decks/api/guides/offset/500/limit/500',
    ])
  })

  it("lists a sheet's main decks, then its patch tabs' decks, and reports what the tabs add and how many have videos", async () => {
    // Arrange: a main list of two (one with a video), and a tab repeating one and adding another
    const get = sheets({
      '1592369710': [
        SHINMIRI_HEADER,
        shinmiriRow('Swarm', 'aaaa', 'https://youtu.be/AAAAAAAAAAA'),
        shinmiriRow('Portal', 'bbbb'),
      ].join('\n'),
      '105': [SHINMIRI_HEADER, shinmiriRow('Portal', 'bbbb'), shinmiriRow('Nekkers', 'cccc')].join('\n'),
    })

    // Act
    const { entries } = await collectEntries(get, noLinks, NOW)

    // Assert
    expect(entries.map((e) => e.name)).toEqual(['Swarm', 'Portal', 'Portal', 'Nekkers'])
    expect(consola.info).toHaveBeenCalledWith(
      'Shinmiri2: 2 links on the main list; 1 patch tabs (14.5) add 1; 1 decks with a video',
    )
  })

  it('warns when a sheet has no patch tabs in the window, since its layout may have changed', async () => {
    // Arrange
    const get = sheets({}, '')

    // Act
    await collectEntries(get, noLinks, NOW)

    // Assert
    expect(consola.warn).toHaveBeenCalledWith(
      'Shinmiri2: no patch tabs in the window; tab list layout may have changed',
    )
  })
})
