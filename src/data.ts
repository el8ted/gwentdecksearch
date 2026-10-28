/** The deck data the page bundles, and the lookups built from it once at load. */
import dataJson from '../data/decks.json'
import { authorNames, indexDecks } from './filter.ts'
import { decodeState } from './hash.ts'
import { LANGUAGES } from './i18n.ts'
import type { Card, Dataset } from './types.ts'

// JSON imports widen literal types (type: string), so the shape is asserted; src/__tests__/data.test.ts checks it.
export const data = dataJson as unknown as Dataset
export const decks = indexDecks(data)

// In card ID order, which is the game's deck-builder order; fixed, so pills never move as counts change.
const ofType = (type: Card['type']) =>
  Object.keys(data.cards)
    .map(Number)
    .filter((id) => data.cards[id].type === type)
    .sort((a, b) => a - b)
export const LEADERS = ofType('leader')
export const STRATAGEMS = ofType('stratagem')
/** Guide and video languages any deck has, in the language menu's order: fixed, like the other pills. */
export const LANGS = LANGUAGES.filter((l) => decks.some((e) => e.langs.has(l)))
/** Author display names by key. */
export const AUTHORS = authorNames(decks, data.aliases)

const BY_ID = new Map(decks.map((e) => [e.deck.id, e]))
/** The deck with this ID; `undefined` for none (an unset filter) or an ID not in the data. */
export const deckById = (id: string | undefined) => (id === undefined ? undefined : BY_ID.get(id))

/** How many decks share each card list. */
export const LIST_SIZE = new Map<string, number>()
for (const e of decks) LIST_SIZE.set(e.list, (LIST_SIZE.get(e.list) ?? 0) + 1)

/** The filters in the address bar's hash, minus anything no longer in the data. */
export const readHash = () =>
  decodeState(
    location.hash,
    (id) => data.cards[id],
    (key) => Object.hasOwn(data.tags, key),
    (key) => AUTHORS.has(key),
    (id) => deckById(id)?.list,
  )
