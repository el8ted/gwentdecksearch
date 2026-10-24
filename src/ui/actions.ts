/**
 * What the page's buttons, keys and fields do. Buttons dispatch through one table keyed by their `data-*` attribute,
 * which also says where focus goes when a click redraws the button away.
 */
import { addPick, apply, clearAll, removeDeck, removeNear, removePick, render, showDeck, update } from '../app.ts'
import { CONFIG } from '../config.ts'
import { data, deckById, readHash } from '../data.ts'
import type { Budget, FilterState } from '../filter.ts'
import { shareUrl } from '../hash.ts'
import * as search from '../search.ts'
import { session } from '../session.ts'
import type { Faction, Source } from '../types.ts'
import { byId } from './dom.ts'
import { els, renderFilters, renderResults } from './page.ts'

const help = byId<HTMLDialogElement>('shortcuts')

/** Where skip links (and the [ ] shortcuts) move focus. */
const JUMPS: Record<string, () => HTMLElement | null> = {
  cards: () => els.input,
  // Folded on a phone, or shrunk on a scrolled desktop: unfold first, or there's nothing to land on.
  filters: () => {
    if (session.view.pinnedCompact) unpin()
    if (session.state.leader !== undefined && !session.view.opponentOpen) {
      session.view.opponentOpen = true
      renderFilters()
    }
    return els.factions.querySelector('button')
  },
  results: () => els.resultHead,
  panel: () =>
    session.state.tab === 'craft' ? els.scraps : document.querySelector('[data-freq][aria-pressed="true"]'),
}

let copiedTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Copy link: the search's link to the clipboard, said in a status line beside the button (read out, nothing moves).
 * Phones get the share sheet instead (it offers copy too). If the browser won't copy, the link is shown, selected.
 */
async function copyLink() {
  const url = shareUrl(location.href, CONFIG.siteUrl)
  if (matchMedia('(pointer: coarse)').matches && navigator.share) {
    try {
      await navigator.share({ url })
      return
    } catch (e) {
      // Closing the sheet is a choice, not a failure.
      if ((e as Error).name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    els.copyStatus.textContent = session.loc.t('results.linkCopied')
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      els.copyStatus.textContent = ''
    }, 2500)
  } catch {
    els.shareFallback.hidden = false
    els.shareUrl.value = url
    els.shareUrl.focus()
    els.shareUrl.select()
  }
}

// Desktop: the pinned filters take half a laptop screen. Once the visitor scrolls a screenful of them into the decks
// they shrink to their fold lines and Search, and the scroll position moves by what they lost, so the decks on screen
// stay where they are. A line unfolds them over the decks without moving the page (a tablet flick fights a moved
// page), and a scroll, a tap outside them, Tab past them or Esc folds them again; the top of the page restores them.
const wide = matchMedia('(min-width: 861px)')
/** Unfolded over the decks: the scroll position then, and the shrunk height the page keeps for them. */
let overlay: { at: number; flow: number } | undefined
/** How far a scroll goes before it folds the unfolded rows: a deliberate flick, not a finger settling. */
const OVERLAY_SCROLL = 30
/** When the visitor last turned the wheel, dragged a finger or pressed a scroll key outside the filters. */
let gestureAt = Number.NEGATIVE_INFINITY

/** Shrinks the pinned filters, keeping the decks on screen in place. */
function setPinned(compact: boolean) {
  const [before, y] = [els.filters.offsetHeight, scrollY]
  session.view.pinnedCompact = compact
  renderFilters()
  // Chrome and Firefox's scroll anchoring may already have moved the page (Safari's doesn't): only add what's missing.
  const target = y - (before - els.filters.offsetHeight)
  if (Math.abs(scrollY - target) > 1) window.scrollTo({ top: target, behavior: 'instant' })
}

/** The unfolded rows hang below the shrunk height the page keeps for them: a negative margin takes back the rest. */
function fitOverlay() {
  if (overlay) els.filters.style.marginBottom = `${overlay.flow - els.filters.offsetHeight}px`
}
new ResizeObserver(fitOverlay).observe(els.filters)

/**
 * Unfolds the shrunk filters over the decks from a fold line or a shortcut.
 *
 * @param rows - Where focus goes, since the line it was on disappears
 */
