import type { Page } from '@playwright/test'
import { BUDGETS, budgetSide, indexDecks, matchDecks } from '../src/filter.ts'
import { data, expect, test } from './app.ts'

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

/** Whether the first element `selector` matches has focus. */
const hasFocus = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => el === document.activeElement)

const decks = indexDecks(data)
// An Over deck with close decks that fit, as in similar.spec.ts: ≈ on it hides it, so the note offers Show it.
const over = decks.find(
  (e) =>
    budgetSide(e.budget) === 'over' &&
    matchDecks(decks, {
      factions: [e.faction],
      picks: [],
      leader: e.leader,
      near: e.deck.id,
      budgets: BUDGETS.filter((b) => budgetSide(b) !== 'over'),
    }).length > 1,
)
if (!over) throw new Error('need an Over deck with similar decks')

test('a deck toggle keeps focus when it closes too', async ({ page, open }) => {
  // Arrange
  await open()
  const id = await page.locator('[data-toggle]').first().getAttribute('data-toggle')
  await enter(page, `[data-toggle="${id}"]`)

  // Act
  await page.keyboard.press('Enter')

  // Assert
  await expect(page.locator(`[data-toggle="${id}"]`)).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(() => focused(page)).toBe(JSON.stringify({ toggle: id }))
})

test('≈ on a deck the filters hide focuses the results heading', async ({ page, open }) => {
  // Arrange: ≈ turns the Over steps off, so this Over deck isn't listed and its ≈ button is gone
  await open(`#d=${over.list}`)

  // Act
  await enter(page, `[data-near="${over.deck.id}"]`)

  // Assert
  await expect.poll(() => focused(page)).toBe('#result-head')
})

test('≈ on a deck in a Similar list keeps focus on its ≈, now leading the list as This deck', async ({
  page,
  open,
}) => {
  // Arrange
  await open(`#d=${over.list}`)
  await page.locator(`[data-near="${over.deck.id}"]`).click()
  const id = await page.locator('#results [data-near]').first().getAttribute('data-near')

  // Act
  await enter(page, `[data-near="${id}"]`)

  // Assert
  await expect(page.locator('#results .badge.shared').first()).toHaveText('This deck')
  await expect.poll(() => focused(page)).toBe(JSON.stringify({ near: id }))
})

test('✕ on the Deck pill focuses the search box', async ({ page, open }) => {
  // Arrange
  await open(`#d=${over.list}`)

  // Act
  await enter(page, '[data-remove-deck]')

  // Assert
  await expect(page.locator('[data-remove-deck]')).toHaveCount(0)
  await expect.poll(() => focused(page)).toBe('#card-input')
})

test('✕ on the Similar pill focuses the search box', async ({ page, open }) => {
  // Arrange
  await open(`#d=${over.list}`)
  await page.locator(`[data-near="${over.deck.id}"]`).click()

  // Act
  await enter(page, '[data-remove-near]')

  // Assert
  await expect(page.locator('[data-remove-near]')).toHaveCount(0)
  await expect.poll(() => focused(page)).toBe('#card-input')
})

test("a chip's name flips it twice without losing focus", async ({ page, open }) => {
  // Arrange
  await open()
  const id = await page.locator('[data-add]').first().getAttribute('data-add')
  await enter(page, `[data-add="${id}"]`)

  // Act
  await enter(page, `[data-flip="${id}"]`)

  // Assert
  await expect(page.locator(`[data-flip="${id}"]`)).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => focused(page)).toBe(JSON.stringify({ flip: id }))

  // Act
  await page.keyboard.press('Enter')

  // Assert
  await expect(page.locator(`[data-flip="${id}"]`)).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => focused(page)).toBe(JSON.stringify({ flip: id }))
})

test('Show more focuses the first deck it adds', async ({ page, open }) => {
  // Arrange
  await open()
  const toggles = page.locator('#results [data-toggle]')
  const before = await toggles.count()

  // Act
  await enter(page, '[data-more]')

  // Assert
  await expect.poll(() => toggles.nth(before).evaluate((el) => el === document.activeElement)).toBe(true)
})

test('Show it lists This deck first and focuses the results heading', async ({ page, open }) => {
  // Arrange
  await open(`#d=${over.list}`)
  await page.locator(`[data-near="${over.deck.id}"]`).click()

  // Act
  await enter(page, '[data-show-near]')

  // Assert
  await expect.poll(() => focused(page)).toBe('#result-head')
  await expect(page.locator('#results [data-toggle]').first()).toHaveAttribute('data-toggle', over.deck.id)
})

for (const [label, selector] of [
  ['Expand all', '#expand-all'],
  ['Dim common', '#dim-common'],
  ['Least common', '[data-freq="least"]'],
  ['Any', '[data-match="any"]'],
  ['Has video', '[data-video]'],
] as const) {
  test(`${label} keeps focus on itself`, async ({ page, open }) => {
    // Arrange: two decks, so Dim common is enabled
    await open(`#f=${over.faction}&l=${over.leader}`)

    // Act
    await enter(page, selector)

    // Assert
    await expect.poll(() => hasFocus(page, selector)).toBe(true)
  })
}

test('Clear all keeps focus on itself', async ({ page, open }) => {
  // Arrange
  await open(`#f=${over.faction}`)

  // Act
  await enter(page, '#clear')

  // Assert
  await expect(page).not.toHaveURL(/#f=/)
  await expect.poll(() => focused(page)).toBe('#clear')
})

test('adding the last card in the panel focuses the Most/Least toggle', async ({ page, open }) => {
  // Arrange: one deck, so every card added keeps it and the panel shrinks to nothing
  await open(`#d=${over.list}`)
  const bars = page.locator('#bars [data-add]')

  // Act
  while ((await bars.count()) > 0) await enter(page, '#bars [data-add] >> nth=-1')

  // Assert
  await expect(page.locator('#bars .none')).toBeVisible()
  await expect.poll(() => hasFocus(page, '[data-freq][aria-pressed="true"]')).toBe(true)
})
