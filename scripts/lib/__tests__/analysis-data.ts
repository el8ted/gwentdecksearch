import { indexDecks } from '../../../src/filter.ts'
import { type Card, type Dataset, type Deck, RARITIES } from '../../../src/types.ts'
import type { AnalysisData } from '../analysis.ts'
import type { CatalogCard } from '../store.ts'

const card = (
  name: string,
  type: CatalogCard['type'],
  faction: CatalogCard['faction'],
  provisions: number,
  more: Partial<CatalogCard> = {},
): CatalogCard => ({ name, type, faction, provisions, craftingCost: 30, rarity: 5, ...more })

/** Leaders 1 (MO, +15), 2 (NG, +16), 3 (SY, +15); stratagem 10; Prophet and Farseer share a Chinese name. */
export const CATALOG: Record<string, CatalogCard> = {
  1: card('Arachas Swarm', 'leader', 'MO', 15),
  2: card('Imperial Formation', 'leader', 'NG', 16),
  3: card('Jackpot', 'leader', 'SY', 15),
  10: card('Tactical Advantage', 'stratagem', 'NE', 0),
  100: card('Caranthir Ar-Feiniel', 'unit', 'MO', 9),
  101: card('Nekker', 'unit', 'MO', 4),
  102: card('Royal Decree', 'special', 'NE', 9),
  103: card('Ffion var Gaernel', 'unit', 'NG', 11, { tags: ['defender'] }),
  104: card('Kolgrim', 'unit', 'NG', 10, { power: 6 }),
  105: card('Prophet', 'unit', 'NG', 7),
  106: card('Farseer', 'unit', 'ST', 6),
  202425: card('Azar Javed', 'unit', 'SY', 10),
}

// Provisions used, as the data build counts them: every card but the leader (stratagems cost 0).
const used = (cards: [number, number][]) =>
  cards.reduce((n, [id, k]) => (CATALOG[id].type === 'leader' ? n : n + CATALOG[id].provisions * k), 0)
const deck = (id: string, cards: [number, number][], more: Partial<Deck> = {}): Deck => ({
  name: id,
  id,
  url: `https://www.playgwent.com/decks/${id}`,
  stats: { scraps: 0, cards: 25, units: 20, provisions: used(cards) },
  sources: ['community'],
  cards,
  ...more,
})

/**
 * Monsters (limit 165): A exactly on it, with Caranthir and a video; B 8 spare, with Caranthir; C 1 over, without.
 * D (Nilfgaard) runs Ffion and Kolgrim; E (Syndicate) runs Azar Javed.
 */
export const DATASET: Dataset = {
  scrapedAt: '2026-10-22T00:00:00Z',
  cards: Object.fromEntries(
    Object.entries(CATALOG).map(([id, c]): [string, Card] => [
      id,
      { ...c, scraps: c.craftingCost, rarity: RARITIES[0] } as Card,
    ]),
  ),
  tags: { defender: 'Defender' },
  decks: [
    deck(
      'A',
      [
        [1, 1],
        [10, 1],
        [100, 1],
        [101, 39],
      ],
      { updated: '2026-08-01T00:00:00Z', video: { url: 'https://youtu.be/AAAAAAAAAAA', lang: 'en' } },
    ),
    deck(
      'B',
      [
        [1, 1],
        [10, 1],
        [100, 1],
        [101, 37],
      ],
      { updated: '2025-03-01T00:00:00Z' },
    ),
    deck('C', [
      [1, 1],
      [10, 1],
      [101, 37],
      [102, 2],
    ]),
    deck(
      'D',
      [
        [2, 1],
        [10, 1],
        [103, 1],
        [104, 1],
        [102, 1],
      ],
      { updated: '2025-11-01T00:00:00Z' },
    ),
    deck('E', [
      [3, 1],
      [10, 1],
      [202425, 1],
      [102, 1],
    ]),
  ],
}

/** The fixture as the analysis scripts see it. */
export const DATA: AnalysisData = {
  dataset: DATASET,
  decks: indexDecks(DATASET),
  catalog: CATALOG,
  names: {
    en: Object.fromEntries(Object.entries(CATALOG).map(([id, c]) => [id, c.name])),
    ru: { 100: 'Каранир' },
    'zh-cn': { 100: '卡兰希尔', 105: '先知', 106: '先知' },
  },
  tags: { en: { defender: 'Defender', c63: 'Dragon' }, 'zh-cn': { defender: '卫士' } },
}
