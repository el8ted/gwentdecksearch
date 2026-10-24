import { budgetSide, type cardChanges, deckBody, type IndexedDeck, MIN_DECK_CARDS, provisionStatus } from '../filter.ts'
import type { Locale } from '../i18n.ts'
import { type Dataset, type Deck, SOURCE_NAMES, type Source } from '../types.ts'
import { esc, newTabLink } from './dom.ts'
import { icon } from './icons.ts'

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

/** With Any, "3/4": how many of the wanted picks a deck has (the order Any lists them in), said in full for screen readers. */
function picksBadge({ n, of }: { n: number; of: number }, loc: Locale): string {
  const tip = esc(loc.t('deck.picksMatched', { n, of }))
  return `<span class="badge shared" title="${tip}"><span aria-hidden="true">${n}/${of}</span><span class="sr-only">${tip}</span></span>`
}

/** How a deck differs from the deck a Similar list is ranked against ({@link cardChanges}). */
export type Changes = ReturnType<typeof cardChanges>

function decklist(
  entry: IndexedDeck,
  data: Dataset,
  selected: Set<number>,
  common: Set<number>,
  loc: Locale,
  changes?: Changes,
): string {
  const { cards } = data
  const rest = deckBody(entry).sort(
    ([a], [b]) => cards[b].provisions - cards[a].provisions || loc.card(a).localeCompare(loc.card(b), loc.lang),
  )
  const power = loc.t('deck.power')
  // Cost and power are fixed-width columns (power blank for non-units) so names line up.
  // Comparing with This deck: + marks what this deck added (+1 for one extra copy), and everything else is common.
  const added = (id: number, copies: number) => {
    const n = changes?.added.get(id)
    if (!n) return ''
    const tip = esc(n < copies ? loc.t('deck.addedCopies', { n }) : loc.t('deck.added'))
    return `<span class="added" title="${tip}" aria-hidden="true">+${n < copies ? n : ''}</span><span class="sr-only">${tip}</span>`
  }
  const dim = (id: number) => (changes ? !changes.added.has(id) : common.has(id))
  const line = (id: number, copies: number, cost: string) =>
    `<li class="${selected.has(id) ? 'hit ' : ''}${dim(id) ? 'common' : ''}"><span class="cost">${esc(cost)}</span><span class="power"${
      cards[id].power === undefined ? '>' : ` title="${esc(power)}">${cards[id].power}`
    }</span>${newTabLink(loc.pg(`https://www.playgwent.com/decks/builder/card/details/${id}`), loc.card(id))}${
      copies > 1 ? `<span class="copies">×${copies}</span>` : ''
    }${added(id, copies)}</li>`
  const removed = (changes?.removed ?? []).sort(([a], [b]) => cards[b].provisions - cards[a].provisions)
  const swapped = removed.length
    ? `<p class="swapped">${esc(loc.t('deck.swappedOut'))} ${removed
        // −1 when this deck still runs the card, just fewer copies; ×2 when both copies went.
        .map(([id, n]) => {
          const kept = entry.deck.cards.some(([c]) => c === id)
          return `${esc(loc.card(id))}${kept ? ` <span class="copies">−${n}</span>` : n > 1 ? ` <span class="copies">×${n}</span>` : ''}`
        })
        .join(', ')}</p>`
    : ''
  return `<ul class="decklist">${line(entry.leader, 1, loc.t('deck.leaderAbbr'))}${line(entry.stratagem, 1, loc.t('deck.stratagemAbbr'))}${rest
    .map(([id, copies]) => line(id, copies, String(cards[id].provisions)))
    .join('')}</ul>${swapped}`
}

/**
 * A deck button's face: its symbol, and a word that shows only when the row is wide enough (see `.btn-word`). The
 * button's aria-label names it in full, so both are hidden from screen readers.
 */
const glyph = (symbol: string, word: string) =>
  `<span aria-hidden="true">${symbol}</span><span class="btn-word" aria-hidden="true">${esc(word)}</span>`

/** A language's short code for a badge: `pt-BR` → `PT`. */
export const langCode = (lang: string) => lang.split('-')[0].toUpperCase()

/** The video link and the guide's language, before the deck's buttons; one badge when both are the same language. */
function deckLinks(deck: Dataset['decks'][number], name: string, loc: Locale): string {
  const guideTip = deck.guideLang && loc.t('deck.guideLang', { lang: loc.langName(deck.guideLang) })
  if (!deck.video) {
    return deck.guideLang
      ? `<span class="lang" title="${esc(guideTip ?? '')}">${esc(langCode(deck.guideLang))}</span>`
      : ''
  }
  const lang = loc.langName(deck.video.lang)
  // ▶ EN alone says both, so the guide's own badge would only repeat it; its tooltip says so instead.
  const same = deck.guideLang !== undefined && langCode(deck.guideLang) === langCode(deck.video.lang)
  const guide =
    !deck.guideLang || same
      ? ''
      : `<span class="lang" title="${esc(guideTip ?? '')}">${esc(langCode(deck.guideLang))}</span>`
  const tip = loc.t('deck.video', { lang }) + (same ? `\n${guideTip}` : '')
  return `${guide}<a class="video" href="${esc(deck.video.url)}" target="_blank" rel="noopener" title="${esc(tip)}" aria-label="${esc(loc.t('deck.videoNamed', { name, lang }))}">${icon('play')}${esc(langCode(deck.video.lang))}</a>`
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
 * @param shared - Cards in common with the deck the list is ranked against, that deck's card count, and whether this is it
 * @param changes - How this deck differs from that deck, shown in the expanded list instead of `common`
 * @param only - Whether the search shows only this deck's list (the Deck pill), so its ⧉ is pressed
 * @param picks - With Any: how many of the wanted picks this deck has, of how many
 * @returns `<li>` HTML
 */
export function deckRow(
  entry: IndexedDeck,
  data: Dataset,
  selected: Set<number>,
  expanded: boolean,
  common: Set<number>,
  loc: Locale,
  shared?: { n: number; of: number; self: boolean },
  changes?: Changes,
  only = false,
  picks?: { n: number; of: number },
): string {
  const { deck } = entry
  const state = entry.budget === 'exact' ? '' : budgetSide(entry.budget)
  const name = deckName(deck, loc)
  return `<li class="deck f-${entry.faction} ${state}">
  <div class="deck-head">
    <button type="button" class="deck-toggle" data-toggle="${esc(deck.id)}" aria-expanded="${expanded}" title="${esc(loc.t(expanded ? 'deck.hideCards' : 'deck.showCards'))}">
      <span class="chev" aria-hidden="true">${icon('chevron')}</span>
      <span class="deck-name"><span class="fcode">${entry.faction}</span>${esc(name)}</span>
      <span class="deck-sub">${esc(loc.card(entry.leader))} · ${esc(loc.card(entry.stratagem))}</span>
      <span class="deck-src">${deck.sources.map((s) => `<span class="src s-${s}">${s === 'community' ? icon('community') : ''}${esc(sourceLabel(s, loc))}</span>`).join('')}${
        deck.votes === undefined
          ? ''
          : `<span class="votes" title="${esc(loc.t('deck.votesTip'))}">${icon('votes')} ${deck.votes}${deck.author ? ` · ${esc(deck.author)}` : ''}</span>`
      }${
        deck.updated === undefined
          ? ''
          : `<time class="updated" datetime="${esc(deck.updated)}" title="${esc(loc.t('deck.updatedTip'))}">${esc(loc.date(deck.updated))}</time>`
      }</span>
    </button>
    <span class="deck-links">${deckLinks(deck, name, loc)}
    <button type="button" class="open" data-select="${esc(entry.list)}" aria-pressed="${only}" title="${esc(loc.t(only ? 'deck.selectedTip' : 'deck.select'))}" aria-label="${esc(loc.t('deck.selectNamed', { name }))}">${glyph(icon('only'), loc.t('deck.selectWord'))}</button>
    <button type="button" class="open" data-near="${esc(deck.id)}" title="${esc(loc.t('deck.similar'))}" aria-label="${esc(loc.t('deck.similarNamed', { name }))}">${glyph(icon('similar'), loc.t('deck.similarWord'))}</button>
    <a class="open" href="${esc(loc.pg(deck.url))}" target="_blank" rel="noopener" title="${esc(loc.t('deck.open'))}" aria-label="${esc(loc.t('deck.openNamed', { name }))}">${glyph(icon('external'), 'playgwent.com')}</a></span>
  </div>
  <div class="stats">
    ${stat('scraps', loc.t('stat.scraps'), loc.num(deck.stats.scraps))}
    ${deck.stats.cards === MIN_DECK_CARDS ? '' : stat('cards', loc.t('stat.cards'), String(deck.stats.cards))}
    ${stat('helmet', loc.t('stat.units'), String(deck.stats.units))}
    ${provisionBadge(entry, data, loc)}
    ${picks ? picksBadge(picks, loc) : ''}
    ${shared ? `<span class="badge shared">${esc(shared.self ? loc.t('deck.thisDeck') : loc.t('deck.shared', { n: shared.n, of: shared.of }))}</span>` : ''}
  </div>
  ${expanded ? `${decklist(entry, data, selected, common, loc, changes)}<p class="deck-foot"><code class="deck-id" title="${esc(loc.t('deck.idTip'))}">${esc(deck.id)}</code></p>` : ''}
</li>`
}
