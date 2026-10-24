/**
 * Draws the page from {@link session}: the static text in the page language, the filters, and the deck list or the
 * Craft list with the bar and panel around them. Writes only to the DOM; the HTML comes from the pure builders in
 * this folder.
 */
import { CONFIG } from '../config.ts'
import { AUTHORS, data, deckById, decks, LANGS, LEADERS, STRATAGEMS } from '../data.ts'
import {
  cardChanges,
  cardFrequency,
  craftList,
  deckBody,
  hits,
  type IndexedDeck,
  matchDecks,
  overlap,
  pickedCards,
  sharedCards,
  wantedPicks,
} from '../filter.ts'
import { session } from '../session.ts'
import { craftView } from './craft.ts'
import { byId, esc } from './dom.ts'
import { type FilterRows, filterRows } from './filters.ts'
import { GLYPHS, type IconName, icon } from './icons.ts'
import { barsHtml } from './panel.ts'
import { deckName, deckRow } from './results.ts'

export const els = {
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
  resultBar: document.querySelector('.result-bar') as HTMLElement,
  copyStatus: byId('copy-status'),
  shareFallback: byId('share-fallback'),
  shareUrl: byId<HTMLInputElement>('share-url'),
  filters: byId('filters'),
  filtersToggle: byId<HTMLButtonElement>('filters-toggle'),
  opponentToggle: byId<HTMLButtonElement>('opponent-toggle'),
  panelToggle: byId<HTMLButtonElement>('panel-toggle'),
}

// The filters stay pinned on wide screens, and focus scrolled into view (Tab, shortcuts) would land under them: the
// page keeps their height so the stylesheet's scroll-padding leaves room for it (WCAG 2.4.11, focus not obscured).
// The results bar is pinned under them on wide screens, so it counts too.
const pinned = new ResizeObserver((entries) => {
  for (const { target, borderBoxSize } of entries) {
    const name = target === els.filters ? '--filters-height' : '--result-bar-height'
    document.documentElement.style.setProperty(name, `${borderBoxSize[0].blockSize}px`)
  }
})
pinned.observe(els.filters)
pinned.observe(els.resultBar)

/** The repository's page for this language's guide: each translated README links on to the full English guide. */
const guideUrl = (lang: string) =>
  `${CONFIG.repoUrl}/blob/main/docs/${lang === 'en' ? 'guide.md' : `README.${lang}.md`}`

/** Translates the static page: `data-i18n` (text) and `data-i18n-{title,label,placeholder}` attributes, and links. */
export function applyStatic() {
  const { loc } = session
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
  for (const el of document.querySelectorAll<HTMLAnchorElement>('[data-repo]')) {
    el.href = `${CONFIG.repoUrl}${el.dataset.repo}`
  }
  // The threshold is a build setting, so Help reads it rather than repeating the number.
  byId('help-similar').textContent = t('help.similar1', { n: CONFIG.similarMinShared })
  // Help's ≈ ↗ ▶ ✕ ⧉ ✎ drawn as the icons on the buttons they name (the symbol stays, for screen readers), and the - typed to exclude like a key (a lone -, so hyphenated
  // words like Gameplay-Video stay as they are): easy to spot, in every language.
  for (const el of byId('shortcuts').querySelectorAll<HTMLElement>('summary, li')) {
    el.innerHTML = esc(el.textContent ?? '')
      .replace(/[≈↗▶✕⧉✎]/g, (g) => `<span class="glyph">${icon(GLYPHS[g])}<span class="sr-only">${g}</span></span>`)
      .replace(/(?<![\p{L}\p{N}])-(?![\p{L}\p{N}])/gu, '<kbd class="glyph">-</kbd>')
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-icon]'))
    el.innerHTML = icon(el.dataset.icon as IconName)
  const version = byId<HTMLAnchorElement>('version')
  version.textContent = t('credits.version', { version: __VERSION__ })
  version.href = `${CONFIG.repoUrl}/releases${__VERSION__ === 'dev' ? '' : `/tag/${__VERSION__}`}`
  byId<HTMLAnchorElement>('help-readme').href = guideUrl(loc.lang)
  // CDPR's site has every language we do, under the same codes in lower case (pt-br, zh-cn).
  byId<HTMLAnchorElement>('fan-content').href = `https://www.cdprojektred.com/${loc.lang.toLowerCase()}/fan-content`
  sizeFilterLabels()
  // UTC: players are worldwide and Gwent updates land around midnight UTC, so everyone sees the same moment.
  const scraped = `${new Date(data.scrapedAt).toLocaleString(loc.lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC', hourCycle: 'h23' })} UTC`
  els.meta.textContent = `${t('meta.decks', { n: decks.length })} · ${t('meta.dataAsOf', { date: scraped })}`
}

