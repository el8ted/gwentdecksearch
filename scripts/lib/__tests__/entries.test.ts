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
const TABS = '{name: "14.5", pageUrl: "x", gid: "105"}, {name: "14.2", pageUrl: "x", gid: "102"}'

describe('collectEntries', () => {
  it('reads community guides 12 months back but sheet patch tabs only 6', async () => {
    // Arrange
    const requested: string[] = []
    const get = async (url: string) => {
      requested.push(url)
      if (url.includes('/api/guides/')) {
        return JSON.stringify({
          guides: [
            guide(1, '2026-10-01T00:00:00+00:00'),
            guide(2, '2025-12-01T00:00:00+00:00'),
            guide(3, '2025-09-01T00:00:00+00:00'),
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
})
