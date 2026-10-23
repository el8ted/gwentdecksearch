import { expect, test } from './app.ts'

test('theme and text size survive a reload', async ({ page, open }) => {
  // Arrange
  await open()
  const html = page.locator('html')

  // Act
  await page.locator('#display summary').click()
  await page.locator('[data-pref="theme"][data-value="dark"]').click()
  await page.locator('#text-up').click()
  await page.reload()

  // Assert
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await expect(html).toHaveAttribute('style', /font-size:\s*112\.5%/)
  await expect(page.locator('#text-size')).toHaveText('112.5%')
})

for (const id of ['langmenu', 'display']) {
  test(`on a phone, the #${id} menu opens inside the screen`, async ({ page, open }) => {
    // Arrange
    await page.setViewportSize({ width: 412, height: 915 })
    await open()

    // Act
    await page.locator(`#${id} summary`).click()

    // Assert
    const box = await page.locator(`#${id} > :not(summary)`).boundingBox()
    expect(box?.x).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(412)
  })
}

test('on a phone, a deck name with no spaces wraps instead of widening the page', async ({ page, open }) => {
  // Arrange: the real case was "Shieldwall2111…"; any name could do it, so one is planted
  await page.setViewportSize({ width: 412, height: 915 })
  await open()
  const widths = () => page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])

  // Act
  await page
    .locator('#results .deck-name')
    .first()
    .evaluate((el) => {
      el.textContent = `Shieldwall${'1'.repeat(80)}`
    })

  // Assert
  const [scroll, viewport] = await widths()
  expect(scroll).toBeLessThanOrEqual(viewport)
  expect(await page.locator('#bars').evaluate((b) => getComputedStyle(b).gridTemplateColumns.split(' ').length)).toBe(1)
})

test('at 320px wide and the largest text size, nothing makes the page scroll sideways', async ({ page, open }) => {
  // Arrange: 320 CSS px is the narrow width WCAG's reflow rule (1.4.10) asks for
  await page.setViewportSize({ width: 320, height: 800 })
  await page.addInitScript(() => localStorage.setItem('gwent-deck-search:display', JSON.stringify({ text: 4 })))

  // Act
  await open('#f=MO')

  // Assert
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})
