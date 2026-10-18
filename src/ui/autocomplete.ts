import { CONFIG } from '../config.ts'
import type { Locale } from '../i18n.ts'
import type { Dataset } from '../types.ts'
import { esc } from './dom.ts'

/** Option element ID: tag keys are slugs or `c{id}`, so they can't collide with card IDs. */
const optionId = (item: number | string) => `sug-${typeof item === 'number' ? item : `t-${item}`}`

/** Options for {@link createAutocomplete}. */
export interface AutocompleteOptions {
  input: HTMLInputElement
  list: HTMLElement
  data: Dataset
  /** Current locale; read on every render so a language switch takes effect immediately. */
  locale: () => Locale
  /** Current candidates as `cardId → deck count`; read on every keystroke so it tracks filters. */
  candidates: () => Map<number, number>
  /** Current tag candidates as `tag key → deck count`, read like {@link candidates}. */
  tagCandidates: () => Map<string, number>
  onPick: (id: number) => void
  onPickTag: (key: string) => void
  /** Backspace in an empty input. */
  onBackspace: () => void
}

/** How a name matches the query: 0 prefix, 1 substring, -1 not at all. `loose` also counts a query that extends the name. */
function matchRank(name: string, q: string, loose = false): number {
  const lower = name.toLowerCase()
  const at = lower.indexOf(q)
  return at === 0 || (loose && q.startsWith(lower)) ? 0 : at > 0 ? 1 : -1
}

/**
 * Wires an accessible combobox for adding cards and tags. Both match by their name in the current language or in
 * English (many players know English names). Local prefix matches rank first, then local substring, then
 * English; ties go to tags, then to whatever is in more decks. A tag also matches a query that starts with its
 * name, so "Beasts" or "Orders" finds Beast or Order.
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
  tagCandidates,
  onPick,
  onPickTag,
  onBackspace,
}: AutocompleteOptions) {
  // A number is a card ID, a string a tag key.
  let items: (number | string)[] = []
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
    const nameOf = (item: number | string) => (typeof item === 'number' ? loc.card(item) : loc.tag(item))
    const englishOf = (item: number | string) => (typeof item === 'number' ? data.cards[item].name : data.tags[item])
    const scored: [item: number | string, rank: number, count: number][] = []
    const score = (item: number | string, count: number) => {
      const loose = typeof item === 'string'
      const local = matchRank(nameOf(item), q, loose)
      const english = matchRank(englishOf(item), q, loose)
      const rank = local >= 0 ? local : english >= 0 ? english + 2 : -1
      if (rank >= 0) scored.push([item, rank, count])
    }
    for (const [key, count] of tagCandidates()) score(key, count)
    for (const [id, count] of candidates()) score(id, count)
    const isCard = (item: number | string) => Number(typeof item === 'number')
    scored.sort(
      (a, b) =>
        a[1] - b[1] || isCard(a[0]) - isCard(b[0]) || b[2] - a[2] || nameOf(a[0]).localeCompare(nameOf(b[0]), loc.lang),
    )
    items = scored.slice(0, CONFIG.maxSuggestions).map(([item]) => item)
    active = Math.min(active, Math.max(items.length - 1, 0))
    const counts = new Map(scored.map(([item, , c]) => [item, c]))
    const viaEnglish = new Set(scored.filter(([, rank]) => rank >= 2).map(([item]) => item))
    const count = (item: number | string) =>
      `<span class="count" title="${esc(loc.t('cards.deckCount'))}">${counts.get(item)}</span>`
    const alt = (item: number | string) =>
      viaEnglish.has(item) ? ` <span class="sug-alt">${esc(englishOf(item))}</span>` : ''
    list.innerHTML = items.length
      ? items
          .map((item, i) => {
            if (typeof item === 'string') {
              return `<div id="${optionId(item)}" role="option" data-tag="${esc(item)}" class="tag" aria-selected="${i === active}">
              <span class="cost" aria-hidden="true">#</span><span class="sug-name">${esc(loc.tag(item))}${alt(item)} <span class="sug-kind">${esc(loc.t('filter.tags'))}</span></span>
              ${count(item)}</div>`
            }
            const card = data.cards[item]
            return `<div id="${optionId(item)}" role="option" data-id="${item}" class="f-${card.faction}" aria-selected="${i === active}">
              <span class="cost">${card.provisions}</span><span class="sug-name">${esc(loc.card(item))}${alt(item)}</span>
              ${count(item)}</div>`
          })
          .join('')
      : `<div class="none">${esc(loc.t('cards.noMatch'))}</div>`
    list.hidden = false
    input.setAttribute('aria-expanded', 'true')
    if (items.length) input.setAttribute('aria-activedescendant', optionId(items[active]))
  }

  function pick(item: number | string) {
    input.value = ''
    active = 0
    close()
    if (typeof item === 'number') onPick(item)
    else onPickTag(item)
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
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-id], [data-tag]')
    if (!li) return
    e.preventDefault()
    pick(li.dataset.tag ?? Number(li.dataset.id))
  })

  return { refresh: () => (list.hidden ? undefined : render()) }
}
