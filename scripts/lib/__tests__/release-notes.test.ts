import { describe, expect, it } from 'vitest'
import type { Dataset, Deck } from '../../../src/types.ts'
import { cardChanges, dataNotes, fileUnreleased, releaseNotes, shrunkSources, unreleased } from '../release-notes.ts'

const CHANGELOG = `# Changelog

Intro.

## Unreleased

- Fixed a thing (#1).

## 2026-10-16

- First release.
`

const deck = (id: string, sources: Deck['sources']): Deck => ({
  name: id,
  id,
  url: `https://www.playgwent.com/decks/${id}`,
  stats: { scraps: 0, cards: 25, units: 13, provisions: 165 },
  sources,
  cards: [],
})
const data = (decks: Deck[], cards: Dataset['cards'], scrapedAt = '2026-10-24T00:17:30.000Z'): Dataset => ({
  scrapedAt,
  cards,
  decks,
})
const BEFORE = data(
  [deck('a', ['community']), deck('b', ['shinmiri2'])],
  {
    1: { name: 'Arachas Swarm', type: 'leader', faction: 'MO', provisions: 15 },
    2: { name: 'Golden Nekker', type: 'special', faction: 'NE', provisions: 14 },
    3: { name: 'Chimera', type: 'unit', faction: 'MO', provisions: 10, power: 5 },
  },
  '2026-10-16T00:49:11.354Z',
)
const AFTER = data([deck('a', ['community', 'metallic-danny']), deck('c', ['metallic-danny'])], {
  1: { name: 'Arachas Swarm', type: 'leader', faction: 'MO', provisions: 16 },
  2: { name: 'Golden Nekker', type: 'special', faction: 'NE', provisions: 13 },
  3: { name: 'Chimera', type: 'unit', faction: 'MO', provisions: 10, power: 6 },
  4: { name: 'New Card', type: 'unit', faction: 'MO', provisions: 5, power: 3 },
})

describe('unreleased', () => {
  it('returns the entries under Unreleased, up to the next release', () => {
    // Act
    const result = unreleased(CHANGELOG)

    // Assert
    expect(result).toBe('- Fixed a thing (#1).')
  })

  it('is empty when nothing is unreleased', () => {
    // Arrange
    const changelog = '# Changelog\n\n## Unreleased\n\n## 2026-10-16\n\n- First release.\n'

    // Act
    const result = unreleased(changelog)

    // Assert
    expect(result).toBe('')
  })
})

describe('fileUnreleased', () => {
  it('moves the entries under the release heading and keeps an empty Unreleased', () => {
    // Act
    const result = fileUnreleased(CHANGELOG, '2026-10-24')

    // Assert
    expect(result).toContain('## Unreleased\n\n## 2026-10-24\n\n- Fixed a thing (#1).\n\n## 2026-10-16')
    expect(unreleased(result)).toBe('')
  })

  it('leaves the changelog alone when nothing is unreleased', () => {
    // Arrange
    const changelog = fileUnreleased(CHANGELOG, '2026-10-24')

    // Act
    const result = fileUnreleased(changelog, '2026-10-31')

    // Assert
    expect(result).toBe(changelog)
  })
})

describe('dataNotes', () => {
  it('counts decks per source and lists provision, bonus and power changes', () => {
    // Act
    const result = dataNotes(BEFORE, AFTER)

    // Assert
    expect(result).toBe(
      [
        '**2 decks** (±0), data as of 2026-10-24 00:17 UTC.',
        '',
        '- Community: 1 (±0)',
        '- MetallicDanny: 2 (+2)',
        '- Shinmiri2: 0 (−1)',
        '',
        '**Card changes**',
        '',
        '- Arachas Swarm: provision bonus 15 → 16',
        '- Chimera: power 5 → 6',
        '- Golden Nekker: provisions 14 → 13',
      ].join('\n'),
    )
  })

  it('has no card changes for the first release', () => {
    // Act
    const result = dataNotes(undefined, AFTER)

    // Assert
    expect(result).toContain('**2 decks** (+2)')
    expect(result).not.toContain('Card changes')
  })
})

describe('releaseNotes', () => {
  it('starts with the changelog entries when there are any', () => {
    // Act
    const result = releaseNotes(CHANGELOG, BEFORE, AFTER)

    // Assert
    expect(result.startsWith('### Changes\n\n- Fixed a thing (#1).\n\n### Data')).toBe(true)
  })

  it('joins entries wrapped over several lines', () => {
    // Arrange
    const changelog = '## Unreleased\n\n- A long entry\n  that wraps (#1).\n- Next.\n'

    // Act
    const result = releaseNotes(changelog, BEFORE, AFTER)

    // Assert
    expect(result).toContain('- A long entry that wraps (#1).\n- Next.')
  })

  it('is only data and links for a data-only release', () => {
    // Arrange
    const changelog = fileUnreleased(CHANGELOG, '2026-10-24')

    // Act
    const result = releaseNotes(changelog, BEFORE, AFTER)

    // Assert
    expect(result.startsWith('### Data')).toBe(true)
    expect(result).toContain('https://el8ted.github.io/gwentdecksearch/')
  })
})

describe('cardChanges', () => {
  it('lists cost, bonus and power changes, and new and removed cards', () => {
    // Arrange: Golden Nekker (2) leaves the catalog
    const { 2: _, ...after } = AFTER.cards

    // Act
    const result = cardChanges(BEFORE.cards, after)

    // Assert
    expect(result).toEqual([
      'Arachas Swarm: provision bonus 15 → 16',
      'Chimera: power 5 → 6',
      'Golden Nekker: removed',
      'New Card: new',
    ])
  })
})

describe('shrunkSources', () => {
  it('names a source that lost more than a quarter of its decks', () => {
    // Arrange: a sheet that answered but yielded no deck links
    const before = data([deck('a', ['shinmiri2']), deck('b', ['shinmiri2']), deck('c', ['community'])], {})
    const after = data([deck('c', ['community'])], {})

    // Act
    const result = shrunkSources(before, after)

    // Assert
    expect(result).toEqual(['Shinmiri2: 2 → 0 decks'])
  })

  it('allows normal turnover', () => {
    // Arrange: 1 of 4 decks leaves, exactly a quarter
    const four = ['a', 'b', 'c', 'd'].map((id) => deck(id, ['community']))
    const before = data(four, {})
    const after = data(four.slice(1), {})

    // Act
    const result = shrunkSources(before, after)

    // Assert
    expect(result).toEqual([])
  })
})
