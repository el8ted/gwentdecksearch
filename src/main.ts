import dataJson from '../data/decks.json'
import { CONFIG } from './config.ts'
import {
  authorNames,
  BUDGETS,
  type Budget,
  budgetSide,
  cardChanges,
  cardFrequency,
  craftList,
  deckBody,
  type FilterState,
  facets,
  type IndexedDeck,
  indexDecks,
  listForUrl,
  matchDecks,
  overlap,
  pickedCards,
  sharedCards,
  singleFaction,
  wantedPicks,
} from './filter.ts'
import { decodeState, EMPTY_STATE, encodeState } from './hash.ts'
import de from './i18n/de.json'
import en from './i18n/en.json'
import es from './i18n/es.json'
import fr from './i18n/fr.json'
import it from './i18n/it.json'
import ja from './i18n/ja.json'
import ko from './i18n/ko.json'
import pl from './i18n/pl.json'
import ptBR from './i18n/pt-BR.json'
import ru from './i18n/ru.json'
import zhCn from './i18n/zh-cn.json'
import {
  createTranslator,
  LANG_KEY,
  LANGUAGES,
  type Lang,
  type LanguagePack,
  type Locale,
  type Phrases,
  pickLanguage,
  playgwentUrl,
} from './i18n.ts'
import type { Card, Dataset, Faction, Source } from './types.ts'
import { createAutocomplete } from './ui/autocomplete.ts'
import { craftView } from './ui/craft.ts'
import { initDisplayMenu } from './ui/display-menu.ts'
import { byId, esc, readStorage, writeStorage } from './ui/dom.ts'
import { type FilterRows, filterRows } from './ui/filters.ts'
import { initLanguageMenu } from './ui/language-menu.ts'
import { barsHtml } from './ui/panel.ts'
import { deckName, deckRow } from './ui/results.ts'

declare global {
  // Set at build time (tsdown.config.ts).
  const __VERSION__: string
  // Language packs register themselves here (see scripts/lib/build.ts).
  var GDS_I18N: Partial<Record<Lang, LanguagePack>> | undefined
}

// JSON imports widen literal types (type: string), so the shape is asserted; src/__tests__/data.test.ts checks it.
const data = dataJson as unknown as Dataset
const decks = indexDecks(data)
// In card ID order, which is the game's deck-builder order; fixed, so pills never move as counts change.
const ofType = (type: Card['type']) =>
  Object.keys(data.cards)
    .map(Number)
    .filter((id) => data.cards[id].type === type)
    .sort((a, b) => a - b)
const LEADERS = ofType('leader')
// Guide and video languages any deck has, in the language menu's order: fixed, like the other pills.
const LANGS = LANGUAGES.filter((l) => decks.some((e) => e.langs.has(l)))
const STRATAGEMS = ofType('stratagem')
const PHRASES = { en, de, es, fr, it, ja, ko, pl, 'pt-BR': ptBR, ru, 'zh-cn': zhCn } as Partial<
  Record<Lang, Phrases>
> & { en: Phrases }

const els = {
  meta: byId('meta'),
  factions: byId('factions'),
  sources: byId('sources'),
  budgets: byId('budgets'),
  dimCommon: byId<HTMLButtonElement>('dim-common'),
  media: byId('media'),
  expandAll: byId<HTMLButtonElement>('expand-all'),
  leader: byId('leader'),
  stratagem: byId('stratagem'),
  stratagemNote: byId('stratagem-note'),
  chips: byId('chips'),
  input: byId<HTMLInputElement>('card-input'),
  suggestions: byId('suggestions'),
  deckNote: byId('deck-note'),
  nearNote: byId('near-note'),
  match: byId('match'),
  resultHead: byId('result-head'),
  results: byId('results'),
  panelHead: byId('panel-head'),
  bars: byId('bars'),
  panel: byId('panel'),
  tab: byId('tab'),
  craft: byId('craft'),
  craftIntro: byId('craft-intro'),
  craftSummary: byId('craft-summary'),
  craftBody: byId('craft-body'),
  scraps: byId<HTMLInputElement>('scraps'),
  skipPast: byId('skip-past'),
}

