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

test('adding from a frequency bar, then removing the chip, focuses the card box', async ({ page, open }) => {
  // Arrange
  await open()
  const id = await page.locator('[data-add]').first().getAttribute('data-add')

  // Act + Assert
  await enter(page, `[data-add="${id}"]`)
  await expect.poll(() => focused(page)).toBe('#card-input')
  await enter(page, `#chips [data-remove="${id}"]`)
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
