/** Display preferences, stored in localStorage and applied as `data-*` attributes on `<html>`. */
export interface DisplayPrefs {
  /** Index into {@link TEXT_SIZES}. */
  text: number
  theme: 'system' | 'dark' | 'light'
  contrast: 'standard' | 'high'
  /** Colour-vision-deficiency-safe palette (Okabe–Ito) plus faction labels on rows. */
  cvd: boolean
}

/** Root font sizes offered, as a percentage of the browser default. */
export const TEXT_SIZES = [87.5, 100, 112.5, 125, 150] as const

/** localStorage key; index.html's inline head script reads the same key to avoid a flash on load. */
export const PREFS_KEY = 'gwent-deck-search:display'

export const DEFAULT_PREFS: DisplayPrefs = { text: 1, theme: 'system', contrast: 'standard', cvd: false }

/**
 * Parses stored preferences, falling back to defaults for anything missing or invalid.
 *
 * @param raw - localStorage value (may be null or hand-edited)
 * @returns Valid preferences
 */
export function parsePrefs(raw: string | null): DisplayPrefs {
  let p: Partial<DisplayPrefs> = {}
  try {
    p = JSON.parse(raw ?? '{}') ?? {}
  } catch {}
  return {
    text:
      Number.isInteger(p.text) && (p.text as number) >= 0 && (p.text as number) < TEXT_SIZES.length
        ? (p.text as number)
        : DEFAULT_PREFS.text,
    theme: p.theme === 'dark' || p.theme === 'light' ? p.theme : 'system',
    contrast: p.contrast === 'high' ? 'high' : 'standard',
    cvd: p.cvd === true,
  }
}

/**
 * Turns preferences into the attributes the stylesheet keys off.
 *
 * @param prefs - Preferences
 * @param systemDark - Whether the OS prefers a dark scheme (resolves `theme: 'system'`)
 * @returns Attribute values for `<html>`
 */
export function prefsToAttrs(prefs: DisplayPrefs, systemDark: boolean): Record<string, string> {
  const theme = prefs.theme === 'system' ? (systemDark ? 'dark' : 'light') : prefs.theme
  return {
    'data-theme': theme,
    'data-contrast': prefs.contrast,
    'data-cvd': String(prefs.cvd),
    style: `font-size:${TEXT_SIZES[prefs.text]}%`,
  }
}