function makeLocale(lang: Lang, pack?: LanguagePack): Locale {
  const num = new Intl.NumberFormat(lang)
  const date = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' })
  return {
    lang,
    t: createTranslator(lang, PHRASES, pack?.terms),
    card: (id) => pack?.cards[id] ?? data.cards[id]?.name ?? String(id),
    tag: (key) => pack?.tags?.[key] ?? data.tags[key] ?? key,
    num: (n) => num.format(n),
    date: (iso) => date.format(new Date(iso)),
    pg: (url) => playgwentUrl(url, lang),
  }
}

/** Loads a language pack by script tag (works from file://); resolves `undefined` for English or on failure. */
function loadPack(lang: Lang): Promise<LanguagePack | undefined> {
  if (lang === 'en') return Promise.resolve(undefined)
  const loaded = globalThis.GDS_I18N?.[lang]
  if (loaded) return Promise.resolve(loaded)
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = `i18n/${lang}.js`
    script.onload = () => resolve(globalThis.GDS_I18N?.[lang])
    script.onerror = () => resolve(undefined)
    document.head.append(script)
  })
}

const params = new URLSearchParams(location.search)
let loc = makeLocale(pickLanguage(params.get('lang'), readStorage(LANG_KEY), navigator.languages))
const AUTHORS = authorNames(decks)
const BY_ID = new Map(decks.map((e) => [e.deck.id, e]))
/** The deck with this ID; `undefined` for none (an unset filter) or an ID not in the data. */
const deckById = (id: string | undefined) => (id === undefined ? undefined : BY_ID.get(id))
// Each deck's card list (by deck ID), and how many decks share each list.
const LIST_OF = new Map(decks.map((e) => [e.deck.id, e.list]))
const LIST_SIZE = new Map<string, number>()
for (const e of decks) LIST_SIZE.set(e.list, (LIST_SIZE.get(e.list) ?? 0) + 1)
const readHash = () =>
  decodeState(
    location.hash,
    (id) => data.cards[id],
    (key) => Object.hasOwn(data.tags, key),
    (key) => AUTHORS.has(key),
    (id) => LIST_OF.get(id),
  )
let state: FilterState = readHash()
// `?deck=<playgwent URL>`: a way in for bots and tools holding a deck's full URL. Resolved once, then swapped for the
// short `#d=` form so bookmarks stay short; a deck that isn't in the list lands in Search, which says so.
const incoming = params.get('deck')
const unknownDeck = incoming !== null && listForUrl(decks, incoming) === undefined ? incoming : undefined
if (incoming !== null) {
  const list = listForUrl(decks, incoming)
  const url = new URL(location.href)
  url.searchParams.delete('deck')
  if (list) {
    state = { ...EMPTY_STATE, leader: undefined, stratagem: undefined, deck: list }
    url.hash = encodeState(state)
  }
  history.replaceState(null, '', url)
}
// The faction pill that adding a card turned on (see addCard); a pill click makes the choice the visitor's own.
// Not in the hash: after a reload the pill simply stays.
let autoFaction: Faction | undefined
// A pasted deck URL replaced an earlier search: say so, and that Back brings it back. Cleared with the deck filter.
let deckReplaced = false
// The search before ≈, which ✕ on the Similar pill restores. Not in the hash: a shared ≈ link has nothing to restore.
let beforeNear: FilterState | undefined
let current = facets(decks, state)
// Deck rows rendered; "Show more" adds PAGE at a time so a phone isn't handed 2,000+ rows at once.
const PAGE = CONFIG.resultsPageSize
/** View choices Clear all resets; they aren't in the URL, so a shared link opens without them. */
const freshView = () => ({
  /** Decks opened to their card list, by ID. */
  expanded: new Set<string>(),
  /** Dim cards every listed deck shares, so each deck's own cards stand out; a Similar list compares each deck with
   * This deck instead (Show changes). */
  dimCommon: false,
  /** Deck rows rendered; back to one page whenever the results change. */
  limit: PAGE,
})
/** How the results are shown, as opposed to which decks match ({@link state}). */
const view = {
  ...freshView(),
  /** Side-panel ordering; kept through Clear all. */
  freq: 'most' as 'most' | 'least',
  /** Craft cards ticked Have it, and the scraps typed in: about the player rather than the search, so they're kept
   * through Clear all, but only for this visit (nothing is stored). */
  have: new Set<number>(),
  scraps: undefined as number | undefined,
}
// Deck IDs currently listed, for Expand/Collapse all.
let shown: string[] = []
let allOpen = false
// Decks listed now, for exclude suggestions' "would remain" counts.
let matchCount = 0

