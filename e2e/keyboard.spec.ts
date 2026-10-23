import { expect, test } from './app.ts'

const PANEL = '[data-freq="most"]'

test.describe('skip links', () => {
  test('the first Tab shows "Skip to search"', async ({ page, open }) => {
    // Arrange
    await open()

    // Act
    await page.keyboard.press('Tab')

    // Assert
    const skip = page.locator('.skip [data-skip="cards"]')
    await expect(skip).toBeFocused()
    expect((await skip.boundingBox())?.width).toBeGreaterThan(1)
  })

  for (const [name, target] of [
    ['cards', '#card-input'],
    ['results', '#result-head'],
    ['panel', PANEL],
  ] as const) {
    test(`"${name}" moves focus and leaves the filters alone`, async ({ page, open }) => {
      // Arrange
      await open('#f=MO')

      // Act
      await page.locator(`.skip [data-skip="${name}"]`).focus()
      await page.keyboard.press('Enter')

      // Assert
      await expect(page.locator(target)).toBeFocused()
      await expect(page).toHaveURL(/#f=MO$/)
    })
  }

  test('"Skip past results" jumps over every expanded deck in one step', async ({ page, open }) => {
    // Arrange
    await open('#f=MO')
    await page.locator('#expand-all').click()
    await page.locator('#expand-all').focus()

    // Act
    await page.keyboard.press('Tab')
    await expect(page.locator('.skip-past')).toBeFocused()
    await page.keyboard.press('Enter')

    // Assert
    await expect(page.locator(PANEL)).toBeFocused()
  })
})

test.describe('shortcuts', () => {
  for (const [key, target] of [
    ['/', '#card-input'],
    ['[', '[data-faction="MO"]'],
    [']', PANEL],
  ] as const) {
    test(`${key} focuses ${target}`, async ({ page, open }) => {
      // Arrange
      await open()

      // Act
      await page.keyboard.press(key)

      // Assert
      await expect(page.locator(target)).toBeFocused()
    })
  }

  test('Shift+Backspace clears all, and Back restores it', async ({ page, open }) => {
    // Arrange
    await open('#f=SK&b=over1')
    await page.locator('[data-faction="SK"]').focus()

    // Act
    await page.keyboard.press('Shift+Backspace')

    // Assert
    await expect(page).not.toHaveURL(/#/)
    await expect(page.locator('#card-input')).toBeFocused()
    await page.goBack()
    await expect(page).toHaveURL(/#f=SK&b=over1$/)
  })

  test('keys typed in the search box stay in the search box', async ({ page, open }) => {
    // Arrange
    await open()
    const input = page.locator('#card-input')
    await input.focus()

    // Act
    await page.keyboard.type('[]/')

    // Assert
    await expect(input).toBeFocused()
    await expect(input).toHaveValue('[]/')
  })

  test('Ctrl+[ is left to the browser', async ({ page, open }) => {
    // Arrange
    await open()

    // Act
    await page.keyboard.press('Control+BracketLeft')

    // Assert
    await expect(page.locator('body')).toBeFocused()
  })

  test('IME composition is ignored; a Russian layout uses the physical key', async ({ page, open }) => {
    // Arrange
    await open()
    const press = (init: { key: string; code: string; isComposing?: boolean }) =>
      page.evaluate((i) => document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...i })), init)

    // Act + Assert
    await press({ key: '[', code: 'BracketLeft', isComposing: true })
    await expect(page.locator('body')).toBeFocused()
    await press({ key: 'х', code: 'BracketLeft' })
    await expect(page.locator('[data-faction="MO"]')).toBeFocused()
  })

  test('shortcuts are off while a dialog is open', async ({ page, open }) => {
    // Arrange
    await open()
    await page.locator('#credits-open').click()

    // Act
    await page.keyboard.press('[')

    // Assert
    await expect(page.locator('#credits')).toBeVisible()
    await expect(page.locator('[data-faction="MO"]')).not.toBeFocused()
  })
})

