import { expect, test } from './app.ts'

const PANEL = '[data-freq="most"]'

test.describe('skip links', () => {
  test('the first Tab shows "Skip to card search"', async ({ page, open }) => {
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
    ['[', '[data-source="community"]'],
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
    await open('#f=SK&b=over')
    await page.locator('[data-faction="SK"]').focus()

    // Act
    await page.keyboard.press('Shift+Backspace')

    // Assert
    await expect(page).not.toHaveURL(/#/)
    await expect(page.locator('#card-input')).toBeFocused()
    await page.goBack()
    await expect(page).toHaveURL(/#f=SK&b=over$/)
  })

  test('keys typed in the card box stay in the card box', async ({ page, open }) => {
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
    await expect(page.locator('[data-source="community"]')).toBeFocused()
  })

  test('shortcuts are off while a dialog is open', async ({ page, open }) => {
    // Arrange
    await open()
    await page.locator('#credits-open').click()

    // Act
    await page.keyboard.press('[')

    // Assert
    await expect(page.locator('#credits')).toBeVisible()
    await expect(page.locator('[data-source="community"]')).not.toBeFocused()
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
    await expect(page.locator('#shortcuts dt')).toHaveCount(9)
  })
})
