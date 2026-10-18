import type { GetBody } from './entries.ts'
import { countCopies, extractDeck, normalizeDeck, type PgDeck } from './extract.ts'
import { type GuideInfo, guideInfo } from './guide.ts'
import { NotFoundError } from './polite-fetch.ts'
import type { DeckEntry } from './sources.ts'
import type { StoredDeck } from './store.ts'
import { type Glossary, translateName } from './translate.ts'

/** Fetches one entry's deck: a guide through the guide API (with its text measured), anything else as a deck page. */
async function fetchDeck(
  entry: DeckEntry,
  get: GetBody,
): Promise<{ deck: PgDeck; guide?: { info: GuideInfo; text: string } }> {
  if (entry.guide) {
    const guide = JSON.parse(await get(`https://www.playgwent.com/${entry.lang}/decks/api/guides/${entry.guide.id}`))
    return { deck: normalizeDeck(guide.deck), guide: guideInfo(guide.content) }
  }
  return { deck: extractDeck(await get(entry.url.replace('playgwent.com/', `playgwent.com/${entry.lang}/`))) }
}

/**
 * Fetches the decks the store doesn't have yet, updating `store` in place (so a caller can save progress even if
 * a later fetch throws). A published deck never changes, so a stored deck is only refetched when its guide was
 * edited (the listing's `modified` moved) or hasn't been measured yet; a dead link is retried every run.
 *
 * @param entries - Current deck links
 * @param store - Deck store, updated in place
 * @param get - Fetches a body; throws {@link NotFoundError} for a dead link
 * @param texts - Guide text by URL, updated in place (a local cache)
 * @returns How many were fetched, and warnings (dead links, a guide whose deck changed)
 */
export async function refreshStore(
  entries: DeckEntry[],
  store: Record<string, StoredDeck>,
  get: GetBody,
  texts: Record<string, string> = {},
): Promise<{ fetched: number; warnings: string[] }> {
  const warnings: string[] = []
  const seen = new Set<string>()
  let fetched = 0
  for (const entry of entries) {
    if (seen.has(entry.url)) continue
    seen.add(entry.url)
    const old = store[entry.url]
    const stale =
      old && !('missing' in old) && entry.guide && (old.guideModified !== entry.guide.modified || !old.guide)
    if (old && !('missing' in old) && !stale) continue
    fetched++
    try {
      const { deck, guide } = await fetchDeck(entry, get)
      // The listing's date is what the next run compares; the guide API's own date can lag behind it.
      const guideModified = entry.guide?.modified
      if (old && !('missing' in old) && old.hash !== deck.hash) {
        warnings.push(`guide deck changed: ${entry.name} — ${entry.url} (${old.hash} → ${deck.hash})`)
      }
      store[entry.url] = {
        hash: deck.hash,
        cards: countCopies(deck.srcCardTemplates),
        modified: deck.modified,
        ...(guideModified && { guideModified }),
        ...(guide && { guide: guide.info }),
      }
      if (guide) texts[entry.url] = guide.text
    } catch (e) {
      if (!(e instanceof NotFoundError)) throw e
      store[entry.url] = { missing: true }
      warnings.push(`not found: [${entry.source}] ${entry.name} — ${entry.url}`)
    }
  }
  return { fetched, warnings }
}

/**
 * Translates deck names that have no saved translation: the glossary first, then machine translation for what's
 * left. Results are saved into `translations`; once machine translation fails, the rest wait for the next run.
 *
 * @param names - Original names and languages (from the build's `Deck.original`)
 * @param translations - Saved translations by language, updated in place
 * @param glossary - A language's glossary
 * @param mt - Machine-translates text; `undefined` when the service stopped (quota, error)
 * @returns How many names were added, and how many wait for machine translation
 */
export async function translateNames(
  names: { lang: string; name: string }[],
  translations: Record<string, Record<string, string>>,
  glossary: (lang: string) => Glossary,
  mt: (text: string, lang: string) => Promise<string | undefined>,
): Promise<{ added: number; deferred: number }> {
  let added = 0
  let deferred = 0
  let mtStopped = false
  for (const { lang, name } of names) {
    if (translations[lang]?.[name]) continue
    let { text, needsMt } = translateName(name, glossary(lang), lang)
    // Nothing to translate (e.g. only emoji): MyMemory rejects it, which would read as the service stopping.
    if (needsMt && /\p{L}/u.test(text)) {
      const result = mtStopped ? undefined : await mt(text, lang)
      if (result === undefined) {
        // Not saved: an untranslated name is retried on the next run.
        mtStopped = true
        deferred++
        continue
      }
      text = result
    }
    translations[lang] ??= {}
    translations[lang][name] = text
    added++
  }
  return { added, deferred }
}
