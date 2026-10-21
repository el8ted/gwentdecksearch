import { describe, expect, it } from 'vitest'
import {
  authorKey,
  authorNames,
  budgetOf,
  budgetSide,
  cardChanges,
  cardFrequency,
  craftList,
  type FilterState,
  facets,
  type IndexedDeck,
  indexDecks,
  listForUrl,
  matchDecks,
  overlap,
  provisionStatus,
  sharedCards,
  singleFaction,
} from '../filter.ts'
import type { Card, Dataset, Deck } from '../types.ts'

// Leaders 1 (MO, +15) and 2 (NG, +16); stratagems 10, 11; cards 100–103.
const card = (name: string, type: Card['type'], faction: Card['faction'], provisions: number): Card => ({
  name,
  type,
  faction,
  provisions,
  scraps: 30,
  rarity: 'common',
})
const CARDS: Dataset['cards'] = {
  1: { ...card('Arachas Swarm', 'leader', 'MO', 15), tags: ['spawn'] },
  2: card('Imperial Formation', 'leader', 'NG', 16),
  10: card('Enchanted Armor', 'stratagem', 'NE', 0),
  11: card('Tactical Advantage', 'stratagem', 'NE', 0),
  100: { ...card('Golden Nekker', 'special', 'NE', 14), tags: ['deploy'] },
  101: { ...card('Chimera', 'unit', 'MO', 5), tags: ['c18'] },
  102: card('Royal Decree', 'special', 'NE', 9),
  103: { ...card('Cadaverine', 'special', 'NG', 6), tags: ['deploy', 'poison'] },
  104: { ...card('Tatterwing', 'unit', 'SY', 9), secondaryFaction: 'MO' },
  105: card('Moonlight', 'special', 'MO', 8),
}
const deck = (
  name: string,
  id: string,
  provisions: number,
  cards: [number, number][],
  sources: Deck['sources'] = ['shinmiri2'],
): Deck => ({
  name,
  id,
  url: `https://www.playgwent.com/decks/${id}`,
  stats: { scraps: 0, cards: 25, units: 13, provisions },
  sources,
  cards,
})
const DATA: Dataset = {
  scrapedAt: '2026-10-13',
  cards: CARDS,
  tags: {},
  decks: [
    deck('GN Swarm', 'a1', 166, [
      [1, 1],
      [10, 1],
      [100, 1],
      [101, 2],
      [102, 1],
    ]),
    deck('Portal', 'b1', 165, [
      [1, 1],
      [11, 1],
      [101, 2],
      [102, 1],
    ]),
    {
      ...deck(
        'Portal',
        'b2',
        160,
        [
          [1, 1],
          [11, 1],
          [101, 1],
        ],
        ['metallic-danny'],
      ),
      video: { url: 'https://youtu.be/AAAAAAAAAAA', lang: 'ru' },
    },
    {
      ...deck(
        'Soldiers',
        'c1',
        166,
        [
          [2, 1],
          [10, 1],
          [103, 2],
          [102, 1],
        ],
        ['community', 'shinmiri2'],
      ),
      guideLang: 'en',
      author: 'Merchant of Mirrors',
    },
  ],
}
const DECKS = indexDecks(DATA)
const state = (s: Partial<FilterState> = {}): FilterState => ({ factions: [], picks: [], ...s })
const ids = (decks: { deck: Deck }[]) => decks.map((e) => e.deck.id)

describe('indexDecks', () => {
  it('takes faction from the leader, not neutral stratagems', () => {
    // Arrange
    const data = DATA

    // Act
    const [first, , , last] = indexDecks(data)

    // Assert
    expect([first.faction, first.leader, first.stratagem]).toEqual(['MO', 1, 10])
    expect(last.faction).toBe('NG')
  })

  it('throws for a deck without a leader', () => {
    // Arrange
    const data = { ...DATA, decks: [deck('Broken', 'x', 0, [[10, 1]])] }

    // Act
    const act = () => indexDecks(data)

    // Assert
    expect(act).toThrow('lacks a leader')
  })
})

describe('provisionStatus', () => {
  it('reports over, exact and spare against 150 + leader bonus', () => {
    // Arrange
    const [over, exact, spare] = DECKS

    // Act
    const statuses = [over, exact, spare].map((e) => provisionStatus(e, CARDS))

    // Assert
    expect(statuses).toEqual([
      { limit: 165, used: 166, delta: -1 },
      { limit: 165, used: 165, delta: 0 },
      { limit: 165, used: 160, delta: 5 },
    ])
  })
})

