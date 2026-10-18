import { describe, expect, it } from 'vitest'
import { refreshStore, translateNames } from '../deck-refresh.ts'
import { NotFoundError } from '../polite-fetch.ts'
import type { DeckEntry } from '../sources.ts'
import type { StoredDeck } from '../store.ts'

const pgDeck = (hash: string) => ({
  hash,
  srcCardTemplates: [1, 100, 100],
  modified: '2026-09-30',
  leader: { id: 1 },
  stratagem: { id: 10 },
  cards: [],
})
const page = (hash: string) =>
  `<div data-state='${JSON.stringify({ deck: pgDeck(hash) }).replaceAll("'", '&#39;')}'></div>`
const DECK_URL = 'https://www.playgwent.com/decks/aaaa'
const GUIDE_URL = 'https://www.playgwent.com/decks/guides/7'
const deckEntry: DeckEntry = { name: 'Deck', url: DECK_URL, lang: 'en', source: 'shinmiri2' }
const guideEntry = (modified: string): DeckEntry => ({
  name: 'Guide',
  url: GUIDE_URL,
  lang: 'en',
  source: 'community',
  guide: { id: 7, modified, votes: 1, author: 'a' },
})

/** A fake fetcher: records URLs, serves a guide JSON or a deck page, or throws `NotFoundError`. */
function fakeGet(responses: Record<string, string | 404>) {
  const requested: string[] = []
  const get = async (url: string) => {
    requested.push(url)
    const r = responses[url]
    if (r === 404 || r === undefined) throw new NotFoundError(`404 ${url}`)
    return r
  }
  return { get, requested }
}

describe('refreshStore', () => {
  it('fetches a new deck once, storing its card list and dates', async () => {
    // Arrange
    const { get, requested } = fakeGet({ 'https://www.playgwent.com/en/decks/aaaa': page('h1') })
    const store: Record<string, StoredDeck> = {}

    // Act
    const result = await refreshStore([deckEntry, deckEntry], store, get)

    // Assert
    expect(result).toEqual({ fetched: 1, warnings: [] })
    expect(requested).toHaveLength(1)
    expect(store[DECK_URL]).toEqual({
      hash: 'h1',
      cards: [
        [1, 1],
        [100, 2],
      ],
      modified: '2026-09-30',
    })
  })

  it('leaves a stored deck alone', async () => {
    // Arrange
    const { get, requested } = fakeGet({})
    const store: Record<string, StoredDeck> = { [DECK_URL]: { hash: 'h1', cards: [], modified: 'x' } }

    // Act
    const result = await refreshStore([deckEntry], store, get)

    // Assert
    expect(result.fetched).toBe(0)
    expect(requested).toEqual([])
  })

  it('refetches an edited guide and warns if its deck changed', async () => {
    // Arrange
    const guide = JSON.stringify({ modified: 'api date, can lag', deck: pgDeck('h2') })
    const { get } = fakeGet({ 'https://www.playgwent.com/en/decks/api/guides/7': guide })
    const store: Record<string, StoredDeck> = {
      [GUIDE_URL]: { hash: 'h1', cards: [], modified: 'x', guideModified: 'old' },
    }

    // Act
    const result = await refreshStore([guideEntry('new')], store, get)

    // Assert
    expect(result.warnings).toEqual([expect.stringContaining('guide deck changed')])
    expect(store[GUIDE_URL]).toMatchObject({ hash: 'h2', guideModified: 'new' })
  })

  it('skips an unedited guide', async () => {
    // Arrange
    const { get, requested } = fakeGet({})
    const store: Record<string, StoredDeck> = {
      [GUIDE_URL]: {
        hash: 'h1',
        cards: [],
        modified: 'x',
        guideModified: 'same',
        guide: { words: 1, unique: 1, images: 0 },
      },
    }

    // Act
    await refreshStore([guideEntry('same')], store, get)

    // Assert
    expect(requested).toEqual([])
  })

  it('refetches a guide not measured yet, storing its measures and caching its text', async () => {
    // Arrange
    const api = 'https://www.playgwent.com/en/decks/api/guides/7'
    const content = {
      ops: [{ insert: 'Mulligan bronzes.\n' }, { insert: { video: 'https://www.youtube.com/embed/NJnObo5kR34' } }],
    }
    const { get, requested } = fakeGet({ [api]: JSON.stringify({ deck: pgDeck('h1'), content }) })
    const store: Record<string, StoredDeck> = {
      [GUIDE_URL]: { hash: 'h1', cards: [], modified: 'x', guideModified: 'same' },
    }
    const texts: Record<string, string> = {}

    // Act
    await refreshStore([guideEntry('same')], store, get, texts)

    // Assert
    expect(requested).toEqual([api])
    expect(store[GUIDE_URL]).toMatchObject({
      guide: { words: 2, unique: 2, images: 0, video: 'https://youtu.be/NJnObo5kR34' },
    })
    expect(texts).toEqual({ [GUIDE_URL]: 'Mulligan bronzes.' })
  })

  it('stores a dead link as missing and retries it next run', async () => {
    // Arrange
    const { get, requested } = fakeGet({})
    const store: Record<string, StoredDeck> = {}

    // Act
    const first = await refreshStore([deckEntry], store, get)
    await refreshStore([deckEntry], store, get)

    // Assert
    expect(store[DECK_URL]).toEqual({ missing: true })
    expect(first.warnings).toEqual([expect.stringContaining('not found')])
    expect(requested).toHaveLength(2)
  })

  it('stops on other errors, keeping what it fetched so far', async () => {
    // Arrange
    const store: Record<string, StoredDeck> = {}
    const other: DeckEntry = { ...deckEntry, url: 'https://www.playgwent.com/decks/bbbb' }
    const get = async (url: string) => {
      if (url.endsWith('aaaa')) return page('h1')
      throw new Error('HTTP 500')
    }

    // Act
    const act = refreshStore([deckEntry, other], store, get)

    // Assert
    await expect(act).rejects.toThrow('HTTP 500')
    expect(Object.keys(store)).toEqual([DECK_URL])
  })
})