/** Translates the static page: `data-i18n` (text) and `data-i18n-{title,label,placeholder}` attributes. */
function applyStatic() {
  const { t } = loc
  document.documentElement.lang = loc.lang
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n ?? '')
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle ?? '')
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel ?? ''))
  }
  for (const el of document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder ?? '')
  }
  for (const el of document.querySelectorAll<HTMLAnchorElement>('[data-pg]')) el.href = loc.pg(el.dataset.pg ?? '')
  // The threshold is a build setting, so Help reads it rather than repeating the number.
  byId('help-similar').textContent = t('help.similar1', { n: CONFIG.similarMinShared })
  // Help's ≈ ↗ ▶ ✕ drawn like the buttons they name, and the - typed to exclude like a key (a lone -, so hyphenated
  // words like Gameplay-Video stay as they are): easy to spot, in every language.
  for (const el of byId('shortcuts').querySelectorAll<HTMLElement>('summary, li')) {
    el.innerHTML = esc(el.textContent ?? '')
      .replace(/[≈↗▶✕]/g, (g) => `<span class="glyph">${g}</span>`)
      .replace(/(?<![\p{L}\p{N}])-(?![\p{L}\p{N}])/gu, '<kbd class="glyph">-</kbd>')
  }
  const version = byId<HTMLAnchorElement>('version')
  version.textContent = t('credits.version', { version: __VERSION__ })
  version.href = `https://github.com/el8ted/gwentdecksearch/releases${__VERSION__ === 'dev' ? '' : `/tag/${__VERSION__}`}`
  // The README for this language; each one links on to the full English guide.
  byId<HTMLAnchorElement>('help-readme').href =
    loc.lang === 'en'
      ? 'https://github.com/el8ted/gwentdecksearch/blob/main/docs/guide.md'
      : `https://github.com/el8ted/gwentdecksearch/blob/main/docs/README.${loc.lang}.md`
  // CDPR's site has every language we do, under the same codes in lower case (pt-br, zh-cn).
  byId<HTMLAnchorElement>('fan-content').href = `https://www.cdprojektred.com/${loc.lang.toLowerCase()}/fan-content`
  // Size the filter label column to the longest label in this language (Russian labels are much longer).
  const filters = byId('filters')
  filters.style.setProperty('--label-width', 'max-content')
  const labels = [...filters.querySelectorAll<HTMLElement>('.label')]
  const em = Number.parseFloat(getComputedStyle(labels[0]).fontSize)
  const widest = Math.max(...labels.map((l) => l.offsetWidth)) / em
  // In em, so it scales with the Display text-size setting; capped so one long label can't eat the row.
  filters.style.setProperty('--label-width', `${Math.min(Math.max(widest, 6.9), 14) + 0.1}em`)
  // UTC: players are worldwide and Gwent updates land around midnight UTC, so everyone sees the same moment.
  const scraped = `${new Date(data.scrapedAt).toLocaleString(loc.lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC', hourCycle: 'h23' })} UTC`
  els.meta.textContent = `${t('meta.decks', { n: decks.length })} · ${t('meta.dataAsOf', { date: scraped })}`
}

function update(next: Partial<FilterState>, { push = false } = {}) {
  const before = encodeState(state)
  // A leader outside the new factions would be a filter with no visible pill.
  const leader = state.leader
  if (next.factions && leader !== undefined && !next.factions.includes(data.cards[leader].faction)) {
    next = { ...next, leader: undefined }
  }
  state = { ...state, ...next }
  view.limit = PAGE
  const hash = encodeState(state)
  const url = hash || location.pathname + location.search
  // Filter tweaks replace the entry so they don't flood the back button; Clear all pushes one, so Back undoes it.
  if (push && hash !== before) history.pushState(null, '', url)
  else history.replaceState(null, '', url)
  render()
}

function clearAll() {
  Object.assign(view, freshView())
  autoFaction = undefined
  // Text left in the box (a deck link that wasn't found, a half-typed name) is part of the search too.
  autocomplete.clear()
  update(
    // All/Any and the Decks/Craft view are how you search, not what for, so they stay.
    {
      ...EMPTY_STATE,
      match: state.match,
      tab: state.tab,
      leader: undefined,
      stratagem: undefined,
      deck: undefined,
      near: undefined,
    },
    { push: true },
  )
}

