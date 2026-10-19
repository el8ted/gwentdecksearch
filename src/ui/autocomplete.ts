import { CONFIG } from '../config.ts'
import type { Locale } from '../i18n.ts'
import type { Dataset } from '../types.ts'
import { esc } from './dom.ts'

/** Option element ID: tag keys are slugs or `c{id}`, so they can't collide with card IDs; author keys are encoded. */
const optionId = (item: number | string) =>
  `sug-${typeof item === 'number' ? item : item.startsWith('@') ? `a-${encodeURIComponent(item.slice(1))}` : `t-${item}`}`

// Letters that aren't a base letter plus an accent mark, so decomposing doesn't reach them.
const LETTERS: Record<string, string> = {
  ł: 'l',
  ø: 'o',
  đ: 'd',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  '’': "'",
  '‘': "'",
  ʼ: "'",
}

/**
 * Text as it's matched: lower case, accents off, so "coen" finds Coën and a straight ' finds Raffard’s. Only Latin and
 * Cyrillic accent marks (U+0300–U+036F) go: kana and hangul compare as typed.
 *
 * @param text - A name or the typed query
 * @returns The folded text
 */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[łøđßæœ’‘ʼ]/g, (ch) => LETTERS[ch])
}

/** For matching typed text to an author: spacing and punctuation ignored, so "metallic d" finds MetallicDanny. */
const loose = (text: string) => fold(text).replace(/[^\p{L}\p{N}]/gu, '')

/** Author suggestions at most: names are many and short, so a few letters match dozens and would crowd out cards. */
const MAX_AUTHORS = 3

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
  /** Current author candidates as `author key → deck count`, read like {@link candidates}. */
  authorCandidates: () => Map<string, number>
  /** An author's display name by key. */
  authorName: (key: string) => string
  /** A card ID, a tag key, or `@` + an author key. */
  onPick: (pick: number | string) => void
  /** Backspace in an empty input. */
  onBackspace: () => void
}

/** How a name matches the query: 0 prefix, 1 substring, -1 not at all. `loose` also counts a query that extends the name. */
function matchRank(name: string, q: string, loose = false): number {
  const lower = fold(name)
  const at = lower.indexOf(q)
  return at === 0 || (loose && q.startsWith(lower)) ? 0 : at > 0 ? 1 : -1
}

/**
 * Wires an accessible combobox for adding cards and tags. Both match by their name in the current language or in
 * English (many players know English names). Local prefix matches rank first, then local substring, then
 * English; ties go to tags, then to whatever is in more decks. A tag also matches a query that starts with its
 * name, so "Beasts" or "Orders" finds Beast or Order. Authors match from the start of their name, case and spacing
 * ignored, and come after cards.
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
  authorCandidates,
  authorName,
  onPick,
  onBackspace,
}: AutocompleteOptions) {
  // A number is a card ID, `@…` an author, any other string a tag key.
  let items: (number | string)[] = []
  let active = 0

  function close() {
    list.hidden = true
    input.setAttribute('aria-expanded', 'false')
    input.removeAttribute('aria-activedescendant')
  }

  function render() {
    const q = fold(input.value.trim())
    if (!q) return close()
    const loc = locale()
    const isAuthor = (item: number | string): item is string => typeof item === 'string' && item.startsWith('@')
    const nameOf = (item: number | string) =>
      typeof item === 'number' ? loc.card(item) : isAuthor(item) ? authorName(item.slice(1)) : loc.tag(item)
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
    const aq = loose(q)
    const authors: typeof scored = aq
      ? [...authorCandidates()]
          .filter(([key]) => loose(key).startsWith(aq))
          .sort((a, b) => b[1] - a[1])
          .slice(0, MAX_AUTHORS)
          .map(([key, count]) => [`@${key}`, 0, count])
      : []
    const kind = (item: number | string) => (typeof item === 'number' ? 1 : isAuthor(item) ? 2 : 0)
    scored.sort(
      (a, b) =>
        a[1] - b[1] || kind(a[0]) - kind(b[0]) || b[2] - a[2] || nameOf(a[0]).localeCompare(nameOf(b[0]), loc.lang),
    )
    // Authors after the cards that match as well, but kept in the list: a name finds nothing else.
    const room = CONFIG.maxSuggestions - authors.length
    const firstWeak = scored.findIndex(([, rank]) => rank > 0)
    const strong = firstWeak < 0 ? scored.length : firstWeak
    const shown = [
      ...scored.slice(0, Math.min(strong, room)),
      ...authors,
      ...scored.slice(strong).slice(0, Math.max(room - strong, 0)),
    ]
    scored.push(...authors)
    items = shown.map(([item]) => item)
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
            if (isAuthor(item)) {
              return `<div id="${optionId(item)}" role="option" data-tag="${esc(item)}" class="author" aria-selected="${i === active}">
              <span class="cost" aria-hidden="true">✎</span><span class="sug-name">${esc(nameOf(item))} <span class="sug-kind">${esc(loc.t('cards.author'))}</span></span>
              ${count(item)}</div>`
            }
            if (typeof item === 'string') {
              return `<div id="${optionId(item)}" role="option" data-tag="${esc(item)}" class="tag" aria-selected="${i === active}">
              <span class="cost" aria-hidden="true">#</span><span class="sug-name">${esc(loc.tag(item))}${alt(item)} <span class="sug-kind">${esc(loc.t('cards.tag'))}</span></span>
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
    onPick(item)
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
