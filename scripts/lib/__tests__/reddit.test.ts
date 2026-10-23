import { describe, expect, it } from 'vitest'
import { CONFIG } from '../../../src/config.ts'
import { indexDecks } from '../../../src/filter.ts'
import type { Card, Dataset, Deck } from '../../../src/types.ts'
import { redditReply } from '../reddit.ts'

// Two Monsters leaders (+15, so a 165 limit), a stratagem, and 30 one-provision units to build decks from.
const unit = (n: number): [number, Card] => [
  n,
  { name: `Unit ${n}`, type: 'unit', faction: 'NE', provisions: 1, scraps: 30, rarity: 'common' },
]
const CARDS: Dataset['cards'] = Object.fromEntries([
  [1, { name: 'Leader', type: 'leader', faction: 'MO', provisions: 15, scraps: 30, rarity: 'common' }],
  [2, { name: 'Other leader', type: 'leader', faction: 'MO', provisions: 15, scraps: 30, rarity: 'common' }],
  [10, { name: 'Stratagem', type: 'stratagem', faction: 'NE', provisions: 0, scraps: 30, rarity: 'common' }],
  ...Array.from({ length: 30 }, (_, i) => unit(100 + i)),
])
const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i)
/** A guide deck: leader, stratagem and one copy of each card, `provisions` used (the limit is 165). */
const deck = (guide: number, leader: number, cards: number[], provisions: number, video?: string): Deck => ({
  name: `Deck ${guide}`,
  id: `${guide}`.padStart(32, 'a'),
  url: `https://www.playgwent.com/decks/guides/${guide}`,
  stats: { scraps: 0, cards: cards.length, units: cards.length, provisions },
  sources: ['community'],
  cards: [[leader, 1], [10, 1], ...cards.map((id): [number, number] => [id, 1])],
  ...(video && { video: { url: video, lang: 'fr' } }),
})
const DATA: Dataset = {
  scrapedAt: '2026-10-18T17:02:03.534Z',
  cards: CARDS,
  tags: {},
  decks: [
    // 1 over, with a video: two close decks fit (18 and 15 of its 20 cards), one is too far (10).
    deck(1, 1, range(100, 20), 166, 'https://youtu.be/AAAAAAAAAAA'),
    deck(2, 1, [...range(100, 18), 120, 121], 165, 'https://youtu.be/BBBBBBBBBBB'),
    deck(3, 1, [...range(100, 15), ...range(122, 5)], 160),
    deck(4, 1, [...range(100, 10), ...range(120, 10)], 165),
    // Fits, no video: nothing to say.
    deck(5, 2, range(100, 20), 165),
    // 2 over, no video, and no other deck with its leader.
    deck(6, 2, range(110, 20), 167),
  ],
}
const DECKS = indexDecks(DATA)
const reply = (guide: number) => redditReply(DATA, DECKS, `https://www.playgwent.com/en/decks/guides/${guide}`)

describe('redditReply', () => {
  it('links the video and the close decks that fit, for an Over deck', () => {
    // Act
    const result = reply(1)

    // Assert
    if (!result.ok) throw new Error(result.reason)
    expect(result.markdown).toContain('**Gameplay video** (French): [watch it here](https://youtu.be/AAAAAAAAAAA)')
    expect(result.markdown).toContain(
      `${CONFIG.siteUrl}?deck=${encodeURIComponent('https://www.playgwent.com/decks/guides/1')}`,
    )
    expect(result.markdown).toContain("it's **1 over** the provision limit (166/165)")
    expect(result.markdown).toContain('[2 similar decks that fit](')
    expect(result.markdown).toContain(`&n=${DATA.decks[0].id})`)
    expect(result.markdown).toContain('the closest 18 of 20')
    expect(result.markdown).toMatch(/\^\(Data as of 2026-10-18\./)
  })

  it('only mentions the video for a deck that fits', () => {
    // Act
    const result = reply(2)

    // Assert
    if (!result.ok) throw new Error(result.reason)
    expect(result.markdown).toContain('youtu.be/BBBBBBBBBBB')
    expect(result.markdown).not.toContain('Provisions')
  })

  it('says who is posting only with author, after the small print', () => {
    // Act
    const [plain, author] = [reply(1), redditReply(DATA, DECKS, DATA.decks[0].url, { author: true })]

    // Assert
    if (!plain.ok || !author.ok) throw new Error('expected replies')
    expect(plain.markdown).not.toContain('I made')
    expect(author.markdown.endsWith('^(I made Gwent Deck Search; happy to answer questions.)')).toBe(true)
  })

  it('declines when there is no video and the deck fits', () => {
    // Act
    const result = reply(5)

    // Assert
    expect(result).toEqual({
      ok: false,
      reason: "No gameplay video, and it fits today's limit: nothing worth posting.",
    })
  })

  it('declines when an Over deck has no video and no close deck fits', () => {
    // Act
    const result = reply(6)

    // Assert
    expect(result.ok).toBe(false)
    expect(!result.ok && result.reason).toContain("it's 2 over today's limit, but no close deck fits")
  })

  it('declines a deck that is not in the list', () => {
    // Act
    const result = reply(99)

    // Assert
    expect(result.ok).toBe(false)
  })
})