/** Shows the decks with a pasted URL's card list, replacing the whole search (Back restores it). */
function showDeck(list: string) {
  deckReplaced = encodeState({ ...state, match: 'all' }) !== ''
  autoFaction = undefined
  update(
    // A deck link is for seeing that deck, so it opens the deck list even from Craft.
    {
      ...EMPTY_STATE,
      match: state.match,
      leader: undefined,
      stratagem: undefined,
      deck: list,
      near: undefined,
      tab: undefined,
    },
    { push: true },
  )
}

/**
 * Ranks decks by cards in common with one, as visible filters: its leader, and only decks that fit (Spare or Exact).
 * Picks and the other filters stay; Back, or ✕ on the Similar pill, restores the search before.
 */
function showNear(id: string) {
  const target = deckById(id)
  if (!target) return
  // ≈ from a similar list keeps the search before the first ≈, so ✕ goes all the way back.
  if (state.near === undefined) beforeNear = state
  deckReplaced = false
  autoFaction = undefined
  update(
    {
      near: id,
      deck: undefined,
      factions: [target.faction],
      leader: target.leader,
      stratagem: undefined,
      budgets: BUDGETS.filter((b) => budgetSide(b) !== 'over'),
    },
    { push: true },
  )
}

/** Undoes ≈: the search before it, else (opened from a link) without the leader and provision steps it sets. */
function removeNear() {
  const before = beforeNear
  beforeNear = undefined
  autoFaction = undefined
  update(
    before
      ? { ...EMPTY_STATE, leader: undefined, stratagem: undefined, deck: undefined, ...before, near: undefined }
      : { near: undefined, leader: undefined, budgets: [] },
  )
}

function removeDeck() {
  deckReplaced = false
  update({ deck: undefined })
}

/**
 * Adds a card, tag or author after the other picks, wanted or `excluded`; a wanted faction card also selects its
 * faction when none is selected (undone by {@link removePick}).
 */
function addPick(pick: number | string, excluded = false) {
  if (state.picks.includes(pick)) return
  const picks = [...state.picks, pick]
  const excludes = excluded ? [...(state.excludes ?? []), pick] : state.excludes
  const faction = typeof pick === 'number' && !excluded ? singleFaction(data.cards[pick]) : undefined
  // A pick searches across decks, so the pasted deck's list stops narrowing the results.
  deckReplaced = false
  if (faction && state.factions.length === 0) {
    autoFaction = faction
    update({ picks, excludes, factions: [faction], deck: undefined })
  } else update({ picks, excludes, deck: undefined })
}

/** Clears the faction a card selected once no wanted card of that faction remains. */
function undoAutoFaction(next: Pick<FilterState, 'picks' | 'excludes'>): Partial<FilterState> {
  const keep = pickedCards(wantedPicks(next)).some((c) => singleFaction(data.cards[c]) === autoFaction)
  if (autoFaction === undefined || keep) return {}
  autoFaction = undefined
  return { factions: [] }
}

/** Removes a card, tag or author. */
function removePick(pick: number | string) {
  const next = { picks: state.picks.filter((p) => p !== pick), excludes: state.excludes?.filter((p) => p !== pick) }
  update({ ...next, ...undoAutoFaction(next) })
}

/** Switches a pick between wanted and excluded, keeping its place. */
function flipPick(pick: number | string) {
  const on = state.excludes ?? []
  const next = { picks: state.picks, excludes: on.includes(pick) ? on.filter((p) => p !== pick) : [...on, pick] }
  update({ ...next, ...undoAutoFaction(next) })
}

/** A pick's name in the page language. */
const pickName = (pick: number | string) =>
  typeof pick === 'number'
    ? loc.card(pick)
    : pick.startsWith('@')
      ? (AUTHORS.get(pick.slice(1)) ?? pick)
      : loc.tag(pick)

