/** The page's languages: interface phrases (bundled) and card names and game terms (language packs, loaded later). */
import { data } from '../data.ts'
import de from '../i18n/de.json'
import en from '../i18n/en.json'
import es from '../i18n/es.json'
import fr from '../i18n/fr.json'
import it from '../i18n/it.json'
import ja from '../i18n/ja.json'
import ko from '../i18n/ko.json'
import pl from '../i18n/pl.json'
import ptBR from '../i18n/pt-BR.json'
import ru from '../i18n/ru.json'
import zhCn from '../i18n/zh-cn.json'
import { createTranslator, type Lang, type LanguagePack, type Locale, type Phrases, playgwentUrl } from '../i18n.ts'

const PHRASES = { en, de, es, fr, it, ja, ko, pl, 'pt-BR': ptBR, ru, 'zh-cn': zhCn } as Partial<
  Record<Lang, Phrases>
> & {
  en: Phrases
}

/**
 * Everything the page needs to render in one language.
 *
 * @param lang - Interface language
 * @param pack - Its language pack, once loaded: card and tag names and official terms; English names until then
 * @returns The locale
 */
export function makeLocale(lang: Lang, pack?: LanguagePack): Locale {
  const num = new Intl.NumberFormat(lang)
  const date = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' })
  const names = new Intl.DisplayNames(lang, { type: 'language' })
  return {
    lang,
    t: createTranslator(lang, PHRASES, pack?.terms),
    card: (id) => pack?.cards[id] ?? data.cards[id]?.name ?? String(id),
    tag: (key) => pack?.tags?.[key] ?? data.tags[key] ?? key,
    num: (n) => num.format(n),
    langName: (code) => {
      try {
        return names.of(code) ?? code
      } catch {
        // A code that isn't a language tag at all.
        return code
      }
    },
    date: (iso) => date.format(new Date(iso)),
    pg: (url) => playgwentUrl(url, lang),
  }
}

/**
 * Loads a language pack by script tag, which works from file://.
 *
 * @param lang - The language
 * @returns The pack; `undefined` for English (it has none) or if it fails to load
 */
export function loadPack(lang: Lang): Promise<LanguagePack | undefined> {
  if (lang === 'en') return Promise.resolve(undefined)
  const loaded = globalThis.GDS_I18N?.[lang]
  if (loaded) return Promise.resolve(loaded)
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = `i18n/${lang}.js`
    script.onload = () => resolve(globalThis.GDS_I18N?.[lang])
    script.onerror = () => resolve(undefined)
    document.head.append(script)
  })
}
