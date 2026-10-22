import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { readAnalysisData } from '../analysis.ts'
import { CATEGORIES, type Change, effectOn, parseChanges, whatifReport } from '../whatif.ts'
import { DATA } from './analysis-data.ts'

const deck = (id: string) => DATA.decks.find((d) => d.deck.id === id) ?? DATA.decks[0]
const [POWER_UP, POWER_DOWN, PROV_UP, PROV_DOWN] = CATEGORIES
const change = (id: number, category: Change['category'], rank?: number): Change => ({
  id,
  category,
  ...(rank && { rank }),
})

describe('parseChanges', () => {
  it('reads the four lists: ranked picks, unranked extras and ties, by name or ID, skipping empty slots', () => {
    // Arrange
    const text = [
      '# ballot',
      'Power increase',
      '3. Kolgrim',
      '2.',
      '1.',
      'power decrease:',
      '- 105',
      'Provisions increase',
      '3. Caranthir Ar-Feiniel',
      '1. Arachas Swarm  # a leader',
      '1. Royal Decree',
      'Provision decrease',
      'Kolgrim',
    ].join('\n')

    // Act
    const parsed = parseChanges(text, DATA)

    // Assert
    expect(parsed).toEqual({
      ok: true,
      changes: [
        change(104, POWER_UP, 3),
        change(105, POWER_DOWN),
        change(100, PROV_UP, 3),
        change(1, PROV_UP, 1),
        change(102, PROV_UP, 1),
        change(104, PROV_DOWN),
      ],
      poll: false,
    })
  })

  it('stops on cards outside a list, unknown, ambiguous or contradictory, explaining each; nothing guessed', () => {
    // Arrange
    const text = [
      'Kolgrim',
      'Power increase',
      '3. 先知',
      '2. Caranthir',
      '1. Zzz',
      '- Kolgrim',
      '- Kolgrim',
      '- Royal Decree',
    ].join('\n')

    // Act
    const parsed = parseChanges(text, DATA, 'zh-cn')

    // Assert
    const errors = parsed.ok ? [] : parsed.errors
    expect(errors).toHaveLength(6)
    expect(errors[0]).toBe(
      'line 1: put "Kolgrim" under a heading: Power increase, Power decrease, Provision increase, Provision decrease',
    )
    expect(errors[1]).toMatch(
      /^line 3: "先知" could be any of these; use the full name or the ID:\n {2}105 .*\n {2}106 /,
    )
    expect(errors[2]).toMatch(/^line 4: no card is called "Caranthir"; did you mean:\n {2}100 {2}卡兰希尔/)
    expect(errors[3]).toBe('line 5: no card is called "Zzz"')
    expect(errors[4]).toBe('line 7: Kolgrim is already under Power increase')
    expect(errors[5]).toBe('line 8: Royal Decree is a special: only units have power')
  })
  it('reads a poll: a card may be on both lists of a kind, but not twice on one', () => {
    // Arrange
    const text = ['Poll', 'Power increase', '- Kolgrim', 'Power decrease', '- Kolgrim', '- Kolgrim'].join('\n')

    // Act
    const parsed = parseChanges(text, DATA)

    // Assert
    expect(parsed).toEqual({ ok: false, errors: ['line 6: Kolgrim is already under Power decrease'] })
    expect(parseChanges(text.split('\n').slice(0, 5).join('\n'), DATA)).toEqual({
      ok: true,
      changes: [change(104, POWER_UP), change(104, POWER_DOWN)],
      poll: true,
    })
  })
})

describe('effectOn', () => {
  it('moves decks against the limit for provision changes, and only touches them for power changes', () => {
    // Act / Assert: A is on its limit, B has 8 spare, C is 1 over
    expect(effectOn(deck('A'), [change(100, PROV_UP)], DATA.dataset.cards)).toEqual({
      effect: 'pushed over',
      before: 0,
      after: -1,
    })
    expect(effectOn(deck('B'), [change(100, PROV_UP)], DATA.dataset.cards).effect).toBe('still within')
    expect(effectOn(deck('C'), [change(1, PROV_UP)], DATA.dataset.cards)).toEqual({
      effect: 'back within',
      before: -1,
      after: 0,
    })
    expect(effectOn(deck('C'), [change(102, PROV_DOWN)], DATA.dataset.cards).effect).toBe('back within')
    expect(effectOn(deck('C'), [change(1, PROV_DOWN)], DATA.dataset.cards).effect).toBe('still over')
    expect(effectOn(deck('A'), [change(100, POWER_DOWN)], DATA.dataset.cards).effect).toBe('touched')
  })
})

