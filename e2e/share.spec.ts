import { CONFIG } from '../src/config.ts'
import { expect, test } from './app.ts'

test('Copy link copies the live site with this search (the page runs from a file here) and says so', async ({
  page,
  context,
  open,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Playwright grants clipboard permissions in Chromium only')
  // Arrange
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open('?lang=ru#f=MO')

  // Act
  await page.locator('#copy-link').click()

  // Assert
  await expect(page.locator('#copy-status')).toHaveText('Ссылка скопирована')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${CONFIG.siteUrl}?lang=ru#f=MO`)
  await expect(page.locator('#copy-link')).toBeFocused()
})

test('when the browser refuses to copy, the link is shown selected, and goes once the search changes', async ({
  page,
  open,
}) => {
  // Arrange
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) } })
  })
  await open('#f=MO')

  // Act
  await page.locator('#copy-link').click()

  // Assert
  const field = page.locator('#share-url')
  await expect(field).toBeFocused()
  await expect(field).toHaveValue(`${CONFIG.siteUrl}#f=MO`)
  expect(await field.evaluate((i: HTMLInputElement) => (i.selectionEnd ?? 0) - (i.selectionStart ?? 0))).toBe(
    `${CONFIG.siteUrl}#f=MO`.length,
  )
  await page.locator('[data-faction="NG"]').click()
  await expect(field).toBeHidden()
})
