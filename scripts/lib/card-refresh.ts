import { LANGUAGES } from '../../src/i18n.ts'
import { abilityNamesFromText, parseCardSearch, parseLocalizedNames, type SearchHit } from './cards.ts'
import type { GetBody } from './entries.ts'
import type { CatalogCard } from './store.ts'
import { extractTagNames, extractTerms } from './terms.ts'

// The default search omits leaders, hence the second query.
const QUERIES = ['limit=2000&offset=0', 'type=1&limit=200&offset=0']

/** Current card data from playgwent: the catalog, localized card names and official terms. */
export interface CardData {
  cards: Record<number, CatalogCard>
  cardNames: Record<string, Record<number, string>>
  terms: Record<string, Record<string, string>>
  /** Per language (English included): tag key → name. */
  tags: Record<string, Record<string, string>>
}

/**
 * Fetches the card search in English and every other language, plus each language's deck-builder terms.
 *
 * @param get - Fetches a body (~34 requests)
 * @returns Card data, keyed as the stores keep it
 */
export async function fetchCardData(get: GetBody): Promise<CardData> {
  const search = async (base: string) => {
    const hits: SearchHit[] = []
    for (const query of QUERIES) {
      hits.push(...JSON.parse(await get(`${base}/api/search?${query}`)))
    }
    return hits
  }
  const english = 'https://www.playgwent.com/en/decks/builder'
  const cards = Object.fromEntries(parseCardSearch(await search(english)))
  const cardNames: CardData['cardNames'] = {}
  const terms: CardData['terms'] = {}
  const tags: CardData['tags'] = { en: extractTagNames(await get(english)) }
  for (const lang of LANGUAGES.filter((l) => l !== 'en')) {
    const base = `https://www.playgwent.com/${lang}/decks/builder`
    const page = await get(base)
    const hits = await search(base)
    terms[lang] = extractTerms(page)
    cardNames[lang] = Object.fromEntries(parseLocalizedNames(hits, lang))
    tags[lang] = { ...abilityNamesFromText(hits, lang), ...extractTagNames(page) }
  }
  return { cards, cardNames, terms, tags }
}