/** Sizes the filter label column to the longest label in this language (Russian labels are much longer). */
function sizeFilterLabels() {
  const { filters } = els
  filters.style.setProperty('--label-width', 'max-content')
  const labels = [...filters.querySelectorAll<HTMLElement>('.label')]
  const em = Number.parseFloat(getComputedStyle(labels[0]).fontSize)
  const widest = Math.max(...labels.map((l) => l.offsetWidth)) / em
  const { min, max } = CONFIG.filterLabelEm
  // In em, so it scales with the Display text-size setting; the 0.1em keeps the widest label off the pill beside it.
  filters.style.setProperty('--label-width', `${Math.min(Math.max(widest, min), max) + 0.1}em`)
}

/** A pick's name in the page language. */
export const pickName = (pick: number | string) =>
  typeof pick === 'number'
    ? session.loc.card(pick)
    : pick.startsWith('@')
      ? (AUTHORS.get(pick.slice(1)) ?? pick)
      : session.loc.tag(pick)

/** Draws the filter rows, the Search box's chips and the note under them. */
export function renderFilters() {
  const { state, current, loc, memory, view } = session
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
  // Phones fold rows the way a match goes: faction and leader once a leader is picked, the stratagem once it's picked or
  // a card is added; desktop CSS ignores all of this.
  const compact = state.leader !== undefined && !view.opponentOpen
  const answered = state.stratagem !== undefined || state.picks.length > 0
  const hideStratagem = !view.opponentOpen && (state.leader !== undefined ? answered : state.stratagem === undefined)
  els.filters.classList.toggle('folded', !view.filtersOpen)
  els.filters.classList.toggle('opponent-folded', compact)
  els.filters.classList.toggle('stratagem-folded', hideStratagem)
  els.filters.classList.toggle('has-faction', state.factions.length > 0)
  els.filtersToggle.setAttribute('aria-expanded', String(view.filtersOpen))
  // Desktop scrolled into the decks: both lines show, folded, the opponent's whenever any of it is set.
  const opponentSet = state.factions.length > 0 || state.leader !== undefined || state.stratagem !== undefined
  els.filters.classList.toggle('pinned-compact', view.pinnedCompact)
  els.opponentToggle.hidden = view.pinnedCompact ? !opponentSet : state.leader === undefined
  els.opponentToggle.setAttribute('aria-expanded', String(!compact && !view.pinnedCompact))
  if (view.pinnedCompact) els.filtersToggle.setAttribute('aria-expanded', 'false')
  els.deckNote.hidden = !(deck && memory.deckReplaced)
  els.deckNote.textContent = loc.t('cards.deckReplaced')
}

/** Draws what's under the filters: the deck list or the Craft list, for the decks that match. */
export function renderResults() {
  const { state, loc } = session
  const matches = matchDecks(decks, state, undefined, (d) => deckName(d, loc))
  session.matchCount = matches.length
  // A link shown to copy by hand is for the search it was made from.
  els.shareFallback.hidden = true
  const picked = pickedCards(wantedPicks(state))
  const crafting = state.tab === 'craft'
  showTab(crafting)
  if (crafting) return renderCraft(matches, picked)
  const near = deckById(state.near)
  renderDeckList(matches, near)
  renderResultBar(near)
  renderPanel(matches, picked)
  renderNearNote(near, matches)
}

/**
 * Shows the deck list or the Craft list, with the controls that belong to it.
 *
 * @param crafting - Whether the Craft tab is on
 */
function showTab(crafting: boolean) {
  for (const b of els.tab.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
    b.setAttribute('aria-pressed', String((b.dataset.tab === 'craft') === crafting))
  }
  els.craft.hidden = !crafting
  // The panel would repeat the Craft list, and the deck list's buttons have nothing to act on.
  for (const el of [els.results, els.panel, els.dimCommon, els.expandAll, els.skipPast]) el.hidden = crafting
  if (crafting) els.nearNote.hidden = true
}

/**
 * Draws one page of deck rows, with the count above and Show more below; an empty list says why.
 *
 * @param matches - Decks the filters keep, in order
 * @param near - The deck a Similar list is ranked against
 */
