/** Languages playgwent supports; card names and Gwent terms exist for all of them. */
export const LANGUAGES = ['en', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt-BR', 'ru', 'zh-cn'] as const

/** A supported language code (playgwent's spelling, used in its URLs). */
export type Lang = (typeof LANGUAGES)[number]

/** Each language's name in its own script, for the language menu. */
export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  pl: 'Polski',
  'pt-BR': 'Português (Brasil)',
  ru: 'Русский',
  'zh-cn': '简体中文',
}

/** localStorage key for an explicit language choice. */
export const LANG_KEY = 'gwent-deck-search:lang'

/** A phrase: plain text, or plural forms chosen with `Intl.PluralRules` (`other` is required). */
export type Phrase = string | Partial<Record<Intl.LDMLPluralRule, string>>

/** One language's interface phrases; `_needsReview` lists keys awaiting a native speaker's check. */
export type Phrases = Record<string, Phrase | string[]>

/** Per-language data loaded on demand: official Gwent terms and card names. */
export interface LanguagePack {
  /** Official playgwent terms, keyed like phrases (e.g. `faction.MO`); they override phrases. */
  terms: Record<string, string>
  cards: Record<number, string>
}

/**
 * Maps a browser or URL language tag to a supported language.
 *
 * Exact matches win; otherwise the base language decides (`pt-PT` → `pt-BR`, `es-MX` → `es`, and any Chinese
 * variant → `zh-cn`, playgwent's only Chinese).
 *
 * @param tag - A BCP 47 tag such as `ru-RU`
 * @returns The supported language, or `undefined`
 */
export function matchLanguage(tag: string): Lang | undefined {
  const lower = tag.toLowerCase()
  const exact = LANGUAGES.find((l) => l.toLowerCase() === lower)
  if (exact) return exact
  const base = lower.split('-')[0]
  return LANGUAGES.find((l) => l.toLowerCase().split('-')[0] === base)
}

/**
 * Chooses the interface language: URL parameter, then saved choice, then browser preference, then English.
 *
 * @param param - `?lang=` value, if any
 * @param saved - Saved choice from localStorage, if any
 * @param browser - `navigator.languages`
 * @returns The language to use
 */
export function pickLanguage(param: string | null, saved: string | null, browser: readonly string[]): Lang {
  for (const tag of [param, saved, ...browser]) {
    const lang = tag ? matchLanguage(tag) : undefined
    if (lang) return lang
  }
  return 'en'
}

/**
 * Creates a phrase lookup for one language.
 *
 * Order: official terms (from the language pack) → the language's phrases → English → the key itself, so a
 * missing translation shows English rather than breaking. `{name}` placeholders are filled from `vars`, and a
 * plural phrase picks its form from `vars.n`.
 *
 * @param lang - Interface language
 * @param phrases - Phrase files by language (English required)
 * @param terms - Official terms for `lang`, if loaded
 * @returns `t(key, vars?)`
 */
export function createTranslator(
  lang: Lang,
  phrases: Partial<Record<Lang, Phrases>> & { en: Phrases },
  terms: Record<string, string> = {},
) {
  const plural = new Intl.PluralRules(lang)
  const pick = (p: Phrase | string[] | undefined, n: number | undefined): string | undefined => {
    if (p === undefined || Array.isArray(p)) return undefined
    if (typeof p === 'string') return p
    return p[n === undefined ? 'other' : plural.select(n)] ?? p.other
  }
  return function t(key: string, vars: Record<string, string | number> = {}): string {
    const n = typeof vars.n === 'number' ? vars.n : undefined
    const text = terms[key] ?? pick(phrases[lang]?.[key], n) ?? pick(phrases.en[key], n) ?? key
    return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
  }
}

/** Everything the UI needs to render in one language. */
export interface Locale {
  lang: Lang
  /** Phrase lookup; see {@link createTranslator}. */
  t: ReturnType<typeof createTranslator>
  /** Card name in this language (English until the language pack loads). */
  card: (id: number) => string
  num: (n: number) => string
  /** A date in this language, as its UTC day (like the data date, the same for everyone). */
  date: (iso: string) => string
  /** A playgwent URL with this language's path prefix (`https://www.playgwent.com/ru/decks/…`). */
  pg: (url: string) => string
}

/**
 * Adds a language prefix to a language-neutral playgwent URL.
 *
 * @param url - `https://www.playgwent.com/{path}` without a language segment
 * @param lang - Target language
 * @returns The localized URL; other URLs are returned unchanged
 */
export function playgwentUrl(url: string, lang: Lang): string {
  return url.replace(/^https:\/\/www\.playgwent\.com\//, `https://www.playgwent.com/${lang}/`)
}
