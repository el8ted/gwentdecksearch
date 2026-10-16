import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test as base, expect } from '@playwright/test'
import { type FilterState, indexDecks, matchDecks } from '../src/filter.ts'
import type { Dataset } from '../src/types.ts'

const ROOT = join(import.meta.dirname, '..')
const PAGE_URL = pathToFileURL(join(ROOT, 'dist', 'index.html')).href

/** The dataset the build bundles, so expected counts follow the data instead of hard-coded numbers. */
export const data: Dataset = JSON.parse(readFileSync(join(ROOT, 'data', 'decks.json'), 'utf8'))
const decks = indexDecks(data)

/** How many decks the page should list for a filter state. */
export function expectedCount(state: Partial<FilterState>): number {
  return matchDecks(decks, { factions: [], cards: [], ...state }).length
}

/** A language pack as the page loads it (data/i18n/{lang}.js). */
export function pack(lang: string): { terms: Record<string, string>; cards: Record<string, string> } {
  const g: Record<string, Record<string, never>> = {}
  new Function('globalThis', readFileSync(join(ROOT, 'data', 'i18n', `${lang}.js`), 'utf8'))(g)
  return g.GDS_I18N[lang]
}

/** `test` with `open(suffix?)`, which loads the page (`suffix` = `?query` and/or `#hash`) and fails on any page error. */
export const test = base.extend<{ open: (suffix?: string) => Promise<void> }>({
  open: async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await use(async (suffix = '') => {
      await page.goto(PAGE_URL + suffix)
    })
    expect(errors).toEqual([])
  },
})

export { expect }

/**
 * Neutral cards (no faction constraint) in the most decks, whose English name isn't the start of another card's
 * name, so typing the full name puts them first in the suggestions.
 *
 * @param n - How many
 * @returns Card IDs, most common first
 */
export function commonNeutralCards(n: number): number[] {
  const counts = new Map<number, number>()
  for (const d of data.decks) for (const [id] of d.cards) counts.set(id, (counts.get(id) ?? 0) + 1)
  const names = Object.values(data.cards).map((c) => c.name.toLowerCase())
  return [...counts]
    .filter(([id]) => {
      const c = data.cards[id]
      const name = c.name.toLowerCase()
      return (
        c.faction === 'NE' &&
        c.type !== 'leader' &&
        c.type !== 'stratagem' &&
        names.filter((x) => x.startsWith(name)).length === 1
      )
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => id)
}

/** The leading number of a "N decks match" heading. */
export const headCount = (text: string | null) => Number.parseInt(text ?? '', 10)
