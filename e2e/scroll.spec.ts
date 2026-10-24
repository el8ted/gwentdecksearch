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

  test('a line unfolds the rows in place, focus on the first of them; the top of the page restores them too', async ({
    page,
    open,
  }) => {
    // Arrange
    await open('#f=MO')
    await page.evaluate(() => scrollTo(0, 2500))
    await expect(page.locator('#filters')).toHaveClass(/pinned-compact/)

    // Act
    await page.locator('#opponent-toggle').evaluate((b: HTMLElement) => b.click())

    // Assert
    await expect(page.locator('#filters')).not.toHaveClass(/pinned-compact/)
    await expect(page.locator('[data-faction="MO"]')).toBeFocused()

    // Back at the top, nothing is shrunk
    await page.evaluate(() => scrollTo(0, 2500))
    await page.evaluate(() => scrollTo(0, 0))
    await expect(page.locator('#filters')).not.toHaveClass(/pinned-compact/)
    await expect(page.locator('#factions')).toBeVisible()
  })
})
