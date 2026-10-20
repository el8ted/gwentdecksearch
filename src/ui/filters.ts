import { CARD_ART } from '../art.ts'
import { BUDGETS, budgetSide, type Facets, type FilterState, type IndexedDeck } from '../filter.ts'
import type { Locale } from '../i18n.ts'
import { type Dataset, FACTIONS, SOURCES } from '../types.ts'
import { esc } from './dom.ts'
import { deckName, sourceLabel } from './results.ts'

/** What the filter rows are drawn from. */
export interface FilterContext {
  state: FilterState
  /** Deck counts per option. */
  facets: Facets
  data: Dataset
  loc: Locale
  /** Every leader and stratagem in card ID order, and the languages any deck has: fixed, so pills never move. */
  leaders: number[]
  stratagems: number[]
  langs: string[]
  /** A pick's name in the page language. */
  pickName: (pick: number | string) => string
  /** The deck a pasted link points to ({@link FilterState.deck}). */
  deck?: IndexedDeck
  /** The deck a Similar list is ranked against ({@link FilterState.near}). */
  near?: IndexedDeck
}

/** Each filter row's HTML, keyed like the elements it fills. */
export interface FilterRows {
  factions: string
  sources: string
  budgets: string
  media: string
  leader: string
  stratagem: string
  stratagemNote: string
  chips: string
}

/**
 * Renders the filter rows and the Search box's chips.
 *
 * @param c - State, counts and lookups
 * @returns HTML per row
 */
export function filterRows(c: FilterContext): FilterRows {
  const { state, facets: current, data, loc } = c
  const { t } = loc
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
  const factions = FACTIONS.map((f) => {
    const n = current.factions.get(f) ?? 0
    const title = `${t(`faction.${f}`)} (${n})`
    return `<button type="button" class="pill f-${f}${n ? '' : ' empty'}" data-faction="${f}" aria-pressed="${state.factions.includes(f)}" title="${esc(title)}">${f}<span>${n}</span></button>`
  }).join('')
  const sources = SOURCES.map((src) => {
    const n = current.sources.get(src) ?? 0
    const on = !!state.sources?.includes(src)
    const label = esc(sourceLabel(src, loc))
    return `<button type="button" class="pill s-${src}${n ? '' : ' empty'}" data-source="${src}" aria-pressed="${on}" title="${label} (${n})">${label}<span>${n}</span></button>`
  }).join('')
  // Spare [3+][2][1] · [Exact] · Over [1][2][3+]: each side's word labels its steps, and a group never splits
  // across lines on phones.
  const budgets = (['spare', 'exact', 'over'] as const)
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
  const media =
    video +
    c.langs
      .map((l) => {
        const n = current.langs.get(l) ?? 0
        const label = esc(t('filter.langTip', { lang: langName.of(l) ?? l }))
        return `<button type="button" class="pill${n ? '' : ' empty'}" data-guide-lang="${l}" aria-pressed="${!!state.langs?.includes(l)}" aria-label="${label} (${n})" title="${label} (${n})">${l.split('-')[0].toUpperCase()}<span>${n}</span></button>`
      })
      .join('')
  // Leaders only make sense within one faction: the selected one, else the selected leader's (from a shared link).
  const faction =
    state.factions.length === 1
      ? state.factions[0]
      : state.leader !== undefined
        ? data.cards[state.leader].faction
        : undefined
  const leader = faction
    ? c.leaders
        .filter((id) => data.cards[id].faction === faction)
        .map((id) => cardPill('leader', id, current.leaders, state.leader))
        .join('') +
      // Named here too: on touch screens an icon has no tooltip.
      (state.leader === undefined ? '' : `<strong class="picked">${esc(loc.card(state.leader))}</strong>`)
    : `<span class="hint">${esc(t('leader.pickFaction'))}</span>`
  const stratagems = (ids: number[]) =>
    `<div class="pills">${ids.map((id) => cardPill('stratagem', id, current.stratagems, state.stratagem)).join('')}</div>`
  // Every faction's stratagem stays, other factions' at 0 (dimmed), so the row never reshapes.
  const own = FACTIONS.flatMap((f) => c.stratagems.filter((id) => data.cards[id].faction === f))
  const stratagem = stratagems(c.stratagems.filter((id) => data.cards[id].faction === 'NE')) + stratagems(own)
  // Stratagems are swapped freely, so the same list often appears under another stratagem.
  const others =
    state.stratagem === undefined
      ? 0
      : [...current.stratagems].reduce((n, [id, c]) => (id === state.stratagem ? n : n + c), 0)
  const stratagemNote =
    state.stratagem === undefined
      ? esc(t('stratagem.caution'))
      : // Named here too: on touch screens an icon has no tooltip.
        `<strong>${esc(loc.card(state.stratagem))}</strong> · ${esc(t('stratagem.swapped'))}${others ? ` ${esc(t('stratagem.others', { n: others }))}` : ''} <button type="button" class="link" data-any-stratagem="1">${esc(t('stratagem.any'))}</button>`
  const list = c.deck
  const deckChip = list
    ? `<li class="chip deck-pick"><span aria-hidden="true">⧉</span>${esc(t('cards.deckChip', { name: deckName(list.deck, loc) }))}<button type="button" data-remove-deck="1" aria-label="${esc(t('cards.remove', { name: deckName(list.deck, loc) }))}">✕</button></li>`
    : ''
  const near = c.near
  const nearChip = near
    ? `<li class="chip deck-pick"><span aria-hidden="true">≈</span>${esc(t('cards.nearChip', { name: deckName(near.deck, loc) }))}<button type="button" data-remove-near="1" aria-label="${esc(t('cards.remove', { name: deckName(near.deck, loc) }))}">✕</button></li>`
    : ''
  const chips =
    deckChip +
    nearChip +
    state.picks
      .map((pick) => {
        const name = c.pickName(pick)
        const excluded = !!state.excludes?.includes(pick)
        const remove = `<button type="button" data-remove="${esc(String(pick))}" aria-label="${esc(t('cards.remove', { name }))}">✕</button>`
        // The name toggles wanted/excluded; pressed means excluded, which the label says in words, not just the strike.
        const mark =
          typeof pick === 'number' ? '' : `<span aria-hidden="true">${pick.startsWith('@') ? '✎' : '#'}</span>`
        const flip = `<button type="button" class="chip-name" data-flip="${esc(String(pick))}" aria-pressed="${excluded}" aria-label="${esc(t('cards.exclude', { name }))}" title="${esc(t(excluded ? 'cards.includeTip' : 'cards.excludeTip'))}">${mark}${esc(name)}</button>`
        const cls = excluded ? ' excluded' : ''
        if (typeof pick === 'string') return `<li class="chip tag${cls}">${flip}${remove}</li>`
        const card = data.cards[pick]
        const dual = card.secondaryFaction ? ` dual f2-${card.secondaryFaction}` : ''
        return `<li class="chip f-${card.faction}${dual}${cls}">${flip}${remove}</li>`
      })
      .join('')
  return { factions, sources, budgets, media, leader, stratagem, stratagemNote, chips }
}
