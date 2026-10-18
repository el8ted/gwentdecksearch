import type { Page } from '@playwright/test'
import { expect, test } from './app.ts'

// F05: re-rendering replaces the activated button; focus must land on its new copy or the nearest control.
const focused = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement as HTMLElement
    return a === document.body ? 'body' : a.id ? `#${a.id}` : JSON.stringify({ ...a.dataset })
  })

async function enter(page: Page, selector: string) {
  await page.locator(selector).first().focus()
  await page.keyboard.press('Enter')
}

for (const [label, selector, key] of [
  ['faction pill', '[data-faction="MO"]', 'faction'],
  ['source pill', '[data-source="community"]', 'source'],
  ['budget pill', '[data-budget="exact"]', 'budget'],
  ['deck toggle', '[data-toggle]', 'toggle'],
] as const) {
  test(`Enter on a ${label} keeps focus on it`, async ({ page, open }) => {
    // Arrange
    await open()
    const value = await page.locator(selector).first().getAttribute(`data-${key}`)

    // Act
    await enter(page, selector)

    // Assert
    await expect.poll(() => focused(page)).toBe(JSON.stringify({ [key]: value }))
  })
}

test('a faction pill toggles twice by keyboard without losing focus', async ({ page, open }) => {
  // Arrange
  await open()

  // Act
  await enter(page, '[data-faction="MO"]')
  await page.keyboard.press('Enter')

  // Assert
  await expect(page).not.toHaveURL(/#/)
  await expect.poll(() => focused(page)).toBe(JSON.stringify({ faction: 'MO' }))
})

test('adding from a frequency bar keeps focus at that place in the panel, and the page stays put', async ({
  page,
  open,
}) => {
  // Arrange: a phone-sized window, scrolled to the panel
  await page.setViewportSize({ width: 412, height: 915 })
  await open()
  const bars = page.locator('#bars [data-add]')
  await bars.nth(2).scrollIntoViewIfNeeded()
  const id = await bars.nth(2).getAttribute('data-add')
  const scrolled = await page.evaluate(() => scrollY)

  // Act
  await bars.nth(2).click()

  // Assert
  await expect(page.locator(`#chips [data-remove="${id}"]`)).toBeVisible()
  // Counts change with the new filter, so the panel reorders; focus stays at the same row.
  await expect.poll(() => bars.nth(2).evaluate((b) => b === document.activeElement)).toBe(true)
  expect(
    await page
      .locator('#bars [data-add]')
      .evaluateAll((b, id) => b.some((x) => (x as HTMLElement).dataset.add === id), id),
  ).toBe(false)
  expect(Math.abs((await page.evaluate(() => scrollY)) - scrolled)).toBeLessThan(80)
})

test('removing a chip focuses the search box', async ({ page, open }) => {
  // Arrange
  await open()
  const id = await page.locator('[data-add]').first().getAttribute('data-add')
  await enter(page, `[data-add="${id}"]`)

  // Act
  await enter(page, `#chips [data-remove="${id}"]`)

  // Assert
  await expect.poll(() => focused(page)).toBe('#card-input')
  await expect(page.locator('#chips li')).toHaveCount(0)
})

test('"any stratagem" clears it and focuses the first stratagem pill', async ({ page, open }) => {
  // Arrange
  await open()
  const first = page.locator('#stratagem [data-stratagem]').first()
  const id = await first.getAttribute('data-stratagem')
  await page.locator('#stratagem [data-stratagem]').nth(1).click()

  // Act
  await enter(page, '[data-any-stratagem]')

  // Assert
  await expect.poll(() => focused(page)).toBe(JSON.stringify({ stratagem: id }))
  await expect(page.locator('#stratagem [aria-pressed="true"]')).toHaveCount(0)
})
