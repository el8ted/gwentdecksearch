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
  await expect(page.locator('#chips li')).toHaveText(['#Beast'])
  await expect(page).toHaveURL(/#c=c12$/)
  await expect(page.locator('#result-head')).toHaveText(new RegExp(`^${expectedCount({ picks: ['c12'] })} `))
  await input.press('Backspace')
  await expect(page.locator('#chips li')).toHaveCount(0)
})

test('only tags the remaining decks have are suggested', async ({ page, open }) => {
  // Arrange: a tag some deck has, but no Northern Realms deck
  const nr = facets(indexDecks(data), { factions: ['NR'], picks: [] }).tags
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
  await open('?lang=de#c=c12')

  // Assert
  await expect(page.locator('#chips li')).toHaveText(['#Bestie'])
})

test('chips keep pick order, and Backspace removes the latest pick, card or tag', async ({ page, open }) => {
  // Arrange: a tag, then a card that doesn't carry it (so its chip can't be mistaken for the tag's)
  const [id] = Object.keys(data.cards)
    .map(Number)
    .filter(
      (c) => data.cards[c].type === 'unit' && data.cards[c].faction === 'NE' && !data.cards[c].tags?.includes('c12'),
    )
  await open()
  const input = page.locator('#card-input')
  await input.fill('Beast')
  await page.locator('[data-tag="c12"]').click()

  // Act
  await input.fill(data.cards[id].name)
  await page.locator(`#sug-${id}`).click()

  // Assert
  await expect(page).toHaveURL(new RegExp(`#c=c12%2C${id}$`))
  await expect(page.locator('#chips li').first()).toContainText('Beast')
  await expect(page.locator('#chips li').last()).toContainText(data.cards[id].name)
  await input.press('Backspace')
  await expect(page.locator('#chips li')).toHaveText(['#Beast'])
})

test('an author is suggested by name, spacing and case ignored, and lists their guides and lists', async ({
  page,
  open,
}) => {
  // Arrange
  await open()
  const input = page.locator('#card-input')

  // Act
  await input.fill('metallic d')
  await page.locator('[data-tag="@metallicdanny"]').click()

  // Assert
  await expect(page.locator('#chips li')).toHaveText(['MetallicDanny'])
  await expect(page).toHaveURL(/#c=%40metallicdanny$/)
  await expect(page.locator('#result-head')).toHaveText(new RegExp(`^${expectedCount({ picks: ['@metallicdanny'] })} `))
})
