import { LANGUAGE_NAMES, LANGUAGES, type Lang } from '../i18n.ts'
import { byId, closeOnOutside } from './dom.ts'
import { langCode } from './results.ts'

/**
 * Wires the header language menu: one button per language, labelled in its own script.
 *
 * @param current - The language in use
 * @param onPick - Called when the visitor chooses a different language
 * @returns `refresh()`, to update the label and pressed state after a change
 */
export function initLanguageMenu(current: () => Lang, onPick: (lang: Lang) => void) {
  const menu = byId<HTMLDetailsElement>('langmenu')
  const panel = byId('lang-panel')
  // Each button carries its own `lang` so screen readers pronounce the name correctly.
  panel.innerHTML = LANGUAGES.map(
    (l) => `<button type="button" data-lang="${l}" lang="${l}">${LANGUAGE_NAMES[l]}</button>`,
  ).join('')

  function refresh() {
    byId('lang-current').textContent = LANGUAGE_NAMES[current()]
    byId('lang-code').textContent = langCode(current())
    for (const b of panel.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === current()))
    }
  }

  panel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-lang]')
    if (!b) return
    menu.open = false
    if (b.dataset.lang !== current()) onPick(b.dataset.lang as Lang)
  })
  closeOnOutside(menu)
  refresh()
  return { refresh }
}
