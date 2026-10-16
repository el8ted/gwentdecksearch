import { data, expect, test } from './app.ts'

test('loads from file:// with every deck listed', async ({ page, open }) => {
  // Act
  await open()

  // Assert
  await expect(page.locator('#meta')).toContainText(`${data.decks.length} decks`)
  await expect(page.locator('#result-head')).toHaveText(`${data.decks.length} decks match`)
  await expect(page.locator('#results > li.deck').first()).toBeVisible()
})

// F29: the data date is shown in UTC, so players everywhere see the same moment.
const scraped = new Date(data.scrapedAt)
const utc = `${scraped.toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC', hourCycle: 'h23' })} UTC`

for (const timezoneId of ['Asia/Tokyo', 'America/New_York', 'Pacific/Kiritimati']) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId })

    test('shows the data date and time in UTC', async ({ page, open }) => {
      // Act
      await open()

      // Assert
      await expect(page.locator('#meta')).toContainText(`data as of ${utc}`)
      expect(utc).toContain(`${String(scraped.getUTCHours()).padStart(2, '0')}:`)
    })
  })
}