describe('translateNames', () => {
  const glossary = () => new Map([['химера', 'Chimera']])

  it('skips saved names, saves glossary-only and machine translations', async () => {
    // Arrange
    const translations = { ru: { Старое: 'Old' } }
    const names = [
      { lang: 'ru', name: 'Старое' },
      { lang: 'ru', name: 'Химера' },
      { lang: 'ru', name: 'Химера колода' },
    ]
    const mt = async (text: string) => `MT(${text})`

    // Act
    const result = await translateNames(names, translations, glossary, mt)

    // Assert
    expect(result).toEqual({ added: 2, deferred: 0 })
    expect(translations.ru).toEqual({ Старое: 'Old', Химера: 'Chimera', 'Химера колода': 'MT(Chimera колода)' })
  })

  it('defers every remaining name once machine translation stops', async () => {
    // Arrange
    const translations: Record<string, Record<string, string>> = {}
    const names = [
      { lang: 'ru', name: 'Один' },
      { lang: 'ru', name: 'Два' },
    ]
    let calls = 0
    const mt = async () => {
      calls++
      return undefined
    }

    // Act
    const result = await translateNames(names, translations, glossary, mt)

    // Assert
    expect(result).toEqual({ added: 0, deferred: 2 })
    expect(calls).toBe(1)
    expect(translations).toEqual({})
  })

  it('saves a name without letters as is, without asking machine translation', async () => {
    // Arrange
    const translations: Record<string, Record<string, string>> = {}
    let calls = 0
    const mt = async () => {
      calls++
      return 'x'
    }

    // Act
    const result = await translateNames([{ lang: 'fr', name: '🔥🔥' }], translations, glossary, mt)

    // Assert
    expect(result).toEqual({ added: 1, deferred: 0 })
    expect(calls).toBe(0)
    expect(translations.fr).toEqual({ '🔥🔥': '🔥🔥' })
  })
})
