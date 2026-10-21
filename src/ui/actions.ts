/**
 * What the page's buttons, keys and fields do. Buttons dispatch through one table keyed by their `data-*` attribute,
 * which also says where focus goes when a click redraws the button away.
 */
import { addPick, apply, clearAll, removeDeck, removeNear, removePick, render, showDeck, update } from '../app.ts'
import { data, deckById, readHash } from '../data.ts'
import type { Budget, FilterState } from '../filter.ts'
import * as search from '../search.ts'
import { PAGE, session } from '../session.ts'
import type { Faction, Source } from '../types.ts'
import { byId } from './dom.ts'
import { els, renderResults } from './page.ts'

const help = byId<HTMLDialogElement>('shortcuts')

/** Where skip links (and the [ ] shortcuts) move focus. */
const JUMPS: Record<string, () => HTMLElement | null> = {
  cards: () => els.input,
  filters: () => els.sources.querySelector('button'),
  results: () => els.resultHead,
  panel: () =>
    session.state.tab === 'craft' ? els.scraps : document.querySelector('[data-freq][aria-pressed="true"]'),
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
  faction: { run: (v) => apply(search.chooseFaction(session.state, session.memory, v as Faction)) },
  source: { run: (v) => update({ sources: toggled(session.state.sources, v as Source) }) },
  budget: { run: (v) => update({ budgets: toggled(session.state.budgets, v as Budget) }) },
  video: { run: () => update({ video: !session.state.video }) },
  guideLang: { run: (v) => update({ langs: toggled(session.state.langs, v) }) },
  leader: { run: (v) => update({ leader: session.state.leader === Number(v) ? undefined : Number(v) }) },
  stratagem: { run: (v) => update({ stratagem: session.state.stratagem === Number(v) ? undefined : Number(v) }) },
  anyStratagem: {
    run: () => update({ stratagem: undefined }),
    fallback: () => els.stratagem.querySelector('button'),
  },
  match: { run: (v) => update({ match: v as FilterState['match'] }) },
  clearAll: { run: () => clearAll() },
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
    fallback: () => els.resultHead,
  },
  // ⧉: the same as pasting the deck's link; pressed again (on the only deck left) it shows the others.
  select: {
    run: (list) => {
      if (session.state.deck === list) removeDeck()
      else showDeck(list)
      els.resultHead.focus()
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
      session.view.limit += PAGE
      renderResults()
      // Continue reading where the new rows start, rather than on the button that moved below them.
      const rows =
        session.state.tab === 'craft'
          ? els.craftBody.querySelectorAll('[data-craft-pick]')
          : els.results.querySelectorAll('[data-toggle]')
      ;(rows[session.view.limit - PAGE] as HTMLElement | undefined)?.focus()
    },
  },
  tab: { run: (v) => update({ tab: v === 'craft' ? 'craft' : undefined }, { push: true }) },
  // A Craft card's name lists the decks that run it, added like any pick (its faction too); Back returns to Craft.
  craftPick: {
    run: (v) => {
      const step = search.addPick(session.state, session.memory, Number(v), data.cards)
      if (step) apply({ ...step, next: { ...step.next, tab: undefined }, push: true })
      els.resultHead.focus()
    },
  },
}

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
    ;(document.querySelector<HTMLElement>(`[${attr}="${CSS.escape(value)}"]`) ?? ACTIONS[key].fallback?.(at))?.focus()
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
    session.view.limit = PAGE
    render()
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
