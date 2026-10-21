/**
 * Applies search changes: sets the filters, keeps the URL and history in step, and redraws. The rules for each
 * change are in `search.ts`; this module only carries them out.
 */
import { AUTHORS, data, deckById, decks, LIST_SIZE } from './data.ts'
import { type FilterState, facets, listForUrl } from './filter.ts'
import { encodeState } from './hash.ts'
import { LANG_KEY, type Lang } from './i18n.ts'
import * as search from './search.ts'
import { freshView, PAGE, session } from './session.ts'
import { createAutocomplete } from './ui/autocomplete.ts'
import { writeStorage } from './ui/dom.ts'
import { initLanguageMenu } from './ui/language-menu.ts'
import { loadPack, makeLocale } from './ui/locale.ts'
import { applyStatic, els, renderFilters, renderResults } from './ui/page.ts'
import { deckName } from './ui/results.ts'

/**
 * Sets filters, keeps the URL in step and redraws.
 *
 * @param next - The filters to change
 * @param options - `push`: a new history entry, so Back undoes it; filter tweaks replace the current one instead, so
 *   they don't flood the Back button
 */
export function update(next: Partial<FilterState>, { push = false } = {}) {
  const { state } = session
  const before = encodeState(state)
  // A leader outside the new factions would be a filter with no visible pill.
  const leader = state.leader
  if (next.factions && leader !== undefined && !next.factions.includes(data.cards[leader].faction)) {
    next = { ...next, leader: undefined }
  }
  session.state = { ...state, ...next }
  session.view.limit = PAGE
  const hash = encodeState(session.state)
  const url = hash || location.pathname + location.search
  if (push && hash !== before) history.pushState(null, '', url)
  else history.replaceState(null, '', url)
  render()
}

/**
 * Carries out a search change from `search.ts`.
 *
 * @param step - The change; `undefined` (nothing to do) is ignored
 */
export function apply(step: search.Step | undefined) {
  if (!step) return
  session.memory = step.memory
  update(step.next, { push: step.push })
}

/** Redraws everything that depends on the filters. */
export function render() {
  session.current = facets(decks, session.state)
  renderFilters()
  renderResults()
  autocomplete.refresh()
}

/** Clear all: the filters, the view choices it resets, and any text left in the Search box. */
export function clearAll() {
  Object.assign(session.view, freshView())
  // Text left in the box (a deck link that wasn't found, a half-typed name) is part of the search too.
  autocomplete.clear()
  apply(search.clearAll(session.state))
}

/**
 * Adds a card, tag or author to the search.
 *
 * @param pick - Card ID, tag key, or `@` + author key
 * @param excluded - Whether decks must not have it
 */
export function addPick(pick: number | string, excluded = false) {
  apply(search.addPick(session.state, session.memory, pick, data.cards, excluded))
}

/** Removes a card, tag or author from the search. */
export const removePick = (pick: number | string) =>
  apply(search.removePick(session.state, session.memory, pick, data.cards))
/** Stops showing one card list. */
export const removeDeck = () => apply(search.removeDeck(session.memory))
/** Undoes ≈. */
export const removeNear = () => apply(search.removeNear(session.memory))
/** Shows only the decks with this card list, replacing the search. */
export const showDeck = (list: string) => apply(search.showDeck(session.state, list))

export const autocomplete = createAutocomplete({
  input: els.input,
  list: els.suggestions,
  data,
  locale: () => session.loc,
  candidates: () => {
    const chosen = new Set(session.state.picks)
    return new Map([...session.current.cards].filter(([id]) => !chosen.has(id)))
  },
  tagCandidates: () => new Map([...session.current.tags].filter(([key]) => !session.state.picks.includes(key))),
  authorCandidates: () =>
    new Map([...session.current.authors].filter(([key]) => !session.state.picks.includes(`@${key}`))),
  authorName: (key) => AUTHORS.get(key) ?? key,
  onPick: addPick,
  total: () => session.matchCount,
  onBackspace: () => {
    const { state } = session
    const last = state.picks.at(-1)
    if (last !== undefined) removePick(last)
    else if (state.deck !== undefined) removeDeck()
    else if (state.near !== undefined) removeNear()
  },
  deckFor: (url) => {
    const first = deckById(listForUrl(decks, url))
    return first
      ? { list: first.list, name: deckName(first.deck, session.loc), count: LIST_SIZE.get(first.list) ?? 1 }
      : undefined
  },
  onDeck: showDeck,
})

/**
 * Switches language: interface phrases at once, card names once the pack loads.
 *
 * @param lang - The language
 */
export async function setLanguage(lang: Lang) {
  session.loc = makeLocale(lang, globalThis.GDS_I18N?.[lang])
  applyStatic()
  render()
  languageMenu.refresh()
  const pack = await loadPack(lang)
  // Ignore a late load if the visitor has switched again meanwhile.
  if (pack && session.loc.lang === lang) {
    session.loc = makeLocale(lang, pack)
    applyStatic()
    render()
  }
}

const languageMenu = initLanguageMenu(
  () => session.loc.lang,
  (lang) => {
    writeStorage(LANG_KEY, lang)
    // Reflect the choice in the URL so a shared link opens in the same language.
    const url = new URL(location.href)
    url.searchParams.set('lang', lang)
    history.replaceState(null, '', url)
    void setLanguage(lang)
  },
)