describe('matchDecks', () => {
  it('returns every deck for empty filters', () => {
    // Arrange
    const s = state()

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['a1', 'b1', 'b2', 'c1'])
  })

  it('requires faction, leader, stratagem and every card to match', () => {
    // Arrange
    const s = state({ factions: ['MO'], leader: 1, stratagem: 11, picks: [102] })

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['b1'])
  })

  it('keeps same-name alternates that both match', () => {
    // Arrange
    const s = state({ picks: [101] })

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['a1', 'b1', 'b2'])
  })
})

describe('matchDecks card matching', () => {
  it('requires every selected card by default, sorted by name then id', () => {
    // Arrange
    const s = state({ picks: [101, 102] })

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['a1', 'b1'])
  })

  it('with match any, keeps decks with at least one card, most hits first', () => {
    // Arrange
    const s = state({ match: 'any', picks: [101, 102, 103] })

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['a1', 'b1', 'c1', 'b2'])
  })

  it('still applies the faction filter with match any', () => {
    // Arrange
    const s = state({ match: 'any', factions: ['NG'], picks: [101, 102] })

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['c1'])
  })
})

describe('matchDecks tag matching', () => {
  it("counts a tag on any of the deck's cards, leader included", () => {
    // Act
    const [deploy, spawn] = [
      matchDecks(DECKS, state({ picks: ['deploy'] })),
      matchDecks(DECKS, state({ picks: ['spawn'] })),
    ]

    // Assert
    expect(ids(deploy)).toEqual(['a1', 'c1'])
    expect(ids(spawn)).toEqual(['a1', 'b1', 'b2'])
  })

  it('treats tags like cards under all and any', () => {
    // Arrange
    const wanted = { picks: [103, 'c18'] }

    // Act
    const [all, any] = [matchDecks(DECKS, state(wanted)), matchDecks(DECKS, state({ ...wanted, match: 'any' }))]

    // Assert
    expect(ids(all)).toEqual([])
    expect(ids(any)).toEqual(['a1', 'b1', 'b2', 'c1'])
  })

  it('ranks decks with more selected tags first under any', () => {
    // Act
    const result = matchDecks(DECKS, state({ picks: ['deploy', 'c18'], match: 'any' }))

    // Assert
    expect(ids(result)).toEqual(['a1', 'b1', 'b2', 'c1'])
  })
})

describe('facets', () => {
  it('offers only the tags the matching decks have', () => {
    // Act
    const f = facets(DECKS, state({ picks: [103] }))

    // Assert
    expect(f.tags).toEqual(
      new Map([
        ['deploy', 1],
        ['poison', 1],
      ]),
    )
  })

  it('counts each dimension with its own filter removed', () => {
    // Arrange
    const s = state({ leader: 1, stratagem: 11 })

    // Act
    const f = facets(DECKS, s)

    // Assert
    expect(f.leaders).toEqual(new Map([[1, 2]]))
    expect(f.stratagems).toEqual(
      new Map([
        [10, 1],
        [11, 2],
      ]),
    )
    expect(f.factions).toEqual(new Map([['MO', 2]]))
    expect(f.cards).toEqual(
      new Map([
        [101, 2],
        [102, 1],
      ]),
    )
  })

  it('applies the any/all card match', () => {
    // Arrange
    const all = state({ picks: [100, 103] })
    const any = state({ match: 'any', picks: [100, 103] })

    // Act
    const [fAll, fAny] = [facets(DECKS, all), facets(DECKS, any)]

    // Assert
    expect(fAll.factions.size).toBe(0)
    expect(fAny.factions).toEqual(
      new Map([
        ['MO', 1],
        ['NG', 1],
      ]),
    )
  })
})

describe('cardFrequency', () => {
  it('counts unseen non-leader, non-stratagem cards, most common first', () => {
    // Arrange
    const decks = matchDecks(DECKS, state({ leader: 1 }))

    // Act
    const result = cardFrequency(decks, [101], CARDS)

    // Assert
    expect(result).toEqual([
      [102, 2],
      [100, 1],
    ])
  })

  it('lists least common first, ties by name when rarities match', () => {
    // Arrange
    const decks = DECKS

    // Act
    const result = cardFrequency(decks, [], CARDS, 'least')

    // Assert
    expect(result).toEqual([
      [103, 1],
      [100, 1],
      [101, 3],
      [102, 3],
    ])
  })

  it('breaks least-common ties legendary first', () => {
    // Arrange
    const cards = { ...CARDS, 100: { ...CARDS[100], rarity: 'legendary' as const } }

    // Act
    const result = cardFrequency(DECKS, [], cards, 'least')

    // Assert
    expect(result.slice(0, 2)).toEqual([
      [100, 1],
      [103, 1],
    ])
  })
})

