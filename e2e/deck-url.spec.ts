import { indexDecks } from '../src/filter.ts'
import { data, expect, expectedCount, test } from './app.ts'

const decks = indexDecks(data)
const guide = decks.find((e) => e.deck.url.includes('/guides/'))
if (!guide) throw new Error('no guide decks')
const url = guide.deck.url.replace('playgwent.com/', 'playgwent.com/en/')
const twins = expectedCount({ deck: guide.list })

test('Enter on a typed deck URL lists that deck', async ({ page, open }) => {
  // Arrange
  await open()
  const input = page.locator('#card-input')

  // Act
  await input.fill(url)
  await expect(page.locator('#suggestions [data-deck]')).toHaveText(new RegExp(`${twins}$`))
  await input.press('Enter')

  // Assert
  await expect(page).toHaveURL(new RegExp(`#d=${guide.list}$`))
  await expect(page.locator('#result-head')).toHaveText(new RegExp(`^${twins} `))
  await expect(page.locator('#chips li')).toHaveCount(1)
  await expect(page.locator('#deck-note')).toBeHidden()
  await expect(input).toHaveValue('')
})

test('pasting a URL replaces the search, and Back restores it', async ({ page, open }) => {
  // Arrange
  const before = '#f=MO&c=c12'
  await open(before)
  const input = page.locator('#card-input')

  // Act: the input event a paste fires (the clipboard itself needs browser-specific permissions)
  await input.evaluate((el: HTMLInputElement, text) => {
    el.value = text
    el.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', data: text }))
  }, url)

  // Assert
  await expect(page).toHaveURL(new RegExp(`#d=${guide.list}$`))
  await expect(page.locator('#deck-note')).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`${before}$`))
  await expect(page.locator('#chips li')).toHaveText(['#Beast✕'])
})

test('adding a pick drops the deck filter, and Backspace removes the deck chip', async ({ page, open }) => {
  // Arrange
  await open(`#d=${guide.list}`)
  const input = page.locator('#card-input')

  // Act
  await input.press('Backspace')

  // Assert
  await expect(page.locator('#chips li')).toHaveCount(0)
  await expect(page.locator('#result-head')).toHaveText(new RegExp(`^${data.decks.length} `))

  // Act: back to the deck, then add a tag
  await page.goto(page.url().replace(/#.*$/, `#d=${guide.list}`))
  await input.fill('Beasts')
  await input.press('Enter')

  // Assert
  await expect(page).toHaveURL(/#c=c12$/)
})

test('a pasted unknown deck URL stays selected, so the next paste replaces it', async ({ page, open }) => {
  // Arrange
  await open()
  const input = page.locator('#card-input')
  const unknown = 'https://www.playgwent.com/en/decks/948d24acf05cd92e7a71495355aefbd9'

  // Act
  await input.evaluate((el: HTMLInputElement, text) => {
    el.focus()
    el.value = text
    el.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', data: text }))
  }, unknown)

  // Assert
  await expect(page.locator('#suggestions .none')).toBeVisible()
  expect(await input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([
    0,
    unknown.length,
  ])
  await input.pressSequentially('Tyr')
  await expect(input).toHaveValue('Tyr')
})

test('an unknown deck URL says so and changes nothing; partial URLs suggest nothing', async ({ page, open }) => {
  // Arrange
  await open('#f=MO')
  const input = page.locator('#card-input')

  // Act
  await input.fill('https://www.playgwent.com/decks/guides/1')
  await input.press('Enter')

  // Assert
  await expect(page.locator('#suggestions .none')).toBeVisible()
  await expect(page).toHaveURL(/#f=MO$/)

  // Act
  await input.fill('http')

  // Assert
  await expect(page.locator('#suggestions')).toBeHidden()
})

test('?deck= opens a deck from its full URL, then shows the short link', async ({ page, open }) => {
  // Act
  await open(`?lang=de&deck=${encodeURIComponent(url)}`)

  // Assert: the deck is shown, the language stays, and deck= is gone
  await expect(page).toHaveURL(new RegExp(`\\?lang=de#d=${guide.list}$`))
  await expect(page.locator('#result-head')).toHaveText(/^1 /)
})

test('?deck= also takes the URL unencoded', async ({ page, open }) => {
  // Act
  await open(`?deck=${guide.deck.url}`)

  // Assert
  await expect(page).toHaveURL(new RegExp(`#d=${guide.list}$`))
})

test('?deck= with a deck not in the list puts it in Search, selected, which says so', async ({ page, open }) => {
  // Arrange
  const unknown = 'https://www.playgwent.com/en/decks/948d24acf05cd92e7a71495355aefbd9'

  // Act
  await open(`?deck=${encodeURIComponent(unknown)}`)

  // Assert
  await expect(page.locator('#card-input')).toHaveValue(unknown)
  expect(await page.locator('#card-input').evaluate((el: HTMLInputElement) => el.selectionEnd)).toBe(unknown.length)
  await expect(page.locator('#suggestions .none')).toBeVisible()
  await expect(page).not.toHaveURL(/deck=/)
  await page.locator('#card-input').pressSequentially('Tyr')
  await expect(page.locator('#card-input')).toHaveValue('Tyr')
})

test('Clear all empties the Search box of a pasted deck link that was not found (#12)', async ({ page, open }) => {
  // Arrange: the issue's steps, a pasted unknown link left selected in the box
  await open()
  const input = page.locator('#card-input')
  const unknown = 'https://www.playgwent.com/en/decks/11e5b6353f6fbe7ac15984c0192f1dc8'
  await input.evaluate((el: HTMLInputElement, text) => {
    el.focus()
    el.value = text
    el.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', data: text }))
  }, unknown)
  await expect(page.locator('#suggestions .none')).toBeVisible()

  // Act
  await page.locator('#clear').click()

  // Assert
  await expect(input).toHaveValue('')
  await expect(page.locator('#suggestions')).toBeHidden()
  await expect(input).not.toHaveAttribute('aria-activedescendant')
})

test('Shift+Backspace empties half-typed text in the Search box too', async ({ page, open }) => {
  // Arrange: typed, then focus moved to a filter, where the shortcut works
  await open('#f=MO')
  const input = page.locator('#card-input')
  await input.fill('Tyr')
  await page.locator('[data-faction="NG"]').focus()

  // Act
  await page.keyboard.press('Shift+Backspace')

  // Assert
  await expect(page).not.toHaveURL(/#f=/)
  await expect(input).toHaveValue('')
})
