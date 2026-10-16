import { CONFIG } from '../config.ts'
import type { Locale } from '../i18n.ts'
import type { Dataset } from '../types.ts'
import { esc } from './dom.ts'

/** Options for {@link createAutocomplete}. */
export interface AutocompleteOptions {
  input: HTMLInputElement
  list: HTMLElement
  data: Dataset
  /** Current locale; read on every render so a language switch takes effect immediately. */
  locale: () => Locale
  /** Current candidates as `cardId → deck count`; read on every keystroke so it tracks filters. */
  candidates: () => Map<number, number>
  onPick: (id: number) => void
  /** Backspace in an empty input. */
  onBackspace: () => void
}

/**
 * Wires an accessible combobox for adding cards. Cards match by their name in the current language or in
 * English (many players know English names). Local prefix matches rank first, then local substring, then
 * English; ties go to cards in more decks.
 *
 * @param options - Elements, data and callbacks
 * @returns `refresh()`, to re-filter after the candidates change
 */
export function createAutocomplete({
  input,
  list,
  data,
  locale,
  candidates,
  onPick,
  onBackspace,
}: AutocompleteOptions) {
  let items: number[] = []
  let active = 0

  function close() {
    list.hidden = true
    input.setAttribute('aria-expanded', 'false')
    input.removeAttribute('aria-activedescendant')
  }

  function render() {
    const q = input.value.trim().toLowerCase()
    if (!q) return close()
    const loc = locale()
    const scored: [number, number, number][] = []
    for (const [id, count] of candidates()) {
      const local = loc.card(id).toLowerCase().indexOf(q)
      const english = data.cards[id].name.toLowerCase().indexOf(q)
      const rank = local === 0 ? 0 : local > 0 ? 1 : english === 0 ? 2 : english > 0 ? 3 : -1
      if (rank >= 0) scored.push([id, rank, count])
    }
    scored.sort((a, b) => a[1] - b[1] || b[2] - a[2] || loc.card(a[0]).localeCompare(loc.card(b[0]), loc.lang))
    items = scored.slice(0, CONFIG.maxSuggestions).map(([id]) => id)
    active = Math.min(active, Math.max(items.length - 1, 0))
    const counts = new Map(scored.map(([id, , c]) => [id, c]))
    const viaEnglish = new Set(scored.filter(([, rank]) => rank >= 2).map(([id]) => id))
    list.innerHTML = items.length
      ? items
          .map((id, i) => {
            const card = data.cards[id]
            return `<div id="sug-${id}" role="option" data-id="${id}" class="f-${card.faction}" aria-selected="${i === active}">
              <span class="cost">${card.provisions}</span><span class="sug-name">${esc(loc.card(id))}${
                viaEnglish.has(id) ? ` <span class="sug-alt">${esc(card.name)}</span>` : ''
              }</span>
              <span class="count" title="${esc(loc.t('cards.deckCount'))}">${counts.get(id)}</span></div>`
          })
          .join('')
      : `<div class="none">${esc(loc.t('cards.noMatch'))}</div>`
    list.hidden = false
    input.setAttribute('aria-expanded', 'true')
    if (items.length) input.setAttribute('aria-activedescendant', `sug-${items[active]}`)
  }

  function pick(id: number) {
    input.value = ''
    active = 0
    close()
    onPick(id)
  }

  input.addEventListener('input', () => {
    active = 0
    render()
  })
  input.addEventListener('keydown', (e) => {
    // Tab/Shift+Tab move through suggestions like the arrows while the list is open; otherwise Tab leaves the field.
    const tab = e.key === 'Tab' && !list.hidden && items.length > 0
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || tab) {
      if (list.hidden) return render()
      e.preventDefault()
      const step = e.key === 'ArrowDown' || (tab && !e.shiftKey) ? 1 : -1
      active = (active + step + items.length) % Math.max(items.length, 1)
      render()
    } else if (e.key === 'Enter' && !list.hidden && items[active] !== undefined) {
      e.preventDefault()
      pick(items[active])
    } else if (e.key === 'Escape') {
      close()
    } else if (e.key === 'Backspace' && input.value === '') {
      onBackspace()
    }
  })
  input.addEventListener('blur', () => setTimeout(close, 150))
  // mousedown (not click) fires before blur closes the list.
  list.addEventListener('mousedown', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')
    if (!li) return
    e.preventDefault()
    pick(Number(li.dataset.id))
  })

  return { refresh: () => (list.hidden ? undefined : render()) }
}
