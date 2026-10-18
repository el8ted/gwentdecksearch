import dataJson from '../data/decks.json'
import { CARD_ART } from './art.ts'
import { CONFIG } from './config.ts'
import {
  authorNames,
  BUDGETS,
  type Budget,
  budgetSide,
  cardFrequency,
  type FilterState,
  facets,
  indexDecks,
  matchDecks,
  pickedCards,
  sharedCards,
  singleFaction,
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
import { type Card, type Dataset, FACTIONS, type Faction, SOURCES, type Source } from './types.ts'
import { createAutocomplete } from './ui/autocomplete.ts'
import { initDisplayMenu } from './ui/display-menu.ts'
import { byId, esc, readStorage, writeStorage } from './ui/dom.ts'
import { initLanguageMenu } from './ui/language-menu.ts'
import { deckRow, sourceLabel } from './ui/results.ts'

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
  clear: byId('clear'),
  match: byId('match'),
  resultHead: byId('result-head'),
  results: byId('results'),
  panelHead: byId('panel-head'),
  bars: byId('bars'),
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
const readHash = () =>
  decodeState(
    location.hash,
    (id) => data.cards[id],
    (key) => Object.hasOwn(data.tags, key),
    (key) => AUTHORS.has(key),
  )
let state: FilterState = readHash()
// The faction pill that adding a card turned on (see addCard); a pill click makes the choice the visitor's own.
// Not in the hash: after a reload the pill simply stays.
let autoFaction: Faction | undefined
let current = facets(decks, state)
const expanded = new Set<string>()
// Side-panel ordering; a view choice, so it isn't stored in the URL.
let freq: 'most' | 'least' = 'most'
// Deck IDs currently listed, for Expand/Collapse all.
let shown: string[] = []
let allOpen = false
// Dim cards every listed deck shares, so each deck's distinctive cards stand out; a view choice.
let dimCommon = false
// Deck rows rendered; "Show more" adds PAGE at a time so a phone isn't handed 2,000+ rows at once.
const PAGE = CONFIG.resultsPageSize
let limit = PAGE

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
  const version = byId<HTMLAnchorElement>('version')
  version.textContent = t('credits.version', { version: __VERSION__ })
  version.href = `https://github.com/el8ted/gwentdecksearch/releases${__VERSION__ === 'dev' ? '' : `/tag/${__VERSION__}`}`
  // The README for this language; each one links on to the full English guide.
  byId<HTMLAnchorElement>('help-readme').href =
    loc.lang === 'en'
      ? 'https://github.com/el8ted/gwentdecksearch#readme'
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
  limit = PAGE
  const hash = encodeState(state)
  const url = hash || location.pathname + location.search
  // Filter tweaks replace the entry so they don't flood the back button; Clear all pushes one, so Back undoes it.
  if (push && hash !== before) history.pushState(null, '', url)
  else history.replaceState(null, '', url)
  render()
}

function clearAll() {
  expanded.clear()
  dimCommon = false
  autoFaction = undefined
  update({ ...EMPTY_STATE, match: state.match, leader: undefined, stratagem: undefined }, { push: true })
}

/**
 * Adds a card or tag after the other picks; a faction card also selects its faction when none is selected (undone by
 * {@link removePick}).
 */
function addPick(pick: number | string) {
  if (state.picks.includes(pick)) return
  const picks = [...state.picks, pick]
  const faction = typeof pick === 'number' ? singleFaction(data.cards[pick]) : undefined
  if (faction && state.factions.length === 0) {
    autoFaction = faction
    update({ picks, factions: [faction] })
  } else update({ picks })
}

/** Removes a card or tag; a faction a card selected is cleared again once no card of that faction remains. */
function removePick(pick: number | string) {
  const picks = state.picks.filter((p) => p !== pick)
  const undo =
    autoFaction !== undefined && !pickedCards(picks).some((c) => singleFaction(data.cards[c]) === autoFaction)
  if (undo) autoFaction = undefined
  update({ picks, ...(undo && { factions: [] }) })
}

/** A pick's name in the page language. */
const pickName = (pick: number | string) =>
  typeof pick === 'number'
    ? loc.card(pick)
    : pick.startsWith('@')
      ? (AUTHORS.get(pick.slice(1)) ?? pick)
      : loc.tag(pick)

