import { LANGUAGES } from '../../src/i18n.ts'
import { parseCardSearch, parseLocalizedNames, type SearchHit } from './cards.ts'
import type { GetBody } from './entries.ts'
import type { CatalogCard } from './store.ts'
import { extractTerms } from './terms.ts'

// The default search omits leaders, hence the second query.
const QUERIES = ['limit=2000&offset=0', 'type=1&limit=200&offset=0']

/** Current card data from playgwent: the catalog, localized card names and official terms. */
export interface CardData {
  cards: Record<number, CatalogCard>
  cardNames: Record<string, Record<number, string>>
  terms: Record<string, Record<string, string>>
}

/**
 * Fetches the card search in English and every other language, plus each language's deck-builder terms.
 *
 * @param get - Fetches a body (~33 requests)
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
  const cards = Object.fromEntries(parseCardSearch(await search('https://www.playgwent.com/en/decks/builder')))
  const cardNames: CardData['cardNames'] = {}
  const terms: CardData['terms'] = {}
  for (const lang of LANGUAGES.filter((l) => l !== 'en')) {
    const base = `https://www.playgwent.com/${lang}/decks/builder`
    terms[lang] = extractTerms(await get(base))
    cardNames[lang] = Object.fromEntries(parseLocalizedNames(await search(base), lang))
  }
  return { cards, cardNames, terms }
}