function unpin(rows?: HTMLElement) {
  overlay = { at: scrollY, flow: els.filters.offsetHeight }
  // Before rendering, so ui/page.ts keeps the shrunk height for what's pinned below.
  els.filters.classList.add('pinned-overlay')
  session.view.pinnedCompact = false
  renderFilters()
  fitOverlay()
  rows?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
}

/**
 * Folds the unfolded rows: shrunk again, or in full (top of the page, a phone, a new list). Focus on a row that
 * disappears moves to the first fold line.
 */
function closeOverlay(compact: boolean) {
  if (!overlay) return
  overlay = undefined
  const hadFocus = els.filters.contains(document.activeElement)
  els.filters.classList.remove('pinned-overlay')
  els.filters.style.marginBottom = ''
  session.view.pinnedCompact = compact
  renderFilters()
  // The rows may be rebuilt as well as hidden: whatever had focus can be gone.
  const focused = document.activeElement as HTMLElement | null
  if (hadFocus && (!focused || !els.filters.contains(focused) || !focused.getClientRects().length)) {
    firstVisible('.filters-toggle')?.focus({ preventScroll: true })
  }
}

function onScroll() {
  const { view } = session
  const top = document.querySelector<HTMLElement>('.topbar')?.offsetHeight ?? 0
  if (!wide.matches || scrollY < top) {
    closeOverlay(false)
    // At the top of the page there's nothing to keep in place: the rows simply come back.
    if (view.pinnedCompact) {
      view.pinnedCompact = false
      renderFilters()
    }
    return
  }
  if (overlay) {
    // Only the visitor's own scrolling folds them: a shorter list after a pick, or a tablet's keyboard opening for
    // Search, moves the page too.
    if (performance.now() - gestureAt > 500) overlay.at = scrollY
    else if (Math.abs(scrollY - overlay.at) > OVERLAY_SCROLL) closeOverlay(true)
    return
  }
  if (!view.pinnedCompact && scrollY > top + els.filters.offsetHeight) setPinned(true)
}

/** Wide screens: the top of the page, the filters in full. */
function toTop() {
  closeOverlay(false)
  if (session.view.pinnedCompact) {
    session.view.pinnedCompact = false
    renderFilters()
  }
  window.scrollTo({ top: 0, behavior: 'instant' })
}

/**
 * A new list from a button deep in the old one (⧉, ≈, a Craft card): its heading, at the top, the filters in full.
 * The results bar is pinned on wide screens, so focusing it alone would leave the page mid-way down the new list.
 */
function toListTop() {
  if (!wide.matches) return els.resultHead.focus()
  toTop()
  els.resultHead.focus({ preventScroll: true })
}

/** Clear all starts a new search: on wide screens from the top, every filter showing (shrunk, empty ones hide). */
function clearSearch() {
  clearAll()
  if (wide.matches) toTop()
}

