import {
  BUDGETS,
  budgetSide,
  cardChanges,
  deckBody,
  type IndexedDeck,
  indexDecks,
  matchDecks,
  overlap,
} from '../src/filter.ts'
import { data, expect, expectedCount, test } from './app.ts'

const decks = indexDecks(data)
const similarTo = (e: IndexedDeck) => ({
  near: e.deck.id,
  factions: [e.faction],
  leader: e.leader,
  budgets: BUDGETS.filter((b) => budgetSide(b) !== 'over'),
})
const ranked = (e: IndexedDeck) => matchDecks(decks, { picks: [], ...similarTo(e) })
const overs = decks.filter((e) => budgetSide(e.budget) === 'over')
// An Over deck with close decks that fit, and one with none.
const over = overs.find((e) => ranked(e).length > 1)
const lonely = overs.find((e) => ranked(e).length === 0)
if (!over || !lonely) throw new Error('need Over decks with and without similar decks')
const similar = similarTo(over)

test('≈ with no close deck says so', async ({ page, open }) => {
  // Arrange
  await open(`#d=${lonely.list}`)

  // Act
  await page.locator(`[data-near="${lonely.deck.id}"]`).click()

  // Assert
  await expect(page.locator('#results .empty-state')).toContainText('Try an Over step')
})

test('≈ on an Over deck lists the decks that fit with its leader, most cards in common first', async ({
  page,
  open,
}) => {
  // Arrange
  await open(`#d=${over.list}`)

  // Act
  await page.locator(`[data-near="${over.deck.id}"]`).click()

  // Assert
  await expect(page).toHaveURL(new RegExp(`n=${over.deck.id}`))
  await expect(page.locator('#result-head')).toHaveText(new RegExp(`^${expectedCount(similar)} `))
  await expect(page.locator('#chips li')).toHaveCount(1)
  const [best] = ranked(over)
  const size = deckBody(over).reduce((n, [, c]) => n + c, 0)
  await expect(page.locator('#results .badge.shared').first()).toHaveText(new RegExp(`${overlap(over, best)}/${size}`))
  await expect(page.locator('[data-budget="over1"]')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[data-budget="exact"]')).toHaveAttribute('aria-pressed', 'true')

  // Act: the deck's own provision step counts it, and lists it first to compare against
  const own = page.locator(`[data-budget="${over.budget}"]`)
  await expect(own.locator('span')).not.toHaveText('0')
  await own.click()

  // Assert
  await expect(page.locator('#results .badge.shared').first()).toHaveText('This deck')
  await expect(page.locator('#results [data-toggle]').first()).toHaveAttribute('data-toggle', over.deck.id)
})

test('✕ on the Similar pill restores the search before ≈, even after ≈ again from the list', async ({ page, open }) => {
  // Arrange
  await open(`#d=${over.list}`)
  await page.locator(`[data-near="${over.deck.id}"]`).click()
  await page.locator('#results [data-near]').first().click()

  // Act
  await page.locator('[data-remove-near]').click()

  // Assert
  await expect(page).toHaveURL(new RegExp(`#d=${over.list}$`))
  await expect(page.locator('#result-head')).toHaveText(/^1 /)
})

test('✕ on a shared ≈ link drops the leader and provision steps too', async ({ page, open }) => {
  // Arrange
  await open(`#f=${over.faction}&b=exact&l=${over.leader}&n=${over.deck.id}`)

  // Act
  await page.locator('[data-remove-near]').click()

  // Assert
  await expect(page).toHaveURL(new RegExp(`#f=${over.faction}$`))
})

test('Back after ≈ restores the search', async ({ page, open }) => {
  // Arrange
  await open(`#d=${over.list}`)
  await page.locator(`[data-near="${over.deck.id}"]`).click()

  // Act
  await page.goBack()

  // Assert
  await expect(page).toHaveURL(new RegExp(`#d=${over.list}$`))
})

test('Show changes compares each deck with This deck, even while the Provisions filter hides it', async ({
  page,
  open,
}) => {
  // Arrange
  await open(`#d=${over.list}`)
  await page.locator(`[data-near="${over.deck.id}"]`).click()
  const [best] = ranked(over)
  const { added, removed } = cardChanges(over, best)
  const toggle = page.locator('#dim-common')

  // Act
  await page.locator(`[data-toggle="${best.deck.id}"]`).click()
  await toggle.click()

  // Assert
  await expect(toggle).toHaveText('Show changes')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#near-note')).toContainText('Provisions filter')
  const row = page.locator('#results > li').first()
  await expect(row.locator('.added')).toHaveCount(added.size)
  if (removed.length === 0) await expect(row.locator('.swapped')).toHaveCount(0)
  for (const [id] of removed) await expect(row.locator('.swapped')).toContainText(data.cards[id].name)

  // Act: Show it turns on the deck's own step, listing it first, unmarked
  await page.locator('[data-show-near]').click()

  // Assert
  await expect(page.locator('#near-note')).toBeHidden()
  await expect(page.locator(`[data-budget="${over.budget}"]`)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#result-head')).toBeFocused()
  const self = page.locator('#results > li').first()
  await expect(self.locator('.badge.shared')).toHaveText('This deck')
})
