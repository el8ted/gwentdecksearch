import type { Page } from '@playwright/test'
import { commonNeutralCards, data, expect, expectedCount, test } from './app.ts'

test('autocomplete adds a card by keyboard, and Backspace removes it', async ({ page, open }) => {
  // Arrange
  await open()
  const [id] = commonNeutralCards(1)
  const input = page.locator('#card-input')

  // Act
  await input.fill(data.cards[id].name)
  await expect(page.locator('#suggestions')).toBeVisible()
  await input.press('Enter')

  // Assert
  await expect(page.locator('#chips li')).toHaveCount(1)
  await expect(page.locator('#chips li')).toContainText(data.cards[id].name)
  await expect(page).toHaveURL(new RegExp(`#c=${id}$`))
  await expect(page.locator('#result-head')).toHaveText(new RegExp(`^${expectedCount({ picks: [id] })} `))
  await input.press('Backspace')
  await expect(page.locator('#chips li')).toHaveCount(0)
})

test('match any lists at least as many decks as match all', async ({ page, open }) => {
  // Arrange
  const cards = commonNeutralCards(2)
  await open(`#c=${cards.join(',')}`)
  const head = page.locator('#result-head')
  await expect(head).toHaveText(new RegExp(`^${expectedCount({ picks: cards })} `))

  // Act
  await page.locator('[data-match="any"]').click()

  // Assert
  const any = expectedCount({ picks: cards, match: 'any' })
  expect(any).toBeGreaterThanOrEqual(expectedCount({ picks: cards }))
  await expect(head).toHaveText(new RegExp(`^${any} `))
})

test.describe('a faction card selects its faction', () => {
  // The single-faction Monsters card in the most decks, so it's among the suggestions for its full name.
  const counts = new Map<number, number>()
  for (const d of data.decks) for (const [id] of d.cards) counts.set(id, (counts.get(id) ?? 0) + 1)
  const [id] = [...counts]
    .filter(([c]) => {
      const card = data.cards[c]
      return card.faction === 'MO' && !card.secondaryFaction && card.type !== 'leader' && card.type !== 'stratagem'
    })
    .sort((a, b) => b[1] - a[1])[0]
  const pill = (page: Page) => page.locator('[data-faction="MO"]')
  const add = async (page: Page) => {
    await page.locator('#card-input').fill(data.cards[id].name)
    await page.locator(`#sug-${id}`).click()
  }

  test('and removing the card clears it again', async ({ page, open }) => {
    // Arrange
    await open()

    // Act
    await add(page)

    // Assert
    await expect(pill(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/f=MO/)
    await page.locator('#card-input').press('Backspace')
    await expect(pill(page)).toHaveAttribute('aria-pressed', 'false')
    await expect(page).not.toHaveURL(/f=MO/)
  })

  test('a faction picked first stays when the card is removed', async ({ page, open }) => {
    // Arrange
    await open()
    await pill(page).click()

    // Act
    await add(page)
    await page.locator('#card-input').press('Backspace')

    // Assert
    await expect(pill(page)).toHaveAttribute('aria-pressed', 'true')
  })

  test('a pill clicked after the card stays when the card is removed', async ({ page, open }) => {
    // Arrange
    await open()
    await add(page)
    await pill(page).click()
    await pill(page).click()

    // Act
    await page.locator(`[data-remove="${id}"]`).click()

    // Assert
    await expect(pill(page)).toHaveAttribute('aria-pressed', 'true')
  })
})

test('on a phone, the search suggestions stay above the card frequency list', async ({ page, open }) => {
  // Arrange
  await page.setViewportSize({ width: 360, height: 900 })
  await open()
  const input = page.locator('#card-input')
  await input.scrollIntoViewIfNeeded()

  // Act
  await input.fill('gol')
  await expect(page.locator('#suggestions')).toBeVisible()

  // Assert: the lowest suggestion is what a tap there would hit
  const onTop = await page
    .locator('#suggestions [role="option"]')
    .last()
    .evaluate((el) => {
      const r = el.getBoundingClientRect()
      return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))
    })
  expect(onTop).toBe(true)
})

test('plain typing finds accented names: "coen" finds Coën', async ({ page, open }) => {
  // Arrange
  const id = Number(Object.keys(data.cards).find((k) => data.cards[Number(k)].name === 'Coën'))
  await open()

  // Act
  await page.locator('#card-input').fill('coen')

  // Assert
  await expect(page.locator(`#sug-${id}`)).toBeVisible()
})