describe('singleFaction', () => {
  it('names the faction of a single-faction card', () => {
    // Act
    const result = singleFaction(CARDS[101])

    // Assert
    expect(result).toBe('MO')
  })

  it('is undefined for neutral and dual-faction cards', () => {
    // Act
    const result = [CARDS[100], CARDS[104]].map(singleFaction)

    // Assert
    expect(result).toEqual([undefined, undefined])
  })
})

describe('source filtering', () => {
  it('keeps decks listed by any selected source', () => {
    // Arrange
    const s = state({ sources: ['community', 'metallic-danny'] })

    // Act
    const result = matchDecks(DECKS, s)

    // Assert
    expect(ids(result)).toEqual(['b2', 'c1'])
  })

  it('counts each source a deck belongs to, ignoring the source filter itself', () => {
    // Arrange
    const s = state({ sources: ['community'] })

    // Act
    const f = facets(DECKS, s)

    // Assert
    expect(f.sources).toEqual(
      new Map([
        ['shinmiri2', 3],
        ['metallic-danny', 1],
        ['community', 1],
      ]),
    )
  })
})

describe('video filtering', () => {
  it('keeps only decks with a video, and counts them ignoring that filter', () => {
    // Arrange
    const s = state({ video: true, factions: ['MO'] })

    // Act
    const [result, f, ng] = [matchDecks(DECKS, s), facets(DECKS, s), facets(DECKS, state({ factions: ['NG'] }))]

    // Assert
    expect(ids(result)).toEqual(['b2'])
    expect(f.videos).toBe(1)
    expect(f.factions.get('MO')).toBe(1)
    expect(ng.videos).toBe(0)
  })
})

describe('language filtering', () => {
  it("matches a guide's or a video's language, and counts each ignoring that filter", () => {
    // Arrange: b2 has a Russian video, c1 an English guide
    const s = state({ langs: ['ru'] })

    // Act
    const [ru, both, f] = [matchDecks(DECKS, s), matchDecks(DECKS, state({ langs: ['ru', 'en'] })), facets(DECKS, s)]

    // Assert
    expect(ids(ru)).toEqual(['b2'])
    expect(ids(both)).toEqual(['b2', 'c1'])
    expect(f.langs).toEqual(
      new Map([
        ['ru', 1],
        ['en', 1],
      ]),
    )
  })
})

describe('author matching', () => {
  it("matches a guide's author, or a list's owner by their playgwent name, ignoring case", () => {
    // Act
    const [guide, owner] = [
      matchDecks(DECKS, state({ picks: [`@${authorKey('merchant OF mirrors')}`] })),
      matchDecks(DECKS, state({ picks: ['@shinmiri2'] })),
    ]

    // Assert
    expect(ids(guide)).toEqual(['c1'])
    expect(ids(owner)).toEqual(['a1', 'b1', 'c1'])
  })

  it("counts each author's decks and names them, list owners by their playgwent name", () => {
    // Act
    const [f, names] = [facets(DECKS, state()), authorNames(DECKS)]

    // Assert
    expect(f.authors).toEqual(
      new Map([
        ['shinmiri2', 3],
        ['metallicdanny', 1],
        ['merchant of mirrors', 1],
      ]),
    )
    expect(names.get('merchant of mirrors')).toBe('Merchant of Mirrors')
    expect(names.get('metallicdanny')).toBe('MetallicDanny')
  })
})

describe('budgetOf', () => {
  it('steps 1, 2, then 3 or more on each side of exact', () => {
    // Act
    const steps = [-9, -3, -2, -1, 0, 1, 2, 3, 40].map(budgetOf)

    // Assert
    expect(steps).toEqual(['over3', 'over3', 'over2', 'over1', 'exact', 'spare1', 'spare2', 'spare3', 'spare3'])
    expect(steps.map(budgetSide)).toEqual(['over', 'over', 'over', 'over', 'exact', 'spare', 'spare', 'spare', 'spare'])
  })
})

