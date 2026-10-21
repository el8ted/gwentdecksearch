/**
 * The page's entry point: reads a deck link passed in the URL, wires the controls, and draws the page in the
 * visitor's language. The work is in `app.ts` (applying changes), `search.ts` (their rules), `session.ts` (the
 * state) and `ui/` (drawing and events).
 */
import { setLanguage } from './app.ts'
import { decks } from './data.ts'
import { listForUrl } from './filter.ts'
import { EMPTY_STATE, encodeState } from './hash.ts'
import type { Lang, LanguagePack } from './i18n.ts'
import { session } from './session.ts'
import { initActions } from './ui/actions.ts'
import { initDisplayMenu } from './ui/display-menu.ts'
import { els } from './ui/page.ts'

declare global {
  // Set at build time (tsdown.config.ts).
  const __VERSION__: string
  // Language packs register themselves here (see scripts/lib/build.ts).
  var GDS_I18N: Partial<Record<Lang, LanguagePack>> | undefined
}

// `?deck=<playgwent URL>`: a way in for bots and tools holding a deck's full URL. Resolved once, then swapped for the
// short `#d=` form so bookmarks stay short; a deck that isn't in the list lands in Search, which says so.
const incoming = new URLSearchParams(location.search).get('deck')
const list = incoming === null ? undefined : listForUrl(decks, incoming)
if (incoming !== null) {
  const url = new URL(location.href)
  url.searchParams.delete('deck')
  if (list) {
    session.state = { ...EMPTY_STATE, leader: undefined, stratagem: undefined, deck: list }
    url.hash = encodeState(session.state)
  }
  history.replaceState(null, '', url)
}

initDisplayMenu()
initActions()
void setLanguage(session.loc.lang)
if (incoming !== null && !list) {
  els.input.value = incoming
  els.input.dispatchEvent(new Event('input'))
  // Selected, as after a paste, so typing or pasting replaces it.
  els.input.focus()
  els.input.select()
}
