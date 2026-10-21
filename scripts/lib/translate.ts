import { consola } from 'consola'
import type { GetBody } from './entries.ts'

/** Localized term (lowercase) → English, from Gwent's own localization. */
export type Glossary = Map<string, string>

// Common Russian noun/adjective case and plural endings, so "Огроиды" matches "огроид".
const RU_ENDINGS = 'ами|ями|ов|ей|ой|ом|ам|ах|ях|ы|и|а|я|у|ю|е'
// Scripts without reliable spaces between words, so terms match anywhere.
const NO_BOUNDARY_LANGS = new Set(['ko', 'ja', 'zh-cn'])
// A token containing any letter outside the Latin script.
const NON_LATIN_TOKEN = /\S*[^\P{L}\p{Script=Latin}]\S*/u

/**
 * Adds a localized/English pair; comma-separated category lists are paired item by item.
 *
 * @param glossary - Glossary to extend
 * @param local - Localized card name or category list
 * @param en - English counterpart
 */
export function addTerm(glossary: Glossary, local: string | null | undefined, en: string | null | undefined) {
  if (!local || !en) return
  const localParts = local.split(', ')
  const enParts = en.split(', ')
  if (localParts.length !== enParts.length) return
  localParts.forEach((l, i) => {
    // One-letter terms (e.g. a CJK character) would match inside unrelated words.
    if ([...l].length > 1) glossary.set(l.toLowerCase(), enParts[i])
  })
}

/**
 * Translates a deck name by replacing known Gwent terms, longest first.
 *
 * Russian terms also match with a case/plural ending (plurals -ы/-и get an English "s"); Korean,
 * Japanese and Chinese terms match without word boundaries.
 *
 * @param name - Deck name in `lang`
 * @param glossary - Known terms for `lang`
 * @param lang - playgwent language code
 * @returns The partly translated text, and whether machine translation is still needed: non-Latin
 *   text remains, or the language is Latin-script (where leftover foreign words can't be detected)
 */
export function translateName(name: string, glossary: Glossary, lang: string): { text: string; needsMt: boolean } {
  let text = name.trim().replace(/\s+/g, ' ')
  if (lang === 'en') return { text, needsMt: false }
  const endings = lang === 'ru' ? `(${RU_ENDINGS})?` : '()'
  const [before, after] = NO_BOUNDARY_LANGS.has(lang) ? ['', ''] : ['(?<!\\p{L})', '(?!\\p{L})']
  const terms = [...glossary.keys()].sort((a, b) => b.length - a.length)
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`${before}${escaped}${endings}${after}`, 'giu')
    text = text.replace(re, (_, ending = '') => {
      const en = glossary.get(term) ?? term
      return /^[ыи]$/i.test(ending) && !en.endsWith('s') ? `${en}s` : en
    })
  }
  const latinScript = !['ru', ...NO_BOUNDARY_LANGS].includes(lang)
  return { text, needsMt: latinScript || NON_LATIN_TOKEN.test(text) }
}

// MyMemory's language codes, where they differ from playgwent's.
const MM_LANG: Record<string, string> = { 'zh-cn': 'zh-CN' }

/**
 * A machine translator into English using MyMemory's free API, which has a daily quota.
 *
 * @param get - Fetches a body (the polite fetcher, which spaces requests out)
 * @returns `(text, lang) =>` the English text; `undefined` once the service stops answering (quota spent, an error,
 *   or an answer it can't read), so the caller defers the rest to the next run rather than failing
 */
export function myMemory(get: GetBody): (text: string, lang: string) => Promise<string | undefined> {
  return async (text, lang) => {
    const pair = `${MM_LANG[lang] ?? lang}|en`
    try {
      const res = JSON.parse(
        await get(
          `https://api.mymemory.translated.net/get?langpair=${encodeURIComponent(pair)}&q=${encodeURIComponent(text)}`,
        ),
      )
      if (res.responseStatus === 200 && res.responseData?.translatedText && !res.quotaFinished) {
        return res.responseData.translatedText as string
      }
      consola.warn(`MyMemory stopped (${res.responseDetails || res.responseStatus}); deferring the rest`)
    } catch (e) {
      consola.warn(`MyMemory failed (${(e as Error).message}); deferring the rest`)
    }
    return undefined
  }
}
