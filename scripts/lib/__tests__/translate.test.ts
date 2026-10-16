import { describe, expect, it } from 'vitest'
import { addTerm, type Glossary, translateName } from '../translate.ts'

function glossary(): Glossary {
  const g: Glossary = new Map()
  addTerm(g, 'Моровая дева', 'Plague Maiden')
  addTerm(g, 'Туго', 'Tugo')
  addTerm(g, 'Огроид, Друид', 'Ogroid, Druid')
  addTerm(g, 'Реликт', 'Relict')
  return g
}

describe('addTerm', () => {
  it('pairs category lists item by item and lowercases keys', () => {
    // Arrange
    const g: Glossary = new Map()

    // Act
    addTerm(g, 'Огроид, Друид', 'Ogroid, Druid')

    // Assert
    expect([...g]).toEqual([
      ['огроид', 'Ogroid'],
      ['друид', 'Druid'],
    ])
  })

  it('skips one-letter terms', () => {
    // Arrange
    const g: Glossary = new Map()

    // Act
    addTerm(g, '龙', 'Dragon')

    // Assert
    expect(g.size).toBe(0)
  })

  it('skips mismatched lists and missing values', () => {
    // Arrange
    const g: Glossary = new Map()

    // Act
    addTerm(g, 'Огроид, Друид', 'Ogroid')
    addTerm(g, null, 'Ogroid')
    addTerm(g, 'Огроид', undefined)

    // Assert
    expect(g.size).toBe(0)
  })
})

describe('translateName', () => {
  it('replaces multi-word card names case-insensitively', () => {
    // Arrange
    const name = 'Туго  моровая дева '

    // Act
    const result = translateName(name, glossary(), 'ru')

    // Assert
    expect(result).toEqual({ text: 'Tugo Plague Maiden', needsMt: false })
  })

  it('matches inflected plurals and pluralizes the English term', () => {
    // Arrange
    const name = 'Огроиды Реликты'

    // Act
    const result = translateName(name, glossary(), 'ru')

    // Assert
    expect(result.text).toBe('Ogroids Relicts')
  })

  it('does not match a term inside a longer word', () => {
    // Arrange
    const name = 'Тугодум'

    // Act
    const result = translateName(name, glossary(), 'ru')

    // Assert
    expect(result).toEqual({ text: 'Тугодум', needsMt: true })
  })

  it('flags leftover Cyrillic words and keeps Latin text', () => {
    // Arrange
    const name = 'Огроиды и 2x Dagon'

    // Act
    const result = translateName(name, glossary(), 'ru')

    // Assert
    expect(result).toEqual({ text: 'Ogroids и 2x Dagon', needsMt: true })
  })
})

describe('translateName in other languages', () => {
  it('returns English names unchanged without machine translation', () => {
    // Arrange
    const name = 'Shupe  Adda'

    // Act
    const result = translateName(name, new Map(), 'en')

    // Assert
    expect(result).toEqual({ text: 'Shupe Adda', needsMt: false })
  })

  it('matches Korean terms without word boundaries', () => {
    // Arrange
    const g: Glossary = new Map()
    addTerm(g, '갑각', 'Carapace')

    // Act
    const result = translateName('갑각덱', g, 'ko')

    // Assert
    expect(result).toEqual({ text: 'Carapace덱', needsMt: true })
  })

  it('returns needsMt false once CJK text is fully replaced', () => {
    // Arrange
    const g: Glossary = new Map()
    addTerm(g, '鉄壁', 'Carapace')

    // Act
    const result = translateName('鉄壁 2x', g, 'ja')

    // Assert
    expect(result).toEqual({ text: 'Carapace 2x', needsMt: false })
  })

  it('always asks for machine translation in Latin-script languages', () => {
    // Arrange
    const g: Glossary = new Map()
    addTerm(g, 'Skorupa', 'Carapace')

    // Act
    const result = translateName('Rycerze skorupa', g, 'pl')

    // Assert
    expect(result).toEqual({ text: 'Rycerze Carapace', needsMt: true })
  })

  it('respects word boundaries for accented Latin letters', () => {
    // Arrange
    const g: Glossary = new Map()
    addTerm(g, 'Elfy', 'Elves')

    // Act
    const result = translateName('Elfyś', g, 'pl')

    // Assert
    expect(result.text).toBe('Elfyś')
  })
})