describe('provision status filtering', () => {
  it('classifies each deck against 150 + leader bonus', () => {
    // Arrange
    const decks = DECKS

    // Act
    const budgets = decks.map((e) => [e.deck.id, e.budget])

    // Assert
    expect(budgets).toEqual([
      ['a1', 'over1'],
      ['b1', 'exact'],
      ['b2', 'spare3'],
      ['c1', 'exact'],
    ])
  })

  it('keeps decks with any selected status and counts statuses ignoring that filter', () => {
    // Arrange
    const s = state({ budgets: ['spare3', 'over1'] })

    // Act
    const [result, f] = [matchDecks(DECKS, s), facets(DECKS, s)]

    // Assert
    expect(ids(result)).toEqual(['a1', 'b2'])
    expect(f.budgets).toEqual(
      new Map([
        ['over1', 1],
        ['exact', 2],
        ['spare3', 1],
      ]),
    )
  })
})

describe('sharedCards', () => {
  it('returns cards in every deck, leader included', () => {
    // Arrange
    const decks = matchDecks(DECKS, state({ leader: 1 }))

    // Act
    const result = sharedCards(decks)

    // Assert
    expect([...result].sort()).toEqual([1, 101])
  })

  it('is empty for no decks', () => {
    // Arrange
    const decks: IndexedDeck[] = []

    // Act
    const result = sharedCards(decks)

    // Assert
    expect(result.size).toBe(0)
  })
})

describe('cardChanges', () => {
  const byId = (id: string) => DECKS.find((e) => e.deck.id === id) as IndexedDeck

  it('lists added and swapped-out cards, stratagem included', () => {
    // Act
    const { added, removed } = cardChanges(byId('b1'), byId('a1'))

    // Assert
    expect([...added]).toEqual([
      [10, 1],
      [100, 1],
    ])
    expect(removed).toEqual([[11, 1]])
  })

  it('counts extra copies of a card both decks run', () => {
    // Act
    const { added, removed } = cardChanges(byId('b2'), byId('b1'))

    // Assert
    expect(added.get(101)).toBe(1)
    expect(removed).toEqual([])
  })

  it('finds no changes against itself', () => {
    // Act
    const { added, removed } = cardChanges(byId('a1'), byId('a1'))

    // Assert
    expect([added.size, removed.length]).toEqual([0, 0])
  })
})

describe('matchDecks sorting', () => {
  it('sorts by the name each deck is shown under', () => {
    // Arrange: shown names in another order than the English ones (GN Swarm, Portal, Portal, Soldiers)
    const shown: Record<string, string> = { a1: 'Яд', b1: 'Барьер', b2: 'Барьер', c1: 'Вихрь' }

    // Act
    const ids = matchDecks(DECKS, state(), undefined, (d) => shown[d.id]).map((e) => e.deck.id)

    // Assert
    expect(ids).toEqual(['b1', 'b2', 'c1', 'a1'])
  })
})

describe('craftList', () => {
  it('ranks by the matching decks running each card, then name', () => {
    // Act
    const rows = craftList(DECKS, [], CARDS)

    // Assert: 101 and 102 tie on 3 decks, 100 and 103 on 1, all common
    expect(rows.map(({ id, decks }) => [id, decks])).toEqual([
      [101, 3],
      [102, 3],
      [103, 1],
      [100, 1],
    ])
  })

  it('breaks ties legendary first, then by name in the page language', () => {
    // Arrange
    const cards = { ...CARDS, 102: { ...CARDS[102], rarity: 'legendary' as const } }
    const nameOf = (id: number) => ({ 100: 'A', 103: 'B' })[id] ?? CARDS[id].name

    // Act
    const rows = craftList(DECKS, [], cards, nameOf)

    // Assert
    expect(rows.map((r) => r.id)).toEqual([102, 101, 100, 103])
  })

  it('counts two copies when at least half the decks running a card run two', () => {
    // Act
    const copies = Object.fromEntries(craftList(DECKS, [], CARDS).map((r) => [r.id, r.copies]))

    // Assert
    expect(copies).toEqual({ 100: 1, 101: 2, 102: 1, 103: 2 })
  })

  it('leaves out picked cards', () => {
    // Act
    const rows = craftList(DECKS, [102], CARDS)

    // Assert
    expect(rows.map((r) => r.id)).toEqual([101, 103, 100])
  })
})