/** A single-select pill for a leader or stratagem; clicking the selected one clears it. */
function cardPill(attr: 'leader' | 'stratagem', id: number, counts: Map<number, number>, selected?: number) {
  const n = counts.get(id) ?? 0
  const name = esc(loc.card(id))
  const attrs = `data-${attr}="${id}" aria-pressed="${id === selected}" title="${name} (${n})"`
  const cls = `pill f-${data.cards[id].faction}${n ? '' : ' empty'}`
  // Art is the same in every language and keeps tiles one size; the name stays in the label and tooltip.
  // A card without one (added since scripts/card-art.py last ran) shows its name.
  if (CARD_ART.has(id)) {
    return `<button type="button" class="${cls} art" ${attrs} aria-label="${name} (${n})"><img src="icons/${attr[0]}-${id}.webp" alt="" /><span>${n}</span></button>`
  }
  return `<button type="button" class="${cls}" ${attrs}>${name}<span>${n}</span></button>`
}

function renderFilters() {
  const { t } = loc
  for (const b of els.match.querySelectorAll<HTMLButtonElement>('[data-match]')) {
    b.setAttribute('aria-pressed', String(b.dataset.match === (state.match ?? 'all')))
  }
  els.factions.innerHTML = FACTIONS.map((f) => {
    const n = current.factions.get(f) ?? 0
    const title = `${t(`faction.${f}`)} (${n})`
    return `<button type="button" class="pill f-${f}${n ? '' : ' empty'}" data-faction="${f}" aria-pressed="${state.factions.includes(f)}" title="${esc(title)}">${f}<span>${n}</span></button>`
  }).join('')
  els.sources.innerHTML = SOURCES.map((src) => {
    const n = current.sources.get(src) ?? 0
    const on = !!state.sources?.includes(src)
    const label = esc(sourceLabel(src, loc))
    return `<button type="button" class="pill s-${src}${n ? '' : ' empty'}" data-source="${src}" aria-pressed="${on}" title="${label} (${n})">${label}<span>${n}</span></button>`
  }).join('')
  // Spare [3+][2][1] · [Exact] · Over [1][2][3+]: each side's word labels its steps, and a group never splits
  // across lines on phones.
  els.budgets.innerHTML = (['spare', 'exact', 'over'] as const)
    .map((side) => {
      const pills = BUDGETS.filter((b) => budgetSide(b) === side).map((b) => {
        const n = current.budgets.get(b) ?? 0
        const on = !!state.budgets?.includes(b)
        const step = b === 'exact' ? '' : b.endsWith('3') ? '3+' : b.slice(-1)
        const label = esc(step ? `${t(`budget.${side}`)} ${step}` : t('budget.exact'))
        return `<button type="button" class="pill b-${side}${n ? '' : ' empty'}" data-budget="${b}" aria-pressed="${on}" aria-label="${label} (${n})" title="${label} (${n})">${step || label}<span>${n}</span></button>`
      })
      const word =
        side === 'exact' ? '' : `<span class="pill-group-label" aria-hidden="true">${esc(t(`budget.${side}`))}</span>`
      return `<span class="pill-group">${side === 'over' ? '' : word}${pills.join('')}${side === 'over' ? word : ''}</span>`
    })
    .join('')
  const langName = new Intl.DisplayNames(loc.lang, { type: 'language' })
  const video = `<button type="button" class="pill${current.videos ? '' : ' empty'}" data-video="1" aria-pressed="${!!state.video}" aria-label="${esc(t('results.hasVideo'))} (${current.videos})" title="${esc(t('results.hasVideoTip'))} (${current.videos})">▶ ${esc(t('results.hasVideo'))}<span>${current.videos}</span></button>`
  els.media.innerHTML =
    video +
    LANGS.map((l) => {
      const n = current.langs.get(l) ?? 0
      const label = esc(t('filter.langTip', { lang: langName.of(l) ?? l }))
      return `<button type="button" class="pill${n ? '' : ' empty'}" data-guide-lang="${l}" aria-pressed="${!!state.langs?.includes(l)}" aria-label="${label} (${n})" title="${label} (${n})">${l.split('-')[0].toUpperCase()}<span>${n}</span></button>`
    }).join('')
  // Leaders only make sense within one faction: the selected one, else the selected leader's (from a shared link).
  const faction =
    state.factions.length === 1
      ? state.factions[0]
      : state.leader !== undefined
        ? data.cards[state.leader].faction
        : undefined
  els.leader.innerHTML = faction
    ? LEADERS.filter((id) => data.cards[id].faction === faction)
        .map((id) => cardPill('leader', id, current.leaders, state.leader))
        .join('') +
      // Named here too: on touch screens an icon has no tooltip.
      (state.leader === undefined ? '' : `<strong class="picked">${esc(loc.card(state.leader))}</strong>`)
    : `<span class="hint">${esc(t('leader.pickFaction'))}</span>`
  const stratagems = (ids: number[]) =>
    `<div class="pills">${ids.map((id) => cardPill('stratagem', id, current.stratagems, state.stratagem)).join('')}</div>`
  // Every faction's stratagem stays, other factions' at 0 (dimmed), so the row never reshapes.
  const own = FACTIONS.flatMap((f) => STRATAGEMS.filter((id) => data.cards[id].faction === f))
  els.stratagem.innerHTML = stratagems(STRATAGEMS.filter((id) => data.cards[id].faction === 'NE')) + stratagems(own)
  // Stratagems are swapped freely, so the same list often appears under another stratagem.
  const others =
    state.stratagem === undefined
      ? 0
      : [...current.stratagems].reduce((n, [id, c]) => (id === state.stratagem ? n : n + c), 0)
  els.stratagemNote.innerHTML =
    state.stratagem === undefined
      ? esc(t('stratagem.caution'))
      : // Named here too: on touch screens an icon has no tooltip.
        `<strong>${esc(loc.card(state.stratagem))}</strong> · ${esc(t('stratagem.swapped'))}${others ? ` ${esc(t('stratagem.others', { n: others }))}` : ''} <button type="button" class="link" data-any-stratagem="1">${esc(t('stratagem.any'))}</button>`
  els.chips.innerHTML = state.picks
    .map((pick) => {
      const remove = `<button type="button" data-remove="${esc(String(pick))}" aria-label="${esc(t('cards.remove', { name: pickName(pick) }))}">✕</button>`
      if (typeof pick === 'string') {
        const mark = pick.startsWith('@') ? '✎' : '#'
        return `<li class="chip tag"><span aria-hidden="true">${mark}</span>${esc(pickName(pick))}${remove}</li>`
      }
      const card = data.cards[pick]
      const dual = card.secondaryFaction ? ` dual f2-${card.secondaryFaction}` : ''
      return `<li class="chip f-${card.faction}${dual}">${esc(loc.card(pick))}${remove}</li>`
    })
    .join('')
}

