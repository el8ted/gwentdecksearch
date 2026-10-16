/**
 * Escapes text for safe interpolation into HTML strings.
 *
 * @param text - Untrusted text (card and deck names come from scraped pages)
 * @returns HTML-safe text
 */
export function esc(text: string | number): string {
  return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/**
 * Looks up an element that index.html guarantees.
 *
 * @param id - Element ID
 * @returns The element
 * @throws {Error} If index.html and the code disagree
 */
export function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} missing from index.html`)
  return el as T
}

/**
 * Renders a link that opens in a new tab, so the search stays put.
 *
 * @param href - Target URL
 * @param text - Link text (escaped here)
 * @returns HTML string
 */
export function newTabLink(href: string, text: string): string {
  return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>`
}

// Storage throws when blocked (cookies off, some sandboxed webviews); the page then just forgets choices.

/**
 * Reads a saved value.
 *
 * @param key - localStorage key
 * @returns The value, or `null` if missing or storage is blocked
 */
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Saves a value; does nothing if storage is blocked.
 *
 * @param key - localStorage key
 * @param value - Value to store
 */
export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

/**
 * Closes a `<details>` menu on Esc (returning focus to its summary) or a click outside it, like a native popup.
 *
 * @param menu - The menu
 */
export function closeOnOutside(menu: HTMLDetailsElement): void {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.open) {
      menu.open = false
      menu.querySelector('summary')?.focus()
    }
  })
  document.addEventListener('click', (e) => {
    if (menu.open && !menu.contains(e.target as Node)) menu.open = false
  })
}