describe('deck URLs', () => {
  // A guide, a sheet deck with the same list in another order, and an unrelated deck.
  const GUIDE = 'f93d165652a1c36c68ce4cd1095f2583'
  const TWIN = '3c3e3dc159b34988cb91f079ab8d1ad4'
  const OTHER = 'a39641ec3acba061069d274b0c17189a'
  const list: [number, number][] = [
    [1, 1],
    [10, 1],
    [101, 2],
  ]
  const decks = indexDecks({
    ...DATA,
    decks: [
      { ...deck('Guide', GUIDE, 160, list), url: 'https://www.playgwent.com/decks/guides/408411' },
      deck('Twin', TWIN, 160, [...list].reverse()),
      deck('Other', OTHER, 160, [...list, [102, 1]]),
    ],
  })

  it('gives decks with the same cards the same list, whatever the order', () => {
    // Act
    const lists = decks.map((e) => e.list)

    // Assert
    expect(lists).toEqual([GUIDE, GUIDE, OTHER])
  })

  it('finds a deck by guide number or hash, with or without scheme, www and a language segment', () => {
    // Arrange
    const urls = [
      'https://www.playgwent.com/en/decks/guides/408411',
      'playgwent.com/pt-BR/decks/guides/408411/',
      `  www.playgwent.com/decks/${TWIN.toUpperCase()}?utm=x  `,
      `http://playgwent.com/decks/${TWIN}#top`,
    ]

    // Act
    const found = urls.map((u) => listForUrl(decks, u))

    // Assert
    expect(found).toEqual([GUIDE, GUIDE, GUIDE, GUIDE])
  })

  it('finds nothing for an unknown deck, another site or plain text', () => {
    // Arrange
    const texts = [
      'https://www.playgwent.com/decks/guides/1',
      'https://www.playgwent.com/decks/0123456789abcdef',
      `https://example.com/decks/${TWIN}`,
      'http',
      'Tyr',
    ]

    // Act
    const found = texts.map((t) => listForUrl(decks, t))

    // Assert
    expect(found).toEqual([undefined, undefined, undefined, undefined, undefined])
  })

  it('narrows matches to the list, alongside other filters', () => {
    // Act
    const all = matchDecks(decks, state({ deck: GUIDE }))
    const none = matchDecks(decks, state({ deck: GUIDE, factions: ['NG'] }))

    // Assert
    expect(ids(all)).toEqual([GUIDE, TWIN])
    expect(none).toEqual([])
  })
})

describe('similar decks', () => {
  const [a1, b1, b2] = DECKS

  it('counts shared cards with copies, leaving out leader and stratagem', () => {
    // Act
    const counts = [overlap(a1, b1), overlap(a1, b2), overlap(b2, a1)]

    // Assert: a1 and b1 share Chimera ×2 and Royal Decree; b2 runs Chimera once
    expect(counts).toEqual([3, 1, 1])
  })

  it('ranks the deck itself first, then by cards in common, ties by name', () => {
    // Act
    const ranked = matchDecks(DECKS, state({ near: 'a1' }), 0)

    // Assert
    expect(ids(ranked)).toEqual(['a1', 'b1', 'b2', 'c1'])
  })

  it('keeps only decks sharing at least minShared cards, in the counts too', () => {
    // Act
    const ranked = matchDecks(DECKS, state({ near: 'a1' }), 2)
    const counts = facets(DECKS, state({ near: 'a1' }), 2)

    // Assert
    expect(ids(ranked)).toEqual(['a1', 'b1'])
    expect([...counts.leaders]).toEqual([[1, 2]])
  })

  it('still applies the other filters', () => {
    // Act
    const ranked = matchDecks(DECKS, state({ near: 'a1', leader: 1, picks: [101], sources: ['metallic-danny'] }), 0)

    // Assert
    expect(ids(ranked)).toEqual(['b2'])
  })
})

describe('excluded picks', () => {
  it('drop decks with an excluded card', () => {
    // Act
    const matched = matchDecks(DECKS, state({ picks: [102], excludes: [102] }))

    // Assert: only Portal b2 lacks Royal Decree
    expect(ids(matched)).toEqual(['b2'])
  })

  it('leave All to the wanted picks', () => {
    // Act
    const matched = matchDecks(DECKS, state({ picks: [101, 102], excludes: [102] }))

    // Assert
    expect(ids(matched)).toEqual(['b2'])
  })

  it('still exclude in Any mode', () => {
    // Act
    const matched = matchDecks(DECKS, state({ match: 'any', picks: [100, 103, 101], excludes: [101] }))

    // Assert: GN Swarm has Golden Nekker but also Chimera; Soldiers has Cadaverine and no Chimera
    expect(ids(matched)).toEqual(['c1'])
  })

  it('work alone, for tags too, and in the counts', () => {
    // Act
    const matched = matchDecks(DECKS, state({ picks: ['deploy'], excludes: ['deploy'] }))
    const counts = facets(DECKS, state({ picks: [102], excludes: [102] }))

    // Assert
    expect(ids(matched)).toEqual(['b1', 'b2'])
    expect([...counts.leaders]).toEqual([[1, 1]])
  })
})
