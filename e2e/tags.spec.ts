import { facets, indexDecks } from '../src/filter.ts'
import { data, expect, expectedCount, test } from './app.ts'

test('a plural finds the one tag, Enter adds it, and Backspace removes it', async ({ page, open }) => {
  // Arrange
  await open()
  const input = page.locator('#card-input')

  // Act
  await input.fill('Beasts')
  await expect(page.locator('#suggestions [role="option"]').first()).toHaveAttribute('data-tag', 'c12')
  await input.press('Enter')

  // Assert
  await expect(page.locator('#chips li')).toHaveText(['#Beast✕'])
  await expect(page).toHaveURL(/#t=c12$/)
  await expect(page.locator('#result-head')).toHaveText(new RegExp(`^${expectedCount({ tags: ['c12'] })} `))
  await input.press('Backspace')
  await expect(page.locator('#chips li')).toHaveCount(0)
})

test('only tags the remaining decks have are suggested', async ({ page, open }) => {
  // Arrange: a tag some deck has, but no Northern Realms deck
  const nr = facets(indexDecks(data), { factions: ['NR'], cards: [] }).tags
  const key = Object.keys(data.tags).find((k) => !nr.has(k))
  if (!key) throw new Error('every tag is in a Northern Realms deck')
  await open('#f=NR')

  // Act
  await page.locator('#card-input').fill(data.tags[key])

  // Assert
  await expect(page.locator('#suggestions')).toBeVisible()
  await expect(page.locator(`[data-tag="${key}"]`)).toHaveCount(0)
})

test('tags show in the page language', async ({ page, open }) => {
  // Arrange
  await open('?lang=de#t=c12')

  // Assert
  await expect(page.locator('#chips li')).toHaveText(['#Bestie✕'])
})