describe('whatifReport', () => {
  it('summarizes every change, details each list, then all together with the decks hit by two or more', () => {
    // Arrange
    const changes = [change(104, POWER_UP, 3), change(100, PROV_UP, 3), change(1, PROV_UP), change(102, PROV_DOWN, 1)]

    // Act
    const report = whatifReport(DATA, changes, 'en', { detail: true })

    // Assert
    expect(report).toContain('## Power increase\n\n| Change | Rank | Card | Faction | Decks | Top leader |')
    expect(report).toContain('| 6 → 7 | 3 | Kolgrim | NG | 1 | Imperial Formation 100% | 0 · 1 · 0 |')
    expect(report).toContain(
      '## Provision increase\n\n| Change | Rank | Card | Faction | Decks | Pushed over | Back within | Top leader |',
    )
    expect(report).toContain('| 9 → 10 | 3 | Caranthir Ar-Feiniel | MO | 2 | 1 | 0 |')
    expect(report).toContain(
      '| pushed over | back within | still within | still over |\n|---:|---:|---:|---:|\n| 1 | 0 | 1 | 0 |',
    )
    expect(report).toContain('| 15 → 16 | extra | Arachas Swarm | MO | 3 | 0 | 1 |')
    expect(report).toContain('| 0 · 1 · 0 |\n\n### 3: Kolgrim (NG unit): 6 → 7\n\nIn 1 decks.\n\n| touched |')
    expect(report).toContain('## All 4 changes together\n\n5 decks hit; 4 by two or more.')
    expect(report).toContain('Decks hit by two or more:')
  })

  it("counts a poll's candidates each on their own, with no all-together total", () => {
    // Act
    const report = whatifReport(DATA, [change(100, PROV_UP), change(102, PROV_DOWN)], 'en', { poll: true })

    // Assert
    expect(report).toContain('# What if: poll')
    expect(report).toContain('2 candidates, each counted on its own: a poll lists options, not what passes.')
    expect(report).toContain('| Change | Card | Faction |')
    expect(report).toContain('| 9 → 10 | Caranthir Ar-Feiniel |')
    expect(report).not.toContain('together')
  })

  it('is one table by default, with the trend over the last half-years any deck is dated in', () => {
    // Act
    const report = whatifReport(DATA, [change(100, PROV_UP, 3), change(102, PROV_DOWN)])

    // Assert: fixture decks are dated 2025 H1, 2025 H2 and 2026 H2
    expect(report).toContain('| Top leader | 2025 H1 · 2025 H2 · 2026 H2 |')
    expect(report).toContain('| Arachas Swarm 100% | 1 · 0 · 1 |')
    expect(report).toContain('Add --detail')
    expect(report).not.toContain('### ')
    expect(report).toContain('## All 2 changes together')
  })

  it("shows a unit's power before and after", () => {
    // Act
    const report = whatifReport(DATA, [change(104, POWER_DOWN)])

    // Assert
    expect(report).toContain('| 6 → 5 | extra | Kolgrim |')
  })

  it('leaves the leader blank when no deck runs the card', () => {
    // Act
    const report = whatifReport(DATA, [change(106, PROV_UP, 1)])

    // Assert
    expect(report).toContain('| 6 → 7 | 1 | Farseer | ST | 0 | 0 | 0 |  | 0 · 0 · 0 |')
  })

  it('says when no deck runs a card, and leaves out the total for a single change', () => {
    // Act
    const report = whatifReport(DATA, [change(106, PROV_UP, 1)], 'en', { detail: true })

    // Assert
    expect(report).toContain('### 1: Farseer (ST unit): 6 → 7\n\nIn 0 decks.')
    expect(report).not.toContain('together')
  })
})

describe('the example ballots', () => {
  it('the example parses against the real data and fills every list; the template is empty but valid', async () => {
    // Arrange
    const data = await readAnalysisData()
    const read = (name: string) => readFile(`scripts/examples/${name}`, 'utf8')

    // Act
    const [example, template] = await Promise.all([read('ballot-example.txt'), read('ballot-template.txt')])
    const parsed = parseChanges(example, data)

    // Assert
    expect(parsed.ok).toBe(true)
    const lists = new Set(parsed.ok ? parsed.changes.map((c) => c.category.name) : [])
    expect(lists.size).toBe(4)
    expect(parseChanges(template, data)).toEqual({ ok: true, changes: [], poll: false })
    expect(template.match(/^[321]\.$/gm)).toHaveLength(12)
  })
})
