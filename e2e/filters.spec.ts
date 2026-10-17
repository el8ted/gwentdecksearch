import { expect, expectedCount, test } from './app.ts'

test('a faction filter updates the hash and survives a reload', async ({ page, open }) => {
  // Arrange
  await open()
  const head = page.locator('#result-head')

  // Act
  await page.locator('[data-faction="MO"]').click()

  // Assert
  await expect(page).toHaveURL(/#f=MO$/)
  await expect(head).toHaveText(new RegExp(`^${expectedCount({ factions: ['MO'] })} `))
  await page.reload()
  await expect(page.locator('[data-faction="MO"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(head).toHaveText(new RegExp(`^${expectedCount({ factions: ['MO'] })} `))
})

test('sources start unpicked; picking one, then another, widens the list, and unpicking all shows every deck', async ({
  page,
  open,
}) => {
  // Arrange
  await open()
  const head = page.locator('#result-head')
  const pill = (src: string) => page.locator(`[data-source="${src}"]`)
  await expect(pill('shinmiri2')).toHaveAttribute('aria-pressed', 'false')

  // Act + Assert
  await pill('shinmiri2').click()
  await expect(pill('shinmiri2')).toHaveAttribute('aria-pressed', 'true')
  await expect(head).toHaveText(new RegExp(`^${expectedCount({ sources: ['shinmiri2'] })} `))
  await expect(page).toHaveURL(/src=shinmiri2$/)
  await pill('metallic-danny').click()
  await expect(head).toHaveText(new RegExp(`^${expectedCount({ sources: ['shinmiri2', 'metallic-danny'] })} `))
  await pill('shinmiri2').click()
  await pill('metallic-danny').click()
  await expect(head).toHaveText(new RegExp(`^${expectedCount({})} `))
  await expect(page).not.toHaveURL(/src=/)
})

test('a budget filter matches the provision status', async ({ page, open }) => {
  // Arrange
  await open()

  // Act
  await page.locator('[data-budget="exact"]').click()

  // Assert
  await expect(page).toHaveURL(/#b=exact$/)
  await expect(page.locator('#result-head')).toHaveText(new RegExp(`^${expectedCount({ budgets: ['exact'] })} `))
})

test('Clear all empties the hash and lists every deck again', async ({ page, open }) => {
  // Arrange
  await open('#f=NG&b=spare')

  // Act
  await page.locator('#clear').click()

  // Assert
  await expect(page).not.toHaveURL(/#/)
  await expect(page.locator('#result-head')).toHaveText(new RegExp(`^${expectedCount({})} `))
  await expect(page.locator('[data-faction="NG"]')).toHaveAttribute('aria-pressed', 'false')
})

test('Back undoes Clear all', async ({ page, open }) => {
  // Arrange
  await open('#f=NG&b=spare')
  await page.locator('#clear').click()
  await expect(page).not.toHaveURL(/#/)

  // Act
  await page.goBack()

  // Assert
  await expect(page).toHaveURL(/#f=NG&b=spare$/)
  await expect(page.locator('[data-faction="NG"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#result-head')).toHaveText(
    new RegExp(`^${expectedCount({ factions: ['NG'], budgets: ['spare'] })} `),
  )
})

test('Clear all with nothing selected adds no history entry', async ({ page, open }) => {
  // Arrange
  await open()
  const before = await page.evaluate(() => history.length)

  // Act
  await page.locator('#clear').click()

  // Assert
  expect(await page.evaluate(() => history.length)).toBe(before)
})

test('leader pills appear for the selected faction, and switching faction clears the leader', async ({
  page,
  open,
}) => {
  // Arrange
  await open()
  const leaders = page.locator('#leader [data-leader]')
  await expect(leaders).toHaveCount(0)
  await expect(page.locator('#leader .hint')).toBeVisible()

  // Act + Assert
  await page.locator('[data-faction="MO"]').click()
  await expect(leaders).toHaveCount(7)
  await leaders.first().click()
  await expect(leaders.first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/l=/)
  await leaders.first().click()
  await expect(page).not.toHaveURL(/l=/)
  await leaders.first().click()
  await page.locator('[data-faction="NG"]').click()
  await expect(page).not.toHaveURL(/l=/)
  await expect(page.locator('#leader [aria-pressed="true"]')).toHaveCount(0)
})

test('stratagem pills keep a fixed order: neutrals in a row above the faction row, which keeps all six', async ({
  page,
  open,
}) => {
  // Arrange
  await open()
  const rows = page.locator('#stratagem .pills')
  const ids = async (i: number) =>
    await rows
      .nth(i)
      .locator('[data-stratagem]')
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.stratagem))

  // Act
  const neutral = await ids(0)
  await page.locator('[data-faction="MO"]').click()

  // Assert
  expect(neutral).toEqual([...neutral].sort((a, b) => Number(a) - Number(b)))
  expect(await ids(0)).toEqual(neutral)
  await expect(rows.nth(1).locator('[data-stratagem]')).toHaveCount(6)
  await expect(rows.nth(1).locator('.empty')).toHaveCount(5)
  await expect(rows.nth(1).locator('.f-MO:not(.empty)')).toHaveCount(1)
})
