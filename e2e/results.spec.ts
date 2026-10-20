import { CONFIG } from '../src/config.ts'
import { FACTIONS } from '../src/types.ts'
import { data, expect, expectedCount, test } from './app.ts'

const PAGE = CONFIG.resultsPageSize
const rows = '#results > li.deck'

test('lists 100 decks, and "Show more" adds the next 100', async ({ page, open }) => {
  // Arrange
  await open()
  const total = data.decks.length
  test.skip(total <= 2 * PAGE, 'needs more than 200 decks')
  await expect(page.locator('#result-head')).toHaveText(new RegExp(`^${total} `))
  await expect(page.locator(rows)).toHaveCount(PAGE)
  const more = page.locator('[data-more]')
  await expect(more).toHaveText(`Show ${PAGE} more decks`)

  // Act
  await more.focus()
  await page.keyboard.press('Enter')

  // Assert
  await expect(page.locator(rows)).toHaveCount(2 * PAGE)
  await expect(page.locator(`${rows} [data-toggle]`).nth(PAGE)).toBeFocused()
})

test('a filter change starts the list over at 100', async ({ page, open }) => {
  // Arrange
  await open()
  await page.locator('[data-more]').click()
  await expect(page.locator(rows)).toHaveCount(2 * PAGE)

  // Act
  await page.locator('[data-budget="over1"]').click()

  // Assert
  const n = expectedCount({ budgets: ['over1'] })
  await expect(page.locator(rows)).toHaveCount(Math.min(n, PAGE))
  await expect(page.locator('[data-more]')).toHaveCount(n > PAGE ? 1 : 0)
})

test('Expand all expands only the rendered decks', async ({ page, open }) => {
  // Arrange
  await open()

  // Act
  await page.locator('#expand-all').click()

  // Assert
  await expect(page.locator(`${rows} [aria-expanded="true"]`)).toHaveCount(PAGE)
  await page.locator('[data-more]').click()
  await expect(page.locator(`${rows} [aria-expanded="true"]`)).toHaveCount(PAGE)
  await expect(page.locator('#expand-all')).toHaveText('Expand all')
})

test('the last page shows the remainder and no button', async ({ page, open }) => {
  // Arrange
  // The smallest faction that still needs "Show more", so the test follows the data and stays quick.
  const [faction, n] = FACTIONS.map((f) => [f, expectedCount({ factions: [f] })] as const)
    .filter(([, c]) => c > PAGE)
    .sort((a, b) => a[1] - b[1])[0]
  await open(`#f=${faction}`)

  // Act
  while (await page.locator('[data-more]').count()) await page.locator('[data-more]').click()

  // Assert
  await expect(page.locator(rows)).toHaveCount(n)
})

test('a community guide shows its last-updated UTC date; a sheet deck shows none', async ({ page, open }) => {
  // Arrange
  // Decks on a source's first page, in the page's name order.
  const firstPage = (src: string) =>
    data.decks
      .filter((d) => d.sources.includes(src as never))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .slice(0, PAGE / 2)
  const guide = firstPage('community').find((d) => d.updated)
  const sheetDeck = firstPage('shinmiri2').find((d) => !d.updated)
  if (!guide?.updated || !sheetDeck) throw new Error('fixture decks not found')

  // Act
  await open('#src=community')

  // Assert
  const time = page.locator(`[data-toggle="${guide.id}"] time.updated`)
  await expect(time).toHaveAttribute('datetime', guide.updated)
  const utcDay = new Date(guide.updated).toLocaleDateString('en', { dateStyle: 'medium', timeZone: 'UTC' })
  await expect(time).toHaveText(utcDay)
  await open('#src=shinmiri2')
  await expect(page.locator(`[data-toggle="${sheetDeck.id}"] time`)).toHaveCount(0)
})

for (const [w, words] of [
  [1280, true],
  [360, false],
] as const) {
  test(`deck buttons ${words ? 'say what they do in words' : 'keep their symbols'} at ${w}px, and screen readers hear the full name`, async ({
    page,
    open,
  }) => {
    // Arrange
    await page.setViewportSize({ width: w, height: 800 })

    // Act
    await open()
    const select = page.locator('#results [data-select]').first()

    // Assert
    await expect(select.locator('.btn-word')).toBeVisible({ visible: words })
    await expect(select).toHaveAccessibleName(/^Show only /)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w)
  })
}

test('a pressed ⧉ keeps its text readable while hovered', async ({ page, open }) => {
  // Arrange
  await open()
  await page.locator('#results [data-select]').first().click()
  const pressed = page.locator('#results [data-select][aria-pressed="true"]').first()

  // Act
  await pressed.hover()

  // Assert: the text isn't painted in the colour of the fill behind it
  const [color, fill] = await pressed.evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor])
  expect(color).not.toBe(fill)
})