function renderDeckList(matches: IndexedDeck[], near: IndexedDeck | undefined) {
  const { state, view, loc } = session
  const { t } = loc
  els.resultHead.textContent = t('results.count', { n: matches.length })
  // Cards carrying a selected tag are highlighted too, so an expanded deck shows why it matched.
  const wanted = wantedPicks(state)
  const tagged = Object.keys(data.cards)
    .map(Number)
    .filter((id) => data.cards[id].tags?.some((k) => wanted.includes(k)))
  const selected = new Set([...pickedCards(wanted), ...tagged])
  // Count, dimming and the card panel describe every match; only the rows are paged (Expand all covers those).
  const page = matches.slice(0, view.limit)
  // Any ranks decks by how many picks they have; with two or more, each row says so.
  const ranked = state.match === 'any' && wanted.length > 1
  session.shown = page.map((e) => e.deck.id)
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
      e.list === state.deck,
      ranked ? { n: hits(e, state), of: wanted.length } : undefined,
    ),
  )
  if (matches.length > view.limit) {
    const n = Math.min(CONFIG.resultsPageSize, matches.length - view.limit)
    rows.push(
      `<li class="more"><button type="button" class="clear" data-more="1">${esc(t('results.showMore', { n }))}</button></li>`,
    )
  }
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
 * Sets the results bar's buttons for the rows just drawn: Expand/Collapse all, and Dim common (Show changes in a
 * Similar list).
 *
 * @param near - The deck a Similar list is ranked against
 */
function renderResultBar(near: IndexedDeck | undefined) {
  const { view, loc, shown } = session
  const { t } = loc
  session.allOpen = shown.length > 0 && shown.every((id) => view.expanded.has(id))
  els.expandAll.textContent = t(session.allOpen ? 'results.collapseAll' : 'results.expandAll')
  els.expandAll.disabled = shown.length === 0
  els.dimCommon.setAttribute('aria-pressed', String(view.dimCommon))
  els.dimCommon.textContent = t(near ? 'results.showChanges' : 'results.dimCommon')
  els.dimCommon.title = t(near ? 'results.showChangesTip' : 'results.dimCommonTip')
  // This deck may be filtered out (≈ hides Over decks), but the others can still be compared with it.
  els.dimCommon.disabled = near ? !shown.some((id) => id !== near.deck.id) : shown.length < 2
}

/**
 * Draws the Most/Least common panel.
 *
 * @param matches - Decks the filters keep
 * @param picked - Cards picked in the search, left out of the panel
 */
function renderPanel(matches: IndexedDeck[], picked: number[]) {
  const { view, loc } = session
  els.panel.classList.toggle('folded', !view.panelOpen)
  els.panelToggle.setAttribute('aria-expanded', String(view.panelOpen))
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-freq]')) {
    b.setAttribute('aria-pressed', String(b.dataset.freq === view.freq))
  }
  els.panelHead.textContent = loc.t('freq.inDecks', { n: matches.length })
  els.bars.innerHTML = barsHtml(
    cardFrequency(matches, picked, data.cards, view.freq, loc.card),
    matches.length,
    data,
    loc,
  )
}

/**
 * Renders the Craft list for the matching decks.
 *
 * @param matches - Decks the filters keep
 * @param picked - Cards picked in the search, which every match already has (with All) or the player chose
 */
function renderCraft(matches: IndexedDeck[], picked: number[]) {
  const { state, view, loc } = session
  const { t } = loc
  els.resultHead.textContent = t('craft.head', { n: matches.length })
  const rows = craftList(matches, picked, data.cards, loc.card)
  // With no faction picked the top is mostly neutral cards; say why, since that's the advice.
  const top = rows.slice(0, CONFIG.craftNeutralSample)
  const neutral =
    state.factions.length === 0 &&
    top.length > 0 &&
    top.filter((r) => data.cards[r.id].faction === 'NE').length * 2 >= top.length
  els.craftIntro.textContent = `${t('craft.intro')}${neutral ? ` ${t('craft.neutral')}` : ''}`
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
 *
 * @param near - The deck a Similar list is ranked against
 * @param matches - Decks the filters keep
 */
function renderNearNote(near: IndexedDeck | undefined, matches: IndexedDeck[]) {
  const { state, loc } = session
  const hidden = near && !matches.includes(near)
  els.nearNote.hidden = !hidden
  if (!hidden) return
  const budgets = [...(state.budgets ?? []), near.budget]
  const byBudget = matchDecks(decks, { ...state, budgets }).includes(near)
  els.nearNote.innerHTML = byBudget
    ? `${esc(loc.t('results.thisDeckHiddenBudget'))} <button type="button" class="link" data-show-near="${esc(near.budget)}">${esc(loc.t('results.showThisDeck'))}</button>`
    : esc(loc.t('results.thisDeckHidden'))
}
