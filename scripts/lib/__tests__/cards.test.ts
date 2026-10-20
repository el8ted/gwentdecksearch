import { describe, expect, it } from 'vitest'
import { abilityNamesFromText, parseCardSearch, parseLocalizedNames, rarityOf, type SearchHit } from '../cards.ts'

const hit = (over: Partial<SearchHit['_source']>): SearchHit => ({
  _source: {
    id: 1,
    type: 4,
    faction: 6,
    secondary_factions: [],
    provisions_cost: 9,
    crafting_cost: 30,
    rarity: 1,
    power: 0,
    category_names: [],
    keywords: [],
    translations: { en: { name: 'Card' } },
    ...over,
  },
})

describe('parseCardSearch', () => {
  it('maps codes to types and factions and keeps the English display name', () => {
    // Arrange
    const hits = [
      hit({ id: 202186, type: 1, faction: 2, provisions_cost: 17, translations: { en: { name: 'Double Cross' } } }),
      hit({ id: 202497, type: 16, faction: 0, provisions_cost: 0 }),
    ]

    // Act
    const cards = parseCardSearch(hits)

    // Assert
    expect(cards.get(202186)).toEqual({
      name: 'Double Cross',
      type: 'leader',
      faction: 'NG',
      provisions: 17,
      craftingCost: 30,
      rarity: 1,
    })
    expect(cards.get(202497)).toMatchObject({ type: 'stratagem', faction: 'NE', provisions: 0 })
  })

  it('keeps power for units only', () => {
    // Arrange
    const hits = [hit({ id: 1, type: 4, power: 6 }), hit({ id: 2, type: 2, power: 0 })]

    // Act
    const cards = parseCardSearch(hits)

    // Assert
    expect(cards.get(1)?.power).toBe(6)
    expect(cards.get(2)).not.toHaveProperty('power')
  })

  it('records a secondary faction for dual-faction cards', () => {
    // Arrange
    const hits = [hit({ id: 202327, secondary_factions: [1] })]

    // Act
    const cards = parseCardSearch(hits)

    // Assert
    expect(cards.get(202327)?.secondaryFaction).toBe('MO')
  })

  it('throws on an unknown type or faction code', () => {
    // Arrange
    const badType = [hit({ type: 32 })]
    const badFaction = [hit({ faction: 9 })]

    // Act
    const acts = [() => parseCardSearch(badType), () => parseCardSearch(badFaction)]

    // Assert
    expect(acts[0]).toThrow('Unknown card type code 32')
    expect(acts[1]).toThrow('Unknown faction code 9')
  })

  it('tags a card with its categories, then the abilities its text names, once each', () => {
    // Arrange
    const hits = [hit({ category_names: [12, 25], keywords: ['order', 'zeal', 'order'] }), hit({ id: 2 })]

    // Act
    const cards = parseCardSearch(hits)

    // Assert
    expect(cards.get(1)?.tags).toEqual(['c12', 'c25', 'order', 'zeal'])
    expect(cards.get(2)).not.toHaveProperty('tags')
  })

  it('throws when a card has no English name', () => {
    // Arrange
    const hits = [hit({ translations: {} })]

    // Act
    const act = () => parseCardSearch(hits)

    // Assert
    expect(act).toThrow('no English name')
  })
})

describe('parseLocalizedNames', () => {
  it('reads the localized name per card and skips cards without one', () => {
    // Arrange
    const hits = [hit({ id: 202186, translations: { ru: { name: 'Двойная игра' } } }), hit({ id: 2, translations: {} })]

    // Act
    const names = parseLocalizedNames(hits, 'ru')

    // Assert
    expect([...names]).toEqual([[202186, 'Двойная игра']])
  })

  it('picks the requested language when several are present', () => {
    // Arrange
    const hits = [hit({ id: 3, translations: { en: { name: 'Double Cross' }, 'pt-BR': { name: 'Traição' } } })]

    // Act
    const names = parseLocalizedNames(hits, 'pt-BR')

    // Assert
    expect(names.get(3)).toBe('Traição')
  })
})

describe('abilityNamesFromText', () => {
  it("names each ability by its card text's most common wording, end punctuation trimmed", () => {
    // Arrange
    const text = (tooltip: string) => hit({ translations: { 'zh-cn': { name: 'x', tooltip } } })
    const hits = [
      text('<keyword=deploy>部署：</keyword>…<keyword=order>指令</keyword>'),
      text('<keyword=deploy>部署</keyword>'),
      text('<keyword=deploy>部署中</keyword><keyword=lock> </keyword>'),
    ]

    // Act
    const names = abilityNamesFromText(hits, 'zh-cn')

    // Assert
    expect(names).toEqual({ deploy: '部署', order: '指令' })
  })
})

describe('rarityOf', () => {
  it('names each rarity playgwent codes', () => {
    // Act
    const rarities = [5, 15, 20, 25].map((code) => rarityOf(code, 1))

    // Assert
    expect(rarities).toEqual(['common', 'rare', 'epic', 'legendary'])
  })

  it('throws on an unknown code, naming the card', () => {
    // Act
    const act = () => rarityOf(30, 123)

    // Assert
    expect(act).toThrow('Unknown rarity code 30 (card 123)')
  })
})
