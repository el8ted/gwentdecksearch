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
