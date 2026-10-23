import { expect, test } from './app.ts'

// A match on a phone: faction, then leader, then (maybe) stratagem, then cards; each answered step folds away.
test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('opens on the faction, with the refining rows folded behind one button', async ({ page, open }) => {
    // Act
    await open('#b=exact')

    // Assert
    await expect(page.locator('#factions')).toBeVisible()
    await expect(page.locator('#sources')).toBeHidden()
    await expect(page.locator('#filters-toggle')).toHaveText(/Filters · Exact/)
    await expect(page.locator('#stratagem')).toBeHidden()
    await expect(page.locator('#opponent-toggle')).toBeHidden()
    await expect(page.locator('#card-input')).toBeInViewport()
  })

  test('picking a leader folds faction and leader into one line and moves to the stratagems', async ({
    page,
    open,
  }) => {
    // Arrange
    await open()
    await page.locator('[data-faction="MO"]').click()

    // Act
    await page.locator('#leader [data-leader]').first().click()

    // Assert
    const line = page.locator('#opponent-toggle')
    await expect(line).toBeVisible()
    await expect(line).toHaveText(/MO · /)
    await expect(line).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('#factions')).toBeHidden()
    await expect(page.locator('#stratagem')).toBeVisible()
    // Only the stratagems this faction's decks run.
    await expect(page.locator('#stratagem .pill.empty:visible')).toHaveCount(0)
    await expect(page.locator('#stratagem [data-stratagem]').first()).toBeFocused()
  })

  test('adding a card folds the stratagem row; the line unfolds everything again', async ({ page, open }) => {
    // Arrange
    await open('#f=MO')
    await page.locator('#leader [data-leader]').first().click()

    // Act
    await page.locator('#card-input').fill('Griffin')
    await page.keyboard.press('Enter')

    // Assert
    await expect(page.locator('#stratagem')).toBeHidden()
    const line = page.locator('#opponent-toggle')
    await line.click()
    await expect(line).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#factions')).toBeVisible()
    await expect(page.locator('#stratagem')).toBeVisible()
    await expect(line).toBeFocused()
  })

  test('the search box takes its own full-width line', async ({ page, open }) => {
    // Act
    await open('#c=112405')

    // Assert
    const box = await page.locator('.chips-box').boundingBox()
    expect(box?.width).toBeGreaterThan(330)
  })

  test('the card list folds away to reach the decks, and starts open', async ({ page, open }) => {
    // Arrange
    await open()
    const toggle = page.locator('#panel-toggle')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#bars')).toBeVisible()

    // Act
    await toggle.click()

    // Assert
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('#bars')).toBeHidden()
    await expect(toggle).toBeFocused()
  })

  test('the header fits: the language as its code, and Credits reached from Help', async ({ page, open }) => {
    // Arrange
    await open('?lang=ru')

    // Assert
    await expect(page.locator('#lang-code')).toHaveText('RU')
    await expect(page.locator('#lang-current')).toBeHidden()
    await expect(page.locator('#credits-open')).toBeHidden()
    const tops = await page
      .locator('.lang-summary, #shortcuts-open, #display > summary')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(tops).size).toBe(1)

    // Act
    await page.locator('#shortcuts-open').click()
    await page.locator('#help-credits').click()

    // Assert
    await expect(page.locator('#shortcuts')).toBeHidden()
    await expect(page.locator('#credits')).toBeVisible()
  })

  test('[ unfolds a folded faction and leader and lands on the faction', async ({ page, open }) => {
    // Arrange
    await open('#f=MO')
    await page.locator('#leader [data-leader]').first().click()
    await page.locator('#card-input').focus()
    await page.locator('#card-input').blur()

    // Act
    await page.keyboard.press('[')

    // Assert
    await expect(page.locator('#opponent-toggle')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('[data-faction="MO"]')).toBeFocused()
  })
})

test('on a wide screen nothing folds: no fold buttons, every row shows', async ({ page, open }) => {
  // Act
  await open('#f=MO')
  await page.locator('#leader [data-leader]').first().click()

  // Assert
  for (const id of ['#filters-toggle', '#opponent-toggle', '#panel-toggle']) await expect(page.locator(id)).toBeHidden()
  for (const id of ['#factions', '#leader', '#stratagem', '#sources', '#bars'])
    await expect(page.locator(id)).toBeVisible()
})