function renderFilters() {
  for (const b of els.match.querySelectorAll<HTMLButtonElement>('[data-match]')) {
    b.setAttribute('aria-pressed', String(b.dataset.match === (state.match ?? 'all')))
  }
  const deck = deckById(state.deck)
  const rows = filterRows({
    state,
    facets: current,
    data,
    loc,
    leaders: LEADERS,
    stratagems: STRATAGEMS,
    langs: LANGS,
    pickName,
    deck,
    near: deckById(state.near),
  })
  for (const k of Object.keys(rows) as (keyof FilterRows)[]) els[k].innerHTML = rows[k]
  els.deckNote.hidden = !(deck && deckReplaced)
  els.deckNote.textContent = loc.t('cards.deckReplaced')
}

function renderBars(rows: [number, number][], total: number) {
  els.panelHead.textContent = loc.t('freq.inDecks', { n: total })
  els.bars.innerHTML = barsHtml(rows, total, data, loc)
}

function renderResults() {
  const { t } = loc
  // Cards carrying a selected tag are highlighted too, so an expanded deck shows why it matched.
  const wanted = wantedPicks(state)
  const cards = pickedCards(wanted)
  const tagged = Object.keys(data.cards)
    .map(Number)
    .filter((id) => data.cards[id].tags?.some((k) => wanted.includes(k)))
  const selected = new Set([...cards, ...tagged])
  const matches = matchDecks(decks, state)
  matchCount = matches.length
  if (showTab(state.tab === 'craft')) return renderCraft(matches, cards)
  els.resultHead.textContent = t('results.count', { n: matches.length })
  // Count, dimming and the card panel describe every match; only the rows are paged (Expand all covers those).
  const page = matches.slice(0, view.limit)
  shown = page.map((e) => e.deck.id)
  const near = deckById(state.near)
  // One deck shares everything with itself, so dimming needs at least two; a Similar list compares with This deck.
  const common = view.dimCommon && !near && matches.length > 1 ? sharedCards(matches) : new Set<number>()
  const size = near ? deckBody(near).reduce((n, [, c]) => n + c, 0) : 0
  const rows = page.map((e) =>
    deckRow(
      e,
      data,
      selected,
      view.expanded.has(e.deck.id),
      common,
      loc,
      near && { n: overlap(near, e), of: size, self: e === near },
      view.dimCommon && near && e !== near ? cardChanges(near, e) : undefined,
    ),
  )
  if (matches.length > view.limit) {
    const n = Math.min(PAGE, matches.length - view.limit)
    rows.push(
      `<li class="more"><button type="button" class="clear" data-more="1">${esc(t('results.showMore', { n }))}</button></li>`,
    )
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-freq]')) {
    b.setAttribute('aria-pressed', String(b.dataset.freq === view.freq))
  }
  renderBars(cardFrequency(matches, cards, view.freq), matches.length)
  allOpen = shown.length > 0 && shown.every((id) => view.expanded.has(id))
  els.expandAll.textContent = t(allOpen ? 'results.collapseAll' : 'results.expandAll')
  els.expandAll.disabled = shown.length === 0
  els.dimCommon.setAttribute('aria-pressed', String(view.dimCommon))
  els.dimCommon.textContent = t(near ? 'results.showChanges' : 'results.dimCommon')
  els.dimCommon.title = t(near ? 'results.showChangesTip' : 'results.dimCommonTip')
  // This deck may be filtered out (≈ hides Over decks), but the others can still be compared with it.
  els.dimCommon.disabled = near ? !shown.some((id) => id !== near.deck.id) : shown.length < 2
  renderNearNote(near, matches)
  const last = state.picks.at(-1)
  els.results.innerHTML = rows.length
    ? rows.join('')
    : `<li class="empty-state">${esc(t(near ? 'results.noneSimilar' : 'results.none', { n: CONFIG.similarMinShared }))}${
        last === undefined
          ? ''
          : ` <button type="button" class="link" data-remove="${esc(String(last))}">${esc(t('results.removeCard', { name: pickName(last) }))}</button>`
      }</li>`
}

/**
 * Shows the deck list or the Craft list, with the controls that belong to it.
 *
 * @param crafting - Whether the Craft tab is on
 * @returns `crafting`
 */
function showTab(crafting: boolean): boolean {
  for (const b of els.tab.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
    b.setAttribute('aria-pressed', String((b.dataset.tab === 'craft') === crafting))
  }
  els.craft.hidden = !crafting
  // The panel would repeat the Craft list, and the deck list's buttons have nothing to act on.
  for (const el of [els.results, els.panel, els.dimCommon, els.expandAll, els.skipPast]) el.hidden = crafting
  if (crafting) els.nearNote.hidden = true
  return crafting
}

