import { data, expect, expectedCount, test } from './app.ts'

test('Has video lists only decks with a video, in the link too', async ({ page, open }) => {
  // Arrange
  await open()
  const toggle = page.locator('#has-video')
  const n = expectedCount({ video: true })
  await expect(toggle.locator('.n')).toHaveText(n.toLocaleString('en'))

  // Act
  await toggle.click()

  // Assert
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/#v=1$/)
  await expect(page.locator('#result-head')).toHaveText(new RegExp(`^${n} `))
  const rows = page.locator('#results li.deck')
  await expect(rows.locator('a.video')).toHaveCount(await rows.count())
})

test("a deck row links its video and shows its guide's language", async ({ page, open }) => {
  // Arrange: a guide with a video, listed alone by picking its leader and every card
  const deck = data.decks.find((d) => d.video && d.guideLang)
  if (!deck) throw new Error('no guide with a video')
  const ids = deck.cards.map(([id]) => id)
  const leader = ids.find((id) => data.cards[id].type === 'leader')
  await open(`#l=${leader}&c=${ids.filter((id) => id !== leader && data.cards[id].type !== 'stratagem').join(',')}`)

  // Act
  const row = page.locator('#results li.deck', { has: page.locator(`[data-toggle="${deck.id}"]`) })

  // Assert
  await expect(row.locator('a.video')).toHaveAttribute('href', deck.video?.url ?? '')
  await expect(row.locator('a.video')).toContainText(deck.video?.lang.split('-')[0].toUpperCase() ?? '')
  await expect(row.locator('.lang')).toHaveText(deck.guideLang?.split('-')[0].toUpperCase() ?? '')
})