/** The first element matching a selector that's rendered (folded rows on a phone are in the page but hidden). */
const firstVisible = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((el) => el.getClientRects().length > 0)

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
  copyLink: { run: () => void copyLink() },
  filtersToggle: {
    run: () => {
      if (session.view.pinnedCompact) return unpin(els.sources)
      session.view.filtersOpen = !session.view.filtersOpen
      renderFilters()
    },
  },
  opponentToggle: {
    run: () => {
      if (session.view.pinnedCompact) return unpin(els.factions)
      session.view.opponentOpen = !session.view.opponentOpen
      renderFilters()
    },
  },
  panelToggle: {
    run: () => {
      session.view.panelOpen = !session.view.panelOpen
      renderResults()
    },
  },
  faction: { run: (v) => apply(search.chooseFaction(session.state, session.memory, v as Faction)) },
  source: { run: (v) => update({ sources: toggled(session.state.sources, v as Source) }) },
  budget: { run: (v) => update({ budgets: toggled(session.state.budgets, v as Budget) }) },
  video: { run: () => update({ video: !session.state.video }) },
  guideLang: { run: (v) => update({ langs: toggled(session.state.langs, v) }) },
  // On a phone, picking a leader or stratagem folds those rows away (see renderFilters): focus goes to the next step.
  leader: {
    run: (v) => {
      session.view.opponentOpen = false
      update({ leader: session.state.leader === Number(v) ? undefined : Number(v) })
    },
    fallback: () => firstVisible('#stratagem [data-stratagem]') ?? els.opponentToggle,
  },
  stratagem: {
    run: (v) => {
      session.view.opponentOpen = false
      update({ stratagem: session.state.stratagem === Number(v) ? undefined : Number(v) })
    },
    fallback: () => els.opponentToggle,
  },
  anyStratagem: {
    run: () => update({ stratagem: undefined }),
    fallback: () => els.stratagem.querySelector('button'),
  },
  match: { run: (v) => update({ match: v as FilterState['match'] }) },
  clearAll: { run: () => clearSearch() },
  remove: { run: (v) => removePick(asPick(v)), fallback: () => els.input },
  flip: { run: (v) => apply(search.flipPick(session.state, session.memory, asPick(v), data.cards)) },
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
      session.view.freq = v as typeof session.view.freq
      renderResults()
    },
  },
  dimCommon: {
    run: () => {
      session.view.dimCommon = !session.view.dimCommon
      renderResults()
    },
  },
  expandAll: {
    run: () => {
      for (const id of session.shown) {
        if (session.allOpen) session.view.expanded.delete(id)
        else session.view.expanded.add(id)
      }
      renderResults()
    },
  },
  toggle: {
    run: (id) => {
      if (!session.view.expanded.delete(id)) session.view.expanded.add(id)
      renderResults()
    },
  },
  near: {
    run: (id) => {
      const target = deckById(id)
      if (target) apply(search.showNear(session.state, session.memory, target))
    },
    fallback: () => {
      toListTop()
      return els.resultHead
    },
  },
  // ⧉: the same as pasting the deck's link; pressed again (on the only deck left) it shows the others.
  select: {
    run: (list) => {
      if (session.state.deck === list) removeDeck()
      else showDeck(list)
      toListTop()
    },
  },
  showNear: {
    run: (v) => {
      update({ budgets: [...(session.state.budgets ?? []), v as Budget] })
      // The button is gone once This deck is listed; it leads the results.
      els.resultHead.focus()
    },
  },
  more: {
    run: () => {
      session.view.limit += CONFIG.resultsPageSize
      renderResults()
      // Continue reading where the new rows start, rather than on the button that moved below them.
      const rows =
        session.state.tab === 'craft'
          ? els.craftBody.querySelectorAll('[data-craft-pick]')
          : els.results.querySelectorAll('[data-toggle]')
      ;(rows[session.view.limit - CONFIG.resultsPageSize] as HTMLElement | undefined)?.focus()
    },
  },
  tab: { run: (v) => update({ tab: v === 'craft' ? 'craft' : undefined }, { push: true }) },
  // A Craft card's name lists the decks that run it, added like any pick (its faction too); Back returns to Craft.
  craftPick: {
    run: (v) => {
      const step = search.addPick(session.state, session.memory, Number(v), data.cards)
      if (step) apply({ ...step, next: { ...step.next, tab: undefined }, push: true })
      toListTop()
    },
  },
}

/**
 * j/k: the next or previous row of the list on screen (decks, or Craft's cards), then its Show more. From outside the
 * list, the first row. No wrapping at either end: the far end of a paged list isn't its real end.
 *
 * @param by - 1 for the next row, -1 for the previous
 */
function stepRow(by: 1 | -1) {
  const rows = [
    ...document.querySelectorAll<HTMLElement>(
      session.state.tab === 'craft'
        ? '#craft-body [data-craft-pick], #craft-body [data-more]'
        : '#results [data-toggle], #results [data-more]',
    ),
  ]
  // A row is its <li> or <tr>: focus may be on any of its buttons, or in an opened deck's card list.
  const at = rows.findIndex((r) => r.closest('li, tr')?.contains(document.activeElement))
  ;(at < 0 ? rows[0] : rows[Math.min(Math.max(at + by, 0), rows.length - 1)])?.focus()
}