/**
 * Renders the Craft list for the matching decks.
 *
 * @param matches - Decks the filters keep
 * @param picked - Cards picked in the search, which every match already has (with All) or the player chose
 */
function renderCraft(matches: IndexedDeck[], picked: number[]) {
  const { t } = loc
  els.resultHead.textContent = t('craft.head', { n: matches.length })
  const rows = craftList(matches, picked)
  // With no faction picked the top is mostly neutral cards; say why, since that's the advice.
  const first = rows.slice(0, 10)
  const neutral =
    state.factions.length === 0 && first.filter((r) => data.cards[r.id].faction === 'NE').length * 2 >= first.length
  els.craftIntro.textContent = `${t('craft.intro')}${neutral && first.length ? ` ${t('craft.neutral')}` : ''}`
  const { body, summary } = craftView({
    rows,
    total: matches.length,
    limit: view.limit,
    have: view.have,
    scraps: view.scraps,
    data,
    loc,
  })
  els.craftBody.innerHTML = body
  els.craftSummary.textContent = summary
}

/**
 * Says when the Similar list's own deck isn't listed, so its badges and changes aren't measured against a deck the
 * visitor can't see; offers to list it when only its provision step hides it.
 */
function renderNearNote(near: IndexedDeck | undefined, matches: IndexedDeck[]) {
  const hidden = near && !matches.includes(near)
  els.nearNote.hidden = !hidden
  if (!hidden) return
  const budgets = [...(state.budgets ?? []), near.budget]
  const byBudget = matchDecks(decks, { ...state, budgets }).includes(near)
  els.nearNote.innerHTML = byBudget
    ? `${esc(loc.t('results.thisDeckHiddenBudget'))} <button type="button" class="link" data-show-near="${esc(near.budget)}">${esc(loc.t('results.showThisDeck'))}</button>`
    : esc(loc.t('results.thisDeckHidden'))
}

function render() {
  current = facets(decks, state)
  renderFilters()
  renderResults()
  autocomplete.refresh()
}

const autocomplete = createAutocomplete({
  input: els.input,
  list: els.suggestions,
  data,
  locale: () => loc,
  candidates: () => {
    const chosen = new Set(state.picks)
    return new Map([...current.cards].filter(([id]) => !chosen.has(id)))
  },
  tagCandidates: () => new Map([...current.tags].filter(([key]) => !state.picks.includes(key))),
  authorCandidates: () => new Map([...current.authors].filter(([key]) => !state.picks.includes(`@${key}`))),
  authorName: (key) => AUTHORS.get(key) ?? key,
  onPick: addPick,
  total: () => matchCount,
  onBackspace: () => {
    const last = state.picks.at(-1)
    if (last !== undefined) removePick(last)
    else if (state.deck !== undefined) removeDeck()
    else if (state.near !== undefined) removeNear()
  },
  deckFor: (url) => {
    const first = deckById(listForUrl(decks, url))
    return first
      ? { list: first.list, name: deckName(first.deck, loc), count: LIST_SIZE.get(first.list) ?? 1 }
      : undefined
  },
  onDeck: showDeck,
})

/** Switches language: interface phrases at once, card names once the pack loads. */
async function setLanguage(lang: Lang) {
  loc = makeLocale(lang, globalThis.GDS_I18N?.[lang])
  applyStatic()
  render()
  languageMenu.refresh()
  const pack = await loadPack(lang)
  // Ignore a late load if the visitor has switched again meanwhile.
  if (pack && loc.lang === lang) {
    loc = makeLocale(lang, pack)
    applyStatic()
    render()
  }
}

const languageMenu = initLanguageMenu(
  () => loc.lang,
  (lang) => {
    writeStorage(LANG_KEY, lang)
    // Reflect the choice in the URL so a shared link opens in the same language.
    const url = new URL(location.href)
    url.searchParams.set('lang', lang)
    history.replaceState(null, '', url)
    void setLanguage(lang)
  },
)

const help = byId<HTMLDialogElement>('shortcuts')

