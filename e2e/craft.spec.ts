import { craftList, indexDecks, matchDecks } from '../src/filter.ts'
import { data, expect, test } from './app.ts'

const decks = indexDecks(data)
const all = craftList(matchDecks(decks, { factions: [], picks: [] }), [], data.cards)
const [top, second] = all
const name = (id: number) => data.cards[id].name
const cost = (r: (typeof all)[number]) => data.cards[r.id].scraps * r.copies

test('Craft lists the most-run cards first, with their share of the matching decks', async ({ page, open }) => {
  // Arrange
  await open()

  // Act
  await page.locator('[data-tab="craft"]').click()

  // Assert
  await expect(page).toHaveURL(/#t=craft$/)
  await expect(page.locator('[data-tab="craft"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#results')).toBeHidden()
  await expect(page.locator('#panel')).toBeHidden()
  const first = page.locator('#craft-body tr').first()
  await expect(first.locator('[data-craft-pick]')).toHaveText(name(top.id))
  await expect(first.locator('.share')).toHaveText(
    `${Math.round((top.decks / decks.length) * 100)}%${top.decks.toLocaleString('en')}`,
  )
  await expect(page.locator('#craft-intro')).toContainText('Neutral cards fit every faction')

  // Act: a faction's own list, where the note would be wrong
  await page.locator('[data-faction="MO"]').click()

  // Assert
  await expect(page.locator('#craft-intro')).not.toContainText('Neutral cards')
})

test('the scraps line falls where the running total passes them, and Have it moves it down', async ({ page, open }) => {
  // Arrange: enough for the first card, not the second
  await open('#t=craft')
  const scraps = cost(top) + cost(second) - 1
  const line = page.locator('#craft-body .reach')

  // Act
  await page.locator('#scraps').fill(String(scraps))

  // Assert
  await expect(line).toHaveCount(1)
  await expect(page.locator('#craft-body tr').nth(1)).toHaveClass('reach')
  await expect(page.locator('#craft-summary')).toContainText('first card')

  // Act: tick the first card, so the scraps go to the second
  await page.getByRole('checkbox', { name: `I have ${name(top.id)}` }).check()

  // Assert
  await expect(page.getByRole('checkbox', { name: `I have ${name(top.id)}` })).toBeFocused()
  await expect(page.locator('#craft-body tr').first().locator('.total')).toHaveText('—')
  await expect(page.locator('#craft-body tr').nth(1)).not.toHaveClass('reach')
})

test('a card name lists its decks; Back returns to Craft', async ({ page, open }) => {
  // Arrange
  await open('#t=craft')

  // Act
  await page.locator(`[data-craft-pick="${top.id}"]`).click()

  // Assert
  await expect(page).toHaveURL(new RegExp(`#c=${top.id}$`))
  await expect(page.locator('#results')).toBeVisible()
  await expect(page.locator('#result-head')).toBeFocused()

  // Act
  await page.goBack()

  // Assert
  await expect(page.locator('#craft')).toBeVisible()
})

test('a reload keeps Craft but forgets the scraps and ticks', async ({ page, open }) => {
  // Arrange
  await open('#t=craft')
  await page.locator('#scraps').fill('5000')
  await page.locator(`[data-have="${top.id}"]`).check()

  // Act
  await page.reload()

  // Assert
  await expect(page.locator('#craft')).toBeVisible()
  await expect(page.locator('#scraps')).toHaveValue('')
  await expect(page.locator(`[data-have="${top.id}"]`)).not.toBeChecked()
})

test('Craft works by keyboard: the tab switch, the scraps box and Have it', async ({ page, open }) => {
  // Arrange
  await open()
  await page.locator('[data-tab="craft"]').focus()

  // Act
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-tab="craft"]')).toBeFocused()
  await page.locator('#scraps').focus()
  await page.keyboard.type('900')
  await page.locator(`[data-have="${top.id}"]`).focus()
  await page.keyboard.press('Space')

  // Assert
  await expect(page.locator('#craft')).toBeVisible()
  await expect(page.locator(`[data-have="${top.id}"]`)).toBeChecked()
  await expect(page.locator(`[data-have="${top.id}"]`)).toBeFocused()
})

test('the Craft list fits a 360px phone', async ({ page, open }) => {
  // Arrange
  await page.setViewportSize({ width: 360, height: 800 })

  // Act
  await open('#t=craft')
  await expect(page.locator('[data-craft-pick]').first()).toBeVisible()

  // Assert
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})

test("Clear all in Craft keeps Craft, listing every deck's cards", async ({ page, open }) => {
  // Arrange
  await open('#t=craft&f=MO')

  // Act
  await page.locator('#clear').click()

  // Assert
  await expect(page).toHaveURL(/#t=craft$/)
  await expect(page.locator('[data-craft-pick]').first()).toHaveText(name(top.id))
})

test('a faction card clicked in Craft turns its faction on, as adding it from Search does', async ({ page, open }) => {
  // Arrange: the most-run card that belongs to one faction (Lord Riptide, for Monsters, today)
  const row = all.find((r) => data.cards[r.id].faction !== 'NE' && !data.cards[r.id].secondaryFaction)
  if (!row) throw new Error('no faction card in the Craft list')
  const faction = data.cards[row.id].faction
  await open('#t=craft')

  // Act
  await page.locator(`[data-craft-pick="${row.id}"]`).click()

  // Assert
  await expect(page).toHaveURL(new RegExp(`f=${faction}`))
  await expect(page.locator(`[data-faction="${faction}"]`)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#leader [data-leader]').first()).toBeVisible()

  // Act: removing the card turns the faction it chose back off
  await page.locator(`#chips [data-remove="${row.id}"]`).click()

  // Assert
  await expect(page.locator(`[data-faction="${faction}"]`)).toHaveAttribute('aria-pressed', 'false')
})
