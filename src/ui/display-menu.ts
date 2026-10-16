import { DEFAULT_PREFS, type DisplayPrefs, PREFS_KEY, parsePrefs, prefsToAttrs, TEXT_SIZES } from '../display.ts'
import { byId, closeOnOutside, readStorage, writeStorage } from './dom.ts'

/**
 * Wires the Display menu (text size, theme, contrast, colour palette) and keeps `<html>` in sync,
 * including OS theme changes while `theme` is `system`.
 */
export function initDisplayMenu() {
  const menu = byId<HTMLDetailsElement>('display')
  const dark = matchMedia('(prefers-color-scheme: dark)')
  let prefs = parsePrefs(readStorage(PREFS_KEY))

  function apply() {
    for (const [k, v] of Object.entries(prefsToAttrs(prefs, dark.matches))) document.documentElement.setAttribute(k, v)
    for (const b of menu.querySelectorAll<HTMLButtonElement>('[data-pref]')) {
      const key = b.dataset.pref as keyof DisplayPrefs
      b.setAttribute('aria-pressed', String(String(prefs[key]) === b.dataset.value))
    }
    byId('text-size').textContent = `${TEXT_SIZES[prefs.text]}%`
    byId<HTMLButtonElement>('text-down').disabled = prefs.text === 0
    byId<HTMLButtonElement>('text-up').disabled = prefs.text === TEXT_SIZES.length - 1
  }

  function set(next: Partial<DisplayPrefs>) {
    prefs = { ...prefs, ...next }
    writeStorage(PREFS_KEY, JSON.stringify(prefs))
    apply()
  }

  menu.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!b) return
    if (b.id === 'text-down') set({ text: prefs.text - 1 })
    else if (b.id === 'text-up') set({ text: prefs.text + 1 })
    else if (b.id === 'display-reset') set(DEFAULT_PREFS)
    else if (b.dataset.pref) {
      const value = b.dataset.value
      set({ [b.dataset.pref]: value === 'true' ? true : value === 'false' ? false : value })
    }
  })
  closeOnOutside(menu)
  dark.addEventListener('change', apply)
  apply()
}
