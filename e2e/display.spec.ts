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