// Where skip links (and the [ ] shortcuts) move focus.
const JUMPS: Record<string, () => HTMLElement | null> = {
  cards: () => els.input,
  filters: () => els.sources.querySelector('button'),
  results: () => els.resultHead,
  panel: () => (state.tab === 'craft' ? els.scraps : document.querySelector('[data-freq][aria-pressed="true"]')),
}

/** `list` with `item` added, or removed if it's there: a multi-select pill's click. */
const toggled = <T>(list: T[] | undefined, item: T) =>
  list?.includes(item) ? list.filter((x) => x !== item) : [...(list ?? []), item]
/** A pick from a `data-*` value: card IDs are numbers, tags and authors strings. */
const asPick = (v: string) => (/^\d+$/.test(v) ? Number(v) : v)

/**
 * What a page button does, keyed by its `data-*` attribute (camelCase, as in `dataset`); the attribute's value is the
 * argument. `fallback` is where focus goes when the button is re-rendered away and no button with the same attribute
 * and value replaces it; `at` is the button's index among those with its attribute, before the click.
 */
const ACTIONS: Record<string, { run: (value: string) => void; fallback?: (at: number) => HTMLElement | null }> = {
  skip: { run: (v) => JUMPS[v]?.()?.focus() },
  faction: {
    run: (v) => {
      const f = v as Faction
      // Exclusive: clicking switches to that faction; clicking the selected one clears it.
      autoFaction = undefined
      update({ factions: state.factions.length === 1 && state.factions[0] === f ? [] : [f] })
    },
  },
  source: { run: (v) => update({ sources: toggled(state.sources, v as Source) }) },
  budget: { run: (v) => update({ budgets: toggled(state.budgets, v as Budget) }) },
  video: { run: () => update({ video: !state.video }) },
  guideLang: { run: (v) => update({ langs: toggled(state.langs, v) }) },
  leader: { run: (v) => update({ leader: state.leader === Number(v) ? undefined : Number(v) }) },
  stratagem: { run: (v) => update({ stratagem: state.stratagem === Number(v) ? undefined : Number(v) }) },
  anyStratagem: {
    run: () => update({ stratagem: undefined }),
    fallback: () => els.stratagem.querySelector('button'),
  },
  match: { run: (v) => update({ match: v as FilterState['match'] }) },
  clearAll: { run: () => clearAll() },
  remove: { run: (v) => removePick(asPick(v)), fallback: () => els.input },
  flip: { run: (v) => flipPick(asPick(v)) },
  removeDeck: { run: () => removeDeck(), fallback: () => els.input },
  removeNear: { run: () => removeNear(), fallback: () => els.input },
  // A card added from the panel leaves it: the card below moves into its place, so focus goes there (not the card box,
  // which would scroll a phone back up and open its keyboard).
  add: {
    run: (v) => addPick(Number(v)),
    fallback: (at) => {
      const bars = els.bars.querySelectorAll<HTMLElement>('[data-add]')
      return bars[Math.min(at, bars.length - 1)] ?? JUMPS.panel()
    },
  },
  freq: {
    run: (v) => {
      view.freq = v as typeof view.freq
      renderResults()
    },
  },
  dimCommon: {
    run: () => {
      view.dimCommon = !view.dimCommon
      renderResults()
    },
  },
  expandAll: {
    run: () => {
      for (const id of shown) {
        if (allOpen) view.expanded.delete(id)
        else view.expanded.add(id)
      }
      renderResults()
    },
  },
  toggle: {
    run: (id) => {
      if (!view.expanded.delete(id)) view.expanded.add(id)
      renderResults()
    },
  },
  near: { run: (id) => showNear(id), fallback: () => els.resultHead },
  showNear: {
    run: (v) => {
      update({ budgets: [...(state.budgets ?? []), v as Budget] })
      // The button is gone once This deck is listed; it leads the results.
      els.resultHead.focus()
    },
  },
  more: {
    run: () => {
      view.limit += PAGE
      renderResults()
      // Continue reading where the new rows start, rather than on the button that moved below them.
      const rows =
        state.tab === 'craft'
          ? els.craftBody.querySelectorAll('[data-craft-pick]')
          : els.results.querySelectorAll('[data-toggle]')
      ;(rows[view.limit - PAGE] as HTMLElement | undefined)?.focus()
    },
  },
  tab: { run: (v) => update({ tab: v === 'craft' ? 'craft' : undefined }, { push: true }) },
  // A Craft card's name lists the decks that run it; Back returns to the list.
  craftPick: {
    run: (v) => {
      update({ picks: [...state.picks, Number(v)], deck: undefined, tab: undefined }, { push: true })
      els.resultHead.focus()
    },
  },
}

