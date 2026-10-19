import { data, expect, expectedCount, test } from './app.ts'

// The issue's example: Skellige Warrior decks, with and without Tyr.
const TYR = 203194
const tyr = data.cards[TYR].name
const warriors = { factions: ['SK' as const], picks: ['c86', TYR] }

test('clicking a pill excludes it, and clicking again wants it back', async ({ page, open }) => {
  // Arrange
  await open('#f=SK&c=c86,203194')
  const pill = page.locator(`[data-flip="${TYR}"]`)

  // Act
  await pill.click()

  // Assert
  await expect(page).toHaveURL(/#f=SK&c=c86%2C-203194$/)
  await expect(pill).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#result-head')).toHaveText(
    new RegExp(`^${expectedCount({ ...warriors, excludes: [TYR] })} `),
  )

  // Act
  await page.locator(`[data-flip="${TYR}"]`).click()

  // Assert
  await expect(page).toHaveURL(/#f=SK&c=c86%2C203194$/)
  await expect(page.locator('#result-head')).toHaveText(new RegExp(`^${expectedCount(warriors)} `))
})

test('typing - or ！ before a name suggests excluding it, with the decks that would remain', async ({ page, open }) => {
  // Arrange
  await open('#f=SK&c=c86')
  const input = page.locator('#card-input')
  const left = expectedCount({ factions: ['SK'], picks: ['c86', TYR], excludes: [TYR] })

  for (const mark of ['-', '！']) {
    // Act
    await input.fill(`${mark}${tyr}`)

    // Assert
    const row = page.locator(`#suggestions [data-id="${TYR}"]`)
    await expect(row.locator('.sug-without')).toHaveText('Without')
    await expect(row.locator('.count')).toHaveText(String(left))
  }

  // Act
  await input.press('Enter')

  // Assert
  await expect(page).toHaveURL(/#f=SK&c=c86%2C-203194$/)
  await expect(page.locator('#chips li.excluded')).toHaveCount(1)
})

test('only exclusions list every deck without them, and Backspace removes the last one', async ({ page, open }) => {
  // Arrange
  await open('#c=-203194')

  // Assert
  await expect(page.locator('#result-head')).toHaveText(
    new RegExp(`^${expectedCount({ picks: [TYR], excludes: [TYR] })} `),
  )

  // Act
  await page.locator('#card-input').press('Backspace')

  // Assert
  await expect(page.locator('#chips li')).toHaveCount(0)
  await expect(page.locator('#result-head')).toHaveText(new RegExp(`^${data.decks.length} `))
})
