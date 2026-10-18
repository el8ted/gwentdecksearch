import { describe, expect, it } from 'vitest'
import { extractTagNames, extractTerms } from '../terms.ts'

const page = (dict: Record<string, string>) =>
  `<div data-translations='${JSON.stringify(dict).replaceAll('"', '&quot;').replaceAll("'", '&#039;')}'></div>`
const FULL = {
  faction_name_0: 'Нейтральные',
  faction_name_1: 'Чудовища',
  faction_name_2: 'Нильфгаард',
  faction_name_3: 'Королевства Севера',
  faction_name_4: "Скоя'таэли",
  faction_name_5: 'Скеллиге',
  faction_name_6: 'Синдикат',
  filter_faction: 'Фракция',
  filter_type_25: 'Стратегический прием',
  filters_tags: 'Ключевые слова',
  tooltip_title_provision: 'Стоимость найма',
  tooltip_title_scraps: 'Обрывки ',
  tooltip_title_cards: 'Карты',
  tooltip_title_units: 'Отряды',
  unrelated: 'ignored',
}

describe('extractTerms', () => {
  it('maps playgwent keys to phrase keys and trims values', () => {
    // Arrange
    const html = page(FULL)

    // Act
    const terms = extractTerms(html)

    // Assert
    expect(terms['faction.ST']).toBe("Скоя'таэли")
    expect(terms['stat.scraps']).toBe('Обрывки')
    expect(terms['filter.stratagem']).toBe('Стратегический прием')
    expect(Object.keys(terms)).toHaveLength(14)
  })

  it('throws when a term is missing or the attribute is absent', () => {
    // Arrange
    const { filter_faction: _, ...partial } = FULL

    // Act
    const acts = [() => extractTerms(page(partial)), () => extractTerms('<div></div>')]

    // Assert
    expect(acts[0]).toThrow('"filter_faction" missing')
    expect(acts[1]).toThrow('No data-translations')
  })
})

describe('extractTagNames', () => {
  const state = (s: unknown) => `<div data-state='${JSON.stringify(s).replaceAll('"', '&quot;')}'></div>`

  it('keys categories as c{id} and abilities by slug, skipping blank names', () => {
    // Arrange
    const html = state({ keywords: { 6: 'Огроид', 12: ' Зверь ' }, categories: { devotion: 'Верность', order: '' } })

    // Act
    const names = extractTagNames(html)

    // Assert
    expect(names).toEqual({ c6: 'Огроид', c12: 'Зверь', devotion: 'Верность' })
  })

  it('throws when the state or its tag lists are missing', () => {
    // Act
    const acts = [() => extractTagNames('<div></div>'), () => extractTagNames(state({ keywords: {} }))]

    // Assert
    expect(acts[0]).toThrow('No data-state')
    expect(acts[1]).toThrow('lists no tags')
  })
})
