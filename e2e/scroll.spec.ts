import { expect, test } from './app.ts'

// Desktop: the filters stay pinned at the top, so what's under them must not hide behind them as the decks scroll.
test.describe('scrolling into the decks on a wide screen', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  const box = (page: import('@playwright/test').Page, selector: string) =>
    page.locator(selector).evaluate((e) => e.getBoundingClientRect().toJSON())

  test('the filters shrink to their lines and Search, and the bar and card panel stay in view below them', async ({
    page,
    open,
  }) => {
    // Arrange
    await open('#f=MO&b=exact')
    const tall = (await box(page, '#filters')).height

    // Act
    await page.evaluate(() => scrollTo(0, 2500))

    // Assert
    await expect(page.locator('#filters')).toHaveClass(/pinned-compact/)
    await expect(page.locator('#opponent-toggle')).toHaveText(/MO/)
    await expect(page.locator('#filters-toggle')).toHaveText(/Exact/)
    await expect(page.locator('#card-input')).toBeInViewport()
    const filters = await box(page, '#filters')
    expect(filters.height).toBeLessThan(tall / 2)
    expect((await box(page, '.result-bar')).top).toBeGreaterThanOrEqual(filters.bottom - 1)
    const panel = await box(page, '#panel')
    expect(panel.top).toBeGreaterThanOrEqual(filters.bottom)
    expect(panel.bottom).toBeLessThanOrEqual(900)
    await expect(page.locator('[data-freq="most"]')).toBeInViewport()
  })

  test('a line unfolds the rows over the decks without moving them; a scroll, a tap, Esc or the top folds them', async ({
    page,
    open,
  }) => {
    // Arrange
    await open('#f=MO')
    await page.evaluate(() => scrollTo(0, 2500))
    await expect(page.locator('#filters')).toHaveClass(/pinned-compact/)
    // A real tap: Playwright's click scrolls its target into view first, which the pinned filters don't need
    const tap = async (selector: string) => {
      const { x, y, width, height } = await box(page, selector)
      await page.mouse.click(x + width / 2, y + height / 2)
    }
    const y = await page.evaluate(() => scrollY)
    const bar = await box(page, '.result-bar')

    // Act
    await tap('#opponent-toggle')

    // Assert: unfolded over the bar, which stays where it was, and so does the page
    await expect(page.locator('#filters')).toHaveClass(/pinned-overlay/)
    await expect(page.locator('[data-faction="MO"]')).toBeFocused()
    // Within a pixel: fractional heights round differently once unfolded
    expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThanOrEqual(1)
    expect(Math.abs((await box(page, '.result-bar')).top - bar.top)).toBeLessThanOrEqual(1)
    expect((await box(page, '#filters')).bottom).toBeGreaterThan(bar.bottom)

    // A small settle doesn't fold them; a deliberate scroll does
    await page.mouse.move(640, 800)
    await page.mouse.wheel(0, 10)
    await expect(page.locator('#filters')).toHaveClass(/pinned-overlay/)
    await page.mouse.wheel(0, 200)
    await expect(page.locator('#filters')).toHaveClass(/pinned-compact/)
    await expect(page.locator('#opponent-toggle')).toBeFocused()

    // A tap on the page beside the decks folds them
    await tap('#opponent-toggle')
    await expect(page.locator('#filters')).toHaveClass(/pinned-overlay/)
    await page.mouse.click(4, 850)
    await expect(page.locator('#filters')).toHaveClass(/pinned-compact/)

    // So does Esc
    await tap('#opponent-toggle')
    await page.keyboard.press('Escape')
    await expect(page.locator('#filters')).toHaveClass(/pinned-compact/)

    // Back at the top, nothing is shrunk
    await page.evaluate(() => scrollTo(0, 0))
    await expect(page.locator('#filters')).not.toHaveClass(/pinned-compact|pinned-overlay/)
    await expect(page.locator('#factions')).toBeVisible()
  })

  test('Clear all, deep in the decks, starts over from the top with every filter showing', async ({ page, open }) => {
    // Arrange
    await open('#f=MO')
    await page.evaluate(() => scrollTo(0, 2500))
    await expect(page.locator('#filters')).toHaveClass(/pinned-compact/)

    // Act
    await page.locator('#clear').evaluate((b: HTMLElement) => b.click())

    // Assert
    await expect(page.locator('#filters')).not.toHaveClass(/pinned-compact|pinned-overlay/)
    expect(await page.evaluate(() => scrollY)).toBe(0)
    await expect(page.locator('#factions')).toBeVisible()
  })
})