test.describe('shortcuts help', () => {
  test('? opens the list, Esc closes it and focus returns', async ({ page, open }) => {
    // Arrange
    await open()
    await page.locator('[data-faction="NR"]').focus()

    // Act
    await page.keyboard.press('?')

    // Assert
    const help = page.locator('#shortcuts')
    await expect(help).toBeVisible()
    await expect(page.locator('#shortcuts-close')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(help).toBeHidden()
    await expect(page.locator('[data-faction="NR"]')).toBeFocused()
  })

  test('? closes the list again', async ({ page, open }) => {
    // Arrange
    await open()
    await page.keyboard.press('?')

    // Act
    await page.keyboard.press('?')

    // Assert
    await expect(page.locator('#shortcuts')).toBeHidden()
  })

  test('the header ? button opens it too', async ({ page, open }) => {
    // Arrange
    await open()

    // Act
    await page.locator('#shortcuts-open').click()

    // Assert
    await expect(page.locator('#shortcuts')).toBeVisible()
    await expect(page.locator('#shortcuts dt')).toHaveCount(10)
  })
})

test.describe('j and k', () => {
  const toggles = '#results [data-toggle]'

  test('j goes to the first deck, then down the list; k comes back up and stops at the first', async ({
    page,
    open,
  }) => {
    // Arrange
    await open()
    const rows = page.locator(toggles)

    // Act / Assert
    await page.keyboard.press('j')
    await expect(rows.nth(0)).toBeFocused()
    await page.keyboard.press('j')
    await page.keyboard.press('j')
    await expect(rows.nth(2)).toBeFocused()
    await page.keyboard.press('k')
    await expect(rows.nth(1)).toBeFocused()
    await page.keyboard.press('k')
    await page.keyboard.press('k')
    await expect(rows.nth(0)).toBeFocused()
  })

  test('from a button inside a deck, j goes to the next deck; a Russian layout uses the physical key', async ({
    page,
    open,
  }) => {
    // Arrange
    await open()
    await page.locator('#results [data-near]').nth(3).focus()

    // Act
    await page.evaluate(() =>
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'о', code: 'KeyJ' })),
    )

    // Assert
    await expect(page.locator(toggles).nth(4)).toBeFocused()
  })

  test('after the last deck on the page, j reaches Show more, and no further', async ({ page, open }) => {
    // Arrange
    await open()
    await page.locator(toggles).last().focus()

    // Act
    await page.keyboard.press('j')
    await page.keyboard.press('j')

    // Assert
    await expect(page.locator('#results [data-more]')).toBeFocused()
  })

  test('on Craft, j and k move through its cards', async ({ page, open }) => {
    // Arrange
    await open('#t=craft')

    // Act
    await page.keyboard.press('j')
    await page.keyboard.press('j')

    // Assert
    await expect(page.locator('#craft-body [data-craft-pick]').nth(1)).toBeFocused()
  })
})

test('Esc in the search box closes the suggestions, then leaves the box for the results heading', async ({
  page,
  open,
}) => {
  // Arrange
  await open()
  const input = page.locator('#card-input')
  await input.fill('gri')
  await expect(page.locator('#suggestions')).toBeVisible()

  // Act / Assert
  await page.keyboard.press('Escape')
  await expect(page.locator('#suggestions')).toBeHidden()
  await expect(input).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('#result-head')).toBeFocused()
  await expect(input).toHaveValue('gri')
  await page.keyboard.press('j')
  await expect(page.locator('#results [data-toggle]').first()).toBeFocused()
})
test('a deck focused while scrolling up is not hidden under the pinned filters', async ({ page, open }) => {
  // Arrange: a deck far down, then back up as Shift+Tab does
  await open()
  await page.locator('#results [data-toggle]').nth(20).focus()

  // Act
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+Tab')

  // Assert
  const [filtersBottom, focusedTop] = await page.evaluate(() => [
    document.querySelector('#filters')?.getBoundingClientRect().bottom ?? 0,
    document.activeElement?.getBoundingClientRect().top ?? 0,
  ])
  expect(focusedTop).toBeGreaterThanOrEqual(filtersBottom)
})
