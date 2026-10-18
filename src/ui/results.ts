import { budgetSide, type IndexedDeck, provisionStatus } from '../filter.ts'
import type { Locale } from '../i18n.ts'
import { type Dataset, type Deck, SOURCE_NAMES, type Source } from '../types.ts'
import { esc, newTabLink } from './dom.ts'

/**
 * A source's display name: "Community" is translated, author names are not.
 *
 * @param src - Source
 * @param loc - Locale
 * @returns Display name
 */
export function sourceLabel(src: Source, loc: Locale): string {
  return src === 'community' ? loc.t('source.community') : SOURCE_NAMES[src]
}

/**
 * A deck's display name: the author's original when it's in the visitor's language, otherwise English.
 *
 * @param deck - The deck
 * @param loc - Locale
 * @returns Display name
 */
export function deckName(deck: Deck, loc: Locale): string {
  return deck.original?.lang === loc.lang ? deck.original.name : deck.name
}

function stat(icon: string, label: string, value: string, extra = '') {
  return `<span class="stat ${extra}" title="${esc(label)}"><img src="icons/${icon}.png" alt="${esc(label)}" />${value}</span>`
}

function provisionBadge(entry: IndexedDeck, data: Dataset, loc: Locale): string {
  const { limit, used, delta } = provisionStatus(entry, data.cards)
  const leader = data.cards[entry.leader]
  const tip = loc.t('deck.provisionTip', { used, limit, bonus: leader.provisions, leader: loc.card(entry.leader) })
  const value = stat('provision', loc.t('stat.provisions'), `${used}<small>/${limit}</small>`)
  if (delta < 0)
    return `${value}<span class="badge over" title="${esc(tip)}">${esc(loc.t('deck.over', { n: -delta }))}</span>`
  if (delta > 0)
    return `${value}<span class="badge spare" title="${esc(tip)}">${esc(loc.t('deck.spare', { n: delta }))}</span>`
  return `<span title="${esc(tip)}">${value}</span>`
}

function decklist(entry: IndexedDeck, data: Dataset, selected: Set<number>, common: Set<number>, loc: Locale): string {
  const { cards } = data
  const rest = entry.deck.cards
    .filter(([id]) => id !== entry.leader && id !== entry.stratagem)
    .sort(([a], [b]) => cards[b].provisions - cards[a].provisions || loc.card(a).localeCompare(loc.card(b), loc.lang))
  const power = loc.t('deck.power')
  // Cost and power are fixed-width columns (power blank for non-units) so names line up.
  const line = (id: number, copies: number, cost: string) =>
    `<li class="${selected.has(id) ? 'hit ' : ''}${common.has(id) ? 'common' : ''}"><span class="cost">${esc(cost)}</span><span class="power"${
      cards[id].power === undefined ? '>' : ` title="${esc(power)}">${cards[id].power}`
    }</span>${newTabLink(loc.pg(`https://www.playgwent.com/decks/builder/card/details/${id}`), loc.card(id))}${
      copies > 1 ? `<span class="copies">×${copies}</span>` : ''
    }</li>`
  return `<ul class="decklist">${line(entry.leader, 1, loc.t('deck.leaderAbbr'))}${line(entry.stratagem, 1, loc.t('deck.stratagemAbbr'))}${rest
    .map(([id, copies]) => line(id, copies, String(cards[id].provisions)))
    .join('')}</ul>`
}

/** A language's short code for a badge: `pt-BR` → `PT`. */
const langCode = (lang: string) => lang.split('-')[0].toUpperCase()

/** A language's name in the page language (`ru` → "Russian"), or its code if the browser doesn't know it. */
function langName(lang: string, loc: Locale): string {
  try {
    return new Intl.DisplayNames(loc.lang, { type: 'language' }).of(lang) ?? lang
  } catch {
    return lang
  }
}

/** The video link and the guide's language, shown before the deck ID. */
function deckLinks(deck: Dataset['decks'][number], name: string, loc: Locale): string {
  const tip = { note: 'deck.guideNote', full: 'deck.guideFull' } as const
  const guide =
    deck.guideLang && deck.guideLevel
      ? `<span class="lang guide-${deck.guideLevel}" title="${esc(loc.t(tip[deck.guideLevel], { lang: langName(deck.guideLang, loc) }))}">${esc(langCode(deck.guideLang))}</span>`
      : ''
  if (!deck.video) return guide
  const lang = langName(deck.video.lang, loc)
  return `${guide}<a class="video" href="${esc(deck.video.url)}" target="_blank" rel="noopener" title="${esc(loc.t('deck.video', { lang }))}" aria-label="${esc(loc.t('deck.videoNamed', { name, lang }))}"><span aria-hidden="true">▶</span>${esc(langCode(deck.video.lang))}</a>`
}

/**
 * Renders one result row.
 *
 * @param entry - The deck
 * @param data - Dataset for card lookups
 * @param selected - Cards currently chosen, highlighted in the expanded list
 * @param expanded - Whether the full decklist is shown
 * @param common - Cards to dim in the expanded list (selected ones keep their highlight)
 * @param loc - Locale for text, card names and links
 * @returns `<li>` HTML
 */
export function deckRow(
  entry: IndexedDeck,
  data: Dataset,
  selected: Set<number>,
  expanded: boolean,
  common: Set<number>,
  loc: Locale,
): string {
  const { deck } = entry
  const state = entry.budget === 'exact' ? '' : budgetSide(entry.budget)
  const name = deckName(deck, loc)
  return `<li class="deck f-${entry.faction} ${state}">
  <div class="deck-head">
    <button type="button" class="deck-toggle" data-toggle="${esc(deck.id)}" aria-expanded="${expanded}">
      <span class="deck-name"><span class="fcode">${entry.faction}</span>${esc(name)}</span>
      <span class="deck-sub">${esc(loc.card(entry.leader))} · ${esc(loc.card(entry.stratagem))}</span>
      <span class="deck-src">${deck.sources.map((s) => `<span class="src s-${s}">${esc(sourceLabel(s, loc))}</span>`).join('')}${
        deck.votes === undefined
          ? ''
          : `<span class="votes" title="${esc(loc.t('deck.votesTip'))}">▲ ${deck.votes}${deck.author ? ` · ${esc(deck.author)}` : ''}</span>`
      }${
        deck.updated === undefined
          ? ''
          : `<time class="updated" datetime="${esc(deck.updated)}" title="${esc(loc.t('deck.updatedTip'))}">${esc(loc.date(deck.updated))}</time>`
      }</span>
    </button>
    <span class="deck-links">${deckLinks(deck, name, loc)}<code class="deck-id" title="${esc(deck.id)}">${esc(deck.id.slice(0, 8))}</code>
    <a class="open" href="${esc(loc.pg(deck.url))}" target="_blank" rel="noopener" title="${esc(loc.t('deck.open'))}" aria-label="${esc(loc.t('deck.openNamed', { name }))}">↗</a></span>
  </div>
  <div class="stats">
    ${stat('scraps', loc.t('stat.scraps'), loc.num(deck.stats.scraps))}
    ${stat('cards', loc.t('stat.cards'), String(deck.stats.cards))}
    ${stat('helmet', loc.t('stat.units'), String(deck.stats.units))}
    ${provisionBadge(entry, data, loc)}
  </div>
  ${expanded ? decklist(entry, data, selected, common, loc) : ''}
</li>`
}
