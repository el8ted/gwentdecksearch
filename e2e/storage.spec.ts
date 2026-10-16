import { expect, test } from './app.ts'

// Some browsers throw on any localStorage access (cookies blocked, sandboxed webviews).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    })
  })
})

test('the page works with storage blocked', async ({ page, open }) => {
  // Act
  await open()

  // Assert
  await expect(page.locator('#results > li.deck').first()).toBeVisible()
})

test('language and Display choices still apply for the visit', async ({ page, open }) => {
  // Arrange
  await open()

  // Act
  await page.locator('#langmenu summary').click()
  await page.locator('[data-lang="de"]').click()
  await page.locator('#display summary').click()
  await page.locator('[data-pref="theme"][data-value="dark"]').click()

  // Assert
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
