import { CONFIG } from '../config.ts'
import type { Locale } from '../i18n.ts'
import type { Dataset } from '../types.ts'
import { esc } from './dom.ts'

/**
 * Renders the card-frequency panel's bars, the first {@link CONFIG.frequencyBars} of them.
 *
 * @param rows - `[cardId, deckCount]`, from `cardFrequency`
 * @param total - Decks counted, the 100% mark
 * @param data - Dataset for card factions
 * @param loc - Locale for names and text
 * @returns `<li>` HTML; a "none" item when there are no rows
 */
export function barsHtml(rows: [number, number][], total: number, data: Dataset, loc: Locale): string {
  return rows.length
    ? rows
        .slice(0, CONFIG.frequencyBars)
        .map(([id, n]) => {
          const card = data.cards[id]
          const name = loc.card(id)
          const pct = Math.round((n / Math.max(total, 1)) * 100)
          return `<li class="f-${card.faction}"><button type="button" data-add="${id}" title="${esc(loc.t('freq.barTip', { n, total, name }))}">
            <span class="bar-name">${esc(name)}</span><span class="bar-n">${n}</span>
            <span class="bar" style="--pct:${pct}%"></span></button></li>`
        })
        .join('')
    : `<li class="none">${esc(loc.t('freq.empty'))}</li>`
}
