import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { commonNeutralCards, expect, pack, test } from './app.ts'

const de = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'i18n', 'de.json'), 'utf8'))

test('?lang=de shows German text and German card names', async ({ page, open }) => {
  // Arrange
  const [id] = commonNeutralCards(1)
  const dePack = pack('de')

  // Act
  await open(`?lang=de#c=${id}`)

  // Assert
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.locator('#clear')).toHaveText(dePack.terms.clearAll ?? de.clearAll)
  await expect(page.locator('#chips li')).toContainText(dePack.cards[id])
})

test('the language menu sets ?lang= and the choice survives a reload', async ({ page, open }) => {
  // Arrange
  await open('#f=SK')

  // Act
  await page.locator('#langmenu summary').click()
  await page.locator('[data-lang="fr"]').click()

  // Assert
  await expect(page).toHaveURL(/\?lang=fr#f=SK$/)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.locator('[data-faction="SK"]')).toHaveAttribute('aria-pressed', 'true')
})

test("Help's full-guide link opens the README in the page's language", async ({ page, open }) => {
  // Arrange
  await open('?lang=ru')
  const link = page.locator('#help-readme')

  // Act
  await page.locator('#shortcuts-open').click()

  // Assert
  await expect(link).toHaveAttribute('href', /docs\/README\.ru\.md$/)
  await page.locator('[data-lang="en"]').evaluate((b: HTMLElement) => b.click())
  await expect(link).toHaveAttribute('href', /docs\/guide\.md$/)
})

test('Credits shows the version, linked to its release notes', async ({ page, open }) => {
  // Arrange
  await open('?lang=de')

  // Act
  await page.locator('#credits-open').click()

  // Assert: a local build is "dev" and links to every release
  await expect(page.locator('#version')).toHaveText('Version dev')
  await expect(page.locator('#version')).toHaveAttribute('href', /\/releases$/)
})

test("the Fan Content Guidelines link opens CD PROJEKT RED's page in the page's language", async ({ page, open }) => {
  // Arrange
  await open('?lang=pt-BR')
  const link = page.locator('#fan-content')

  // Act
  await page.locator('#credits-open').click()

  // Assert
  await expect(link).toHaveAttribute('href', 'https://www.cdprojektred.com/pt-br/fan-content')
  await page.locator('[data-lang="en"]').evaluate((b: HTMLElement) => b.click())
  await expect(link).toHaveAttribute('href', 'https://www.cdprojektred.com/en/fan-content')
})