// Page shortcuts, outside text fields. Each matches the printed key, then the physical key, so layouts without
// / [ ] (e.g. Russian) still work.
// shortcut: single-key shortcuts can't be turned off (WCAG 2.1.4), add a toggle once user settings exist.
const SHORTCUTS: [matches: (e: KeyboardEvent) => boolean, run: () => void][] = [
  [(e) => e.key === '?', () => (help.open ? help.close() : help.showModal())],
  [(e) => e.key === '/' || (e.code === 'Slash' && !e.shiftKey), () => els.input.focus()],
  [(e) => e.key === '[' || (e.code === 'BracketLeft' && !e.shiftKey), () => JUMPS.filters()?.focus()],
  [(e) => e.key === ']' || (e.code === 'BracketRight' && !e.shiftKey), () => JUMPS.panel()?.focus()],
  [(e) => e.key === 'j' || (e.code === 'KeyJ' && !e.shiftKey), () => stepRow(1)],
  [(e) => e.key === 'k' || (e.code === 'KeyK' && !e.shiftKey), () => stepRow(-1)],
  [
    (e) => e.key === 'Backspace' && e.shiftKey,
    () => {
      const was = document.activeElement
      clearSearch()
      // A cleared pill was re-rendered away; start the next search from the card box.
      if (!was?.isConnected) els.input.focus()
    },
  ],
]

/** Wires every button, key, field and dialog on the page. Call once, at load. */
export function initActions() {
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
    ;(firstVisible(`[${attr}="${CSS.escape(value)}"]`) ?? ACTIONS[key].fallback?.(at))?.focus()
  })

  // Have it: a checkbox, so it's handled on change; re-rendering replaces it, so focus goes to its new copy.
  document.addEventListener('change', (e) => {
    const box = e.target as HTMLInputElement
    if (!box.dataset?.have) return
    const id = Number(box.dataset.have)
    if (box.checked) session.view.have.add(id)
    else session.view.have.delete(id)
    renderResults()
    document.querySelector<HTMLElement>(`[data-have="${id}"]`)?.focus()
  })
  addEventListener('scroll', onScroll, { passive: true })
  wide.addEventListener('change', onScroll)
  const gesture = () => {
    gestureAt = performance.now()
  }
  addEventListener('wheel', gesture, { passive: true })
  addEventListener('touchmove', gesture, { passive: true })
  const SCROLL_KEYS = new Set([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'])
  addEventListener('keydown', (e) => {
    if (SCROLL_KEYS.has(e.key) && !els.filters.contains(e.target as Node)) gesture()
  })
  // The unfolded rows sit over the decks like a menu: a tap on the page, Tab past them or Esc folds them. The tap
  // still lands, since folding them doesn't move anything.
  document.addEventListener('pointerdown', (e) => {
    if (overlay && !els.filters.contains(e.target as Node)) closeOverlay(true)
  })
  els.filters.addEventListener('focusout', (e) => {
    if (overlay && e.relatedTarget && !els.filters.contains(e.relatedTarget as Node)) closeOverlay(true)
  })
  els.filters.addEventListener('keydown', (e) => {
    // In a text box Esc is its own (suggestions, then the results).
    if (overlay && e.key === 'Escape' && !(e.target as HTMLElement).closest('input')) closeOverlay(true)
  })
  els.scraps.addEventListener('input', () => {
    const n = els.scraps.valueAsNumber
    session.view.scraps = Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
    renderResults()
  })

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

  // Back and Forward: the filters come from the URL; the ≈ and auto-faction memory doesn't survive the jump.
  window.addEventListener('hashchange', () => {
    session.memory = { ...search.NO_MEMORY, deckReplaced: session.memory.deckReplaced }
    session.state = readHash()
    session.view.limit = CONFIG.resultsPageSize
    render()
  })

  // Help links to Credits too (phones have no room for its header button): one dialog at a time.
  byId('help-credits').addEventListener('click', () => {
    help.close()
    byId<HTMLDialogElement>('credits').showModal()
  })
  // Credits and Help: a native <dialog> handles Esc and focus; a click on the backdrop (the dialog itself) closes it.
  for (const id of ['credits', 'shortcuts']) {
    const dialog = byId<HTMLDialogElement>(id)
    byId(`${id}-open`).addEventListener('click', () => dialog.showModal())
    byId(`${id}-close`).addEventListener('click', () => dialog.close())
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close()
    })
  }
}
