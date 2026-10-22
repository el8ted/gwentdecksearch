import { describe, expect, it } from 'vitest'
import { companions, packageDecks, packageReport, parseSeed } from '../packages.ts'
import { DATA } from './analysis-data.ts'

const ids = (decks: { deck: { id: string } }[]) => decks.map((d) => d.deck.id)

describe('parseSeed', () => {
  it('reads a tag by key or by name in any language, and cards with an optional minimum', () => {
    // Act / Assert
    expect(parseSeed(['tag:defender'], undefined, DATA)).toEqual({ ok: true, seed: { tag: 'defender' } })
    expect(parseSeed(['tag:卫士'], undefined, DATA)).toEqual({ ok: true, seed: { tag: 'defender' } })
    expect(parseSeed(['Kolgrim', '103'], undefined, DATA)).toEqual({ ok: true, seed: { cards: [104, 103], min: 2 } })
    expect(parseSeed(['Kolgrim', '103'], 1, DATA)).toEqual({ ok: true, seed: { cards: [104, 103], min: 1 } })
  })

  it('stops on a mixed seed, an unknown tag, unknown or ambiguous cards, and a bad minimum', () => {
    // Act
    const errors = (args: string[], min?: number) => {
      const r = parseSeed(args, min, DATA, 'zh-cn')
      return r.ok ? [] : r.errors
    }

    // Assert
    expect(errors(['tag:defender', 'Kolgrim'])).toEqual(['give either one tag:… or cards, not both'])
    expect(errors(['tag:nope'])).toEqual(['no single tag is called "nope"'])
    expect(errors(['tag:def'])).toEqual(['no single tag is called "def"; it could be:\n  defender  Defender'])
    expect(errors(['先知'])[0]).toMatch(/^"先知" could be any of these; use the ID:\n {2}105/)
    expect(errors(['Caranth'])[0]).toMatch(/^no card is called "Caranth"; did you mean:\n {2}100/)
    expect(errors(['Zzz'])).toEqual(['no card is called "Zzz"'])
    expect(errors(['Kolgrim'], 2)).toEqual(['--min must be between 1 and 1'])
    expect(errors([])).toEqual(['name a card, or a tag as tag:<name>'])
  })
})

describe('packageDecks', () => {
  it('takes decks with a tagged card or a hand-listed one (Azar Javed for defenders)', () => {
    // Act
    const { decks, core } = packageDecks(DATA, { tag: 'defender' })

    // Assert
    expect(ids(decks)).toEqual(['D', 'E'])
    expect([...core]).toEqual([103, 202425])
  })

  it('takes decks with at least the minimum of the cards, a leader counting as a card', () => {
    // Act / Assert
    expect(ids(packageDecks(DATA, { cards: [100, 102], min: 1 }).decks)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(ids(packageDecks(DATA, { cards: [100, 1], min: 2 }).decks)).toEqual(['A', 'B'])
  })
})

describe('companions', () => {
  it('lists cards in 30% of the decks by lift, leaving out leaders, stratagems and the seed', () => {
    // Arrange: Monsters decks with Caranthir; Nekker is in every Monsters deck, so no lift over its faction
    const { decks, core } = packageDecks(DATA, { cards: [100], min: 1 })

    // Act
    const rows = companions(DATA, decks, core)

    // Assert
    expect(rows).toEqual([[101, 1, 1]])
  })

  it('measures a neutral card against every deck', () => {
    // Arrange: Royal Decree is in 3 of 5 decks; in D and E it's in both
    const { decks, core } = packageDecks(DATA, { tag: 'defender' })

    // Act
    const rows = companions(DATA, decks, core)

    // Assert
    expect(rows[0]).toEqual([102, 1, 1 / (3 / 5)])
  })
})

describe('packageReport', () => {
  it('reports who plays the package, when, and what goes with it', () => {
    // Act
    const report = packageReport(DATA, { cards: [100], min: 1 }, 'zh-cn')

    // Assert
    expect(report).toContain('# Package: 卡兰希尔 (Caranthir Ar-Feiniel)')
    expect(report).toContain("2 decks: 2 within today's limit, 1 with a video.")
    expect(report).toContain('| Nekker | MO | 4 | 100% | ×1.0 |')
  })

  it('names a tag and its cards, and says when the decks share no core or no deck runs it', () => {
    // Act
    const tagged = packageReport(DATA, { tag: 'defender' }, 'zh-cn')
    const loose = packageReport(DATA, { cards: [103, 202425], min: 1 })
    const none = packageReport(DATA, { cards: [106], min: 1 })

    // Assert
    expect(tagged).toContain('# Package: tag 卫士 (Ffion var Gaernel, Azar Javed)')
    expect(packageReport(DATA, { cards: [100, 102], min: 1 })).toContain('# Package: at least 1 of')
    expect(loose).toContain('| Royal Decree | NE | 9 | 100% | ×1.7 |')
    expect(none).toContain('No deck runs it.')
  })
})