// Have it: a checkbox, so it's handled on change; re-rendering replaces it, so focus goes to its new copy.
document.addEventListener('change', (e) => {
  const box = e.target as HTMLInputElement
  if (!box.dataset?.have) return
  const id = Number(box.dataset.have)
  if (box.checked) view.have.add(id)
  else view.have.delete(id)
  renderResults()
  document.querySelector<HTMLElement>(`[data-have="${id}"]`)?.focus()
})
els.scraps.addEventListener('input', () => {
  const n = els.scraps.valueAsNumber
  view.scraps = Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
  renderResults()
})

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('button')
  const key = t && Object.keys(t.dataset).find((k) => Object.hasOwn(ACTIONS, k))
  if (!t || !key) return
  const value = t.dataset[key] ?? ''
  const attr = `data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
  const at = [...document.querySelectorAll(`[${attr}]`)].indexOf(t)
  ACTIONS[key].run(value)
  // Re-rendering replaced the button: focus its new copy (or the nearest control) so keyboard users keep their place.
  // An action that placed focus itself is left alone.
  const lost = !document.activeElement || document.activeElement === document.body
  if (t.isConnected || !lost) return
  ;(document.querySelector<HTMLElement>(`[${attr}="${CSS.escape(value)}"]`) ?? ACTIONS[key].fallback?.(at))?.focus()
})
// Page shortcuts, outside text fields. Each matches the printed key, then the physical key, so layouts without
// / [ ] (e.g. Russian) still work.
// shortcut: single-key shortcuts can't be turned off (WCAG 2.1.4), add a toggle once user settings exist.
const SHORTCUTS: [matches: (e: KeyboardEvent) => boolean, run: () => void][] = [
  [(e) => e.key === '?', () => (help.open ? help.close() : help.showModal())],
  [(e) => e.key === '/' || (e.code === 'Slash' && !e.shiftKey), () => els.input.focus()],
  [(e) => e.key === '[' || (e.code === 'BracketLeft' && !e.shiftKey), () => JUMPS.filters()?.focus()],
  [(e) => e.key === ']' || (e.code === 'BracketRight' && !e.shiftKey), () => JUMPS.panel()?.focus()],
  [
    (e) => e.key === 'Backspace' && e.shiftKey,
    () => {
      const was = document.activeElement
      clearAll()
      // A cleared pill was re-rendered away; start the next search from the card box.
      if (!was?.isConnected) els.input.focus()
    },
  ],
]
document.addEventListener('keydown', (e) => {
  // IME composition (Japanese, Korean, Chinese) sends keydowns mid-word.
  if (e.isComposing || e.key === 'Process') return
  // AltGr reports Ctrl+Alt (German and Polish need it for [ ]); any other modifier belongs to the browser.
  if (e.metaKey || e.ctrlKey !== e.altKey) return
  if ((e.target as HTMLElement).closest('input, select, textarea, [contenteditable]')) return
  // In a dialog only ? (closing the help) works; Esc is the dialog's own.
  const dialog = document.querySelector('dialog[open]')
  if (dialog && !(dialog === help && e.key === '?')) return
  const hit = SHORTCUTS.find(([matches]) => matches(e))
  if (!hit) return
  e.preventDefault()
  hit[1]()
})
window.addEventListener('hashchange', () => {
  beforeNear = undefined
  state = readHash()
  autoFaction = undefined
  view.limit = PAGE
  render()
})

initDisplayMenu()
void setLanguage(loc.lang)
if (unknownDeck) {
  els.input.value = unknownDeck
  els.input.dispatchEvent(new Event('input'))
  // Selected, as after a paste, so typing or pasting replaces it.
  els.input.focus()
  els.input.select()
}

// Credits and Help: a native <dialog> handles Esc and focus; a click on the backdrop (the dialog
// itself) closes it too.
for (const id of ['credits', 'shortcuts']) {
  const dialog = byId<HTMLDialogElement>(id)
  byId(`${id}-open`).addEventListener('click', () => dialog.showModal())
  byId(`${id}-close`).addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close()
  })
}
