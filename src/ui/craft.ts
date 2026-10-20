import { CONFIG } from '../config.ts'
import type { CraftRow } from '../filter.ts'
import type { Locale } from '../i18n.ts'
import type { Dataset } from '../types.ts'
import { esc } from './dom.ts'

/** What the Craft list is drawn from. */
export interface CraftContext {
  /** Every ranked card, from `craftList`; only the first `limit` are drawn. */
  rows: CraftRow[]
  /** Matching decks, the 100% mark for each card's share. */
  total: number
  limit: number
  /** Cards ticked Have it this visit: out of the running total. */
  have: Set<number>
  /** Scraps the player says they have; `undefined` until they type a number. */
  scraps?: number
  data: Dataset
  loc: Locale
}

/** The Craft list's table body and the line summing up what the scraps cover. */
export interface CraftView {
  body: string
  summary: string
}

/**
 * Renders the Craft list: each card with its share of the matching decks, its cost and the running total
 * of the cards not ticked Have it. A line marks where that total passes the player's scraps: in list order, never
 * skipping ahead to cheaper cards, so it says how far the scraps go rather than what to buy.
 *
 * @param c - Ranked cards, ticks, scraps and lookups
 * @returns Table rows and the summary text
 */
export function craftView(c: CraftContext): CraftView {
  const { rows, total: decks, limit, have, scraps, data, loc } = c
  const { t, num } = loc
  let total = 0
  // The cards not ticked that the scraps cover and what they cost, and the first they don't (where the line goes).
  let reach = 0
  let spent = 0
  let short: number | undefined
  const totals = rows.map((r) => {
    if (have.has(r.id)) return undefined
    total += data.cards[r.id].scraps * r.copies
    if (scraps !== undefined && short === undefined) {
      if (total > scraps) short = r.id
      else {
        reach++
        spent = total
      }
    }
    return total
  })
  const line = `<tr class="reach"><td colspan="6">${esc(t('craft.line', { scraps: num(scraps ?? 0) }))}</td></tr>`
  const body = rows.slice(0, limit).map((r, i) => {
    const card = data.cards[r.id]
    const name = loc.card(r.id)
    const owned = have.has(r.id)
    const pct = Math.round((r.decks / Math.max(decks, 1)) * 100)
    const cost = card.scraps * r.copies
    return `${r.id === short ? line : ''}<tr class="f-${card.faction}${owned ? ' have' : ''}">
      <td class="rank">${i + 1}</td>
      <th scope="row" class="craft-card"><button type="button" data-craft-pick="${r.id}" title="${esc(t('craft.pickTip', { name }))}">${esc(name)}</button></th>
      <td class="share" title="${esc(t('craft.shareTip', { n: num(r.decks), of: num(decks) }))}">${pct}%<span class="share-of">${esc(num(r.decks))}</span></td>
      <td class="craft-cost" title="${esc(t('freq.barCost', { rarity: t(`rarity.${card.rarity}`), scraps: num(card.scraps) }))}">${r.copies > 1 ? `2 × ${num(card.scraps)}` : num(cost)}</td>
      <td class="total">${owned ? '—' : num(totals[i] ?? 0)}</td>
      <td class="have"><input type="checkbox" data-have="${r.id}" aria-label="${esc(t('craft.haveCard', { name }))}"${owned ? ' checked' : ''} /></td>
    </tr>`
  })
  if (rows.length > limit) {
    const n = Math.min(CONFIG.resultsPageSize, rows.length - limit)
    body.push(
      `<tr class="more"><td colspan="6"><button type="button" class="clear" data-more="1">${esc(t('craft.showMore', { n }))}</button></td></tr>`,
    )
  }
  const left = rows.filter((r) => !have.has(r.id))
  const summary =
    scraps === undefined || left.length === 0
      ? ''
      : reach === 0
        ? t('craft.reachNone', { cost: num(data.cards[left[0].id].scraps * left[0].copies) })
        : t('craft.reach', { n: reach, spent: num(spent), left: num(scraps - spent) })
  return {
    body: body.length ? body.join('') : `<tr><td colspan="6" class="empty-state">${esc(t('craft.none'))}</td></tr>`,
    summary,
  }
}
