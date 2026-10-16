import { describe, expect, it } from 'vitest'
import { countCopies, decodeEntities, extractDeck, toSecondaryFaction } from '../extract.ts'

const deckJson = (wrap: (deck: object) => object) =>
  JSON.stringify(wrap({ hash: 'abc', leader: { id: 1 }, srcCardTemplates: [1, 2, 2] })).replaceAll('"', '&quot;')

describe('toSecondaryFaction', () => {
  it('maps the verified enum values', () => {
    // Arrange
    const codes = [1, 2, 3, 4, 5]

    // Act
    const factions = codes.map(toSecondaryFaction)

    // Assert
    expect(factions).toEqual(['MO', 'NG', 'NR', 'ST', 'SK'])
  })

  it('throws for an unverified code', () => {
    // Arrange
    const code = 6

    // Act
    const act = () => toSecondaryFaction(code)

    // Assert
    expect(act).toThrow('Unknown secondary faction code 6')
  })
})

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities and leaves unknown ones', () => {
    // Arrange
    const text = '&quot;a&amp;b&#039;&#x2014;&bogus;'

    // Act
    const decoded = decodeEntities(text)

    // Assert
    expect(decoded).toBe(`"a&b'—&bogus;`)
  })

  it('leaves out-of-range code points as they are', () => {
    // Act
    const decoded = decodeEntities('&#x110000;&#99999999999;&#x10FFFF;')

    // Assert
    expect(decoded).toBe('&#x110000;&#99999999999;\u{10FFFF}')
  })
})

describe('extractDeck', () => {
  it('reads a deck page data-state', () => {
    // Arrange
    const html = `<div data-state='${deckJson((deck) => ({ deck }))}'></div>`

    // Act
    const deck = extractDeck(html)

    // Assert
    expect(deck.hash).toBe('abc')
  })

  it('reads a guide page data-state where the deck is nested', () => {
    // Arrange
    const html = `<div data-state="${deckJson((deck) => ({ guide: { id: 9, deck } }))}"></div>`

    // Act
    const deck = extractDeck(html)

    // Assert
    expect(deck.srcCardTemplates).toEqual([1, 2, 2])
  })

  it('normalizes a sparse-object card list to an array', () => {
    // Arrange
    const json = JSON.stringify({ deck: { leader: { id: 1 }, srcCardTemplates: { 0: 1, 2: 5 } } })
    const html = `<div data-state='${json.replaceAll('"', '&quot;')}'></div>`

    // Act
    const deck = extractDeck(html)

    // Assert
    expect(deck.srcCardTemplates).toEqual([1, 5])
  })

  it('throws when the page has no data-state', () => {
    // Arrange
    const html = '<html></html>'

    // Act
    const act = () => extractDeck(html)

    // Assert
    expect(act).toThrow('No data-state')
  })

  it('throws when data-state has no deck', () => {
    // Arrange
    const html = `<div data-state='{&quot;other&quot;:1}'></div>`

    // Act
    const act = () => extractDeck(html)

    // Assert
    expect(act).toThrow('no deck')
  })
})

describe('countCopies', () => {
  it('counts repeated IDs in first-seen order', () => {
    // Arrange
    const ids = [5, 3, 5, 7]

    // Act
    const counts = countCopies(ids)

    // Assert
    expect(counts).toEqual([
      [5, 2],
      [3, 1],
      [7, 1],
    ])
  })
})