function renderBars(rows: [number, number][], total: number) {
  els.panelHead.textContent = loc.t('freq.inDecks', { n: total })
  els.bars.innerHTML = rows.length
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

function renderResults() {
  const { t } = loc
  // Cards carrying a selected tag are highlighted too, so an expanded deck shows why it matched.
  const cards = pickedCards(state.picks)
  const tagged = Object.keys(data.cards)
    .map(Number)
    .filter((id) => data.cards[id].tags?.some((k) => state.picks.includes(k)))
  const selected = new Set([...cards, ...tagged])
  const matches = matchDecks(decks, state)
  els.resultHead.textContent = t('results.count', { n: matches.length })
  // Count, dimming and the card panel describe every match; only the rows are paged (Expand all covers those).
  const page = matches.slice(0, limit)
  shown = page.map((e) => e.deck.id)
  // One deck shares everything with itself, so dimming needs at least two.
  const common = dimCommon && matches.length > 1 ? sharedCards(matches) : new Set<number>()
  const rows = page.map((e) => deckRow(e, data, selected, expanded.has(e.deck.id), common, loc))
  if (matches.length > limit) {
    const n = Math.min(PAGE, matches.length - limit)
    rows.push(
      `<li class="more"><button type="button" class="clear" data-more="1">${esc(t('results.showMore', { n }))}</button></li>`,
    )
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-freq]')) {
    b.setAttribute('aria-pressed', String(b.dataset.freq === freq))
  }
  renderBars(cardFrequency(matches, cards, freq), matches.length)
  allOpen = shown.length > 0 && shown.every((id) => expanded.has(id))
  els.expandAll.textContent = t(allOpen ? 'results.collapseAll' : 'results.expandAll')
  els.expandAll.disabled = shown.length === 0
  els.dimCommon.setAttribute('aria-pressed', String(dimCommon))
  els.dimCommon.disabled = shown.length < 2
  const last = state.picks.at(-1)
  els.results.innerHTML = rows.length
    ? rows.join('')
    : `<li class="empty-state">${esc(t('results.none'))}${
        last === undefined
          ? ''
          : ` <button type="button" class="link" data-remove="${esc(String(last))}">${esc(t('results.removeCard', { name: pickName(last) }))}</button>`
      }</li>`
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
  onBackspace: () => {
    const last = state.picks.at(-1)
    if (last !== undefined) removePick(last)
  },
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

// Buttons that renderFilters/renderBars/renderResults re-create, as [dataset key, attribute].
const FOCUS_KEYS = [
  ['faction', 'data-faction'],
  ['source', 'data-source'],
  ['budget', 'data-budget'],
  ['video', 'data-video'],
  ['guideLang', 'data-guide-lang'],
  ['toggle', 'data-toggle'],
  ['remove', 'data-remove'],
  ['add', 'data-add'],
  ['anyStratagem', 'data-any-stratagem'],
  ['leader', 'data-leader'],
  ['stratagem', 'data-stratagem'],
] as const
const help = byId<HTMLDialogElement>('shortcuts')

// Where skip links (and the [ ] shortcuts) move focus.
const JUMPS: Record<string, () => HTMLElement | null> = {
  cards: () => els.input,
  filters: () => els.sources.querySelector('button'),
  results: () => els.resultHead,
  panel: () => document.querySelector('[data-freq][aria-pressed="true"]'),
}

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('button')
  if (!t) return
  if (t.dataset.skip) return JUMPS[t.dataset.skip]?.()?.focus()
  const { faction, source, budget, leader, stratagem, remove, add, toggle, anyStratagem, match, more } = t.dataset
  // A card added from the panel leaves it: the card below moves into its place, so focus goes there (not the card box,
  // which would scroll a phone back up and open its keyboard).
  const barAt = add ? [...els.bars.querySelectorAll('[data-add]')].indexOf(t) : -1
  if (t.dataset.freq) {
    freq = t.dataset.freq as typeof freq
    renderResults()
  } else if (t.dataset.video) update({ video: !state.video })
  else if (t.dataset.guideLang) {
    const l = t.dataset.guideLang
    const on = state.langs ?? []
    update({ langs: on.includes(l) ? on.filter((x) => x !== l) : [...on, l] })
  } else if (t === els.dimCommon) {
    dimCommon = !dimCommon
    renderResults()
  } else if (t === els.expandAll) {
    if (allOpen) for (const id of shown) expanded.delete(id)
    else for (const id of shown) expanded.add(id)
    renderResults()
  } else if (anyStratagem) update({ stratagem: undefined })
  else if (leader) update({ leader: state.leader === Number(leader) ? undefined : Number(leader) })
  else if (stratagem) update({ stratagem: state.stratagem === Number(stratagem) ? undefined : Number(stratagem) })
  else if (budget) {
    const b = budget as Budget
    const on = state.budgets ?? []
    update({ budgets: on.includes(b) ? on.filter((x) => x !== b) : [...on, b] })
  } else if (source) {
    const src = source as Source
    const on = state.sources ?? []
    update({ sources: on.includes(src) ? on.filter((x) => x !== src) : [...on, src] })
  } else if (match) update({ match: match as FilterState['match'] })
  else if (faction) {
    const f = faction as Faction
    // Exclusive: clicking switches to that faction; clicking the selected one clears it.
    autoFaction = undefined
    update({ factions: state.factions.length === 1 && state.factions[0] === f ? [] : [f] })
  } else if (remove) removePick(/^\d+$/.test(remove) ? Number(remove) : remove)
  else if (add) addPick(Number(add))
  else if (toggle) {
    if (!expanded.delete(toggle)) expanded.add(toggle)
    renderResults()
  } else if (t === els.clear) clearAll()
  else if (more) {
    limit += PAGE
    renderResults()
    // Continue reading where the new rows start, rather than on the button that moved below them.
    els.results.querySelectorAll<HTMLElement>('[data-toggle]')[limit - PAGE]?.focus()
  }
  // Re-rendering replaced the button: focus its new copy (or the nearest control) so keyboard users keep their place.
  const key = FOCUS_KEYS.find(([k]) => t.dataset[k] !== undefined)
  if (key && !t.isConnected) {
    const [k, attr] = key
    if (barAt >= 0) {
      const bars = els.bars.querySelectorAll<HTMLElement>('[data-add]')
      return (bars[Math.min(barAt, bars.length - 1)] ?? JUMPS.panel())?.focus()
    }
    const fallback =
      k === 'anyStratagem'
        ? els.stratagem.querySelector('button')
        : k === 'remove' || k === 'add'
          ? els.input
          : undefined
    ;(document.querySelector<HTMLElement>(`[${attr}="${CSS.escape(t.dataset[k] ?? '')}"]`) ?? fallback)?.focus()
  }
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
  state = readHash()
  autoFaction = undefined
  limit = PAGE
  render()
})

initDisplayMenu()
void setLanguage(loc.lang)

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
