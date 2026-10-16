import { describe, expect, it } from 'vitest'
import { createTranslator, matchLanguage, pickLanguage, playgwentUrl } from '../i18n.ts'

describe('matchLanguage', () => {
  it('matches exact tags case-insensitively and falls back to the base language', () => {
    // Arrange
    const tags = ['ru', 'ZH-CN', 'ru-RU', 'zh-TW', 'pt-PT', 'es-MX', 'nl-NL']

    // Act
    const langs = tags.map(matchLanguage)

    // Assert
    expect(langs).toEqual(['ru', 'zh-cn', 'ru', 'zh-cn', 'pt-BR', 'es', undefined])
  })
})

describe('pickLanguage', () => {
  it('prefers the URL parameter, then the saved choice, then the browser, then English', () => {
    // Arrange
    const browser = ['nl-NL', 'ru-RU']

    // Act
    const results = [
      pickLanguage('zh-cn', 'de', browser),
      pickLanguage(null, 'de', browser),
      pickLanguage('xx', null, browser),
      pickLanguage(null, null, ['nl']),
    ]

    // Assert
    expect(results).toEqual(['zh-cn', 'de', 'ru', 'en'])
  })
})

describe('createTranslator', () => {
  const phrases = {
    en: { hello: 'Hello {name}', decks: { one: '{n} deck', other: '{n} decks' }, only: 'English only' },
    ru: {
      hello: 'Привет, {name}',
      decks: { one: '{n} колода', few: '{n} колоды', many: '{n} колод', other: '{n} колоды' },
    },
  }

  it('fills placeholders and picks plural forms with the language rules', () => {
    // Arrange
    const t = createTranslator('ru', phrases)

    // Act
    const results = [t('hello', { name: 'Геральт' }), t('decks', { n: 1 }), t('decks', { n: 3 }), t('decks', { n: 5 })]

    // Assert
    expect(results).toEqual(['Привет, Геральт', '1 колода', '3 колоды', '5 колод'])
  })

  it('falls back to English, then the key, and lets official terms win', () => {
    // Arrange
    const t = createTranslator('ru', phrases, { hello: 'Official' })

    // Act
    const results = [t('only'), t('missing.key'), t('hello')]

    // Assert
    expect(results).toEqual(['English only', 'missing.key', 'Official'])
  })

  it('leaves unknown placeholders in place', () => {
    // Arrange
    const t = createTranslator('en', phrases)

    // Act
    const result = t('hello')

    // Assert
    expect(result).toBe('Hello {name}')
  })
})

describe('playgwentUrl', () => {
  it('inserts the language after the host and leaves other URLs alone', () => {
    // Arrange
    const urls = ['https://www.playgwent.com/decks/guides/1', 'https://www.youtube.com/@x']

    // Act
    const result = urls.map((u) => playgwentUrl(u, 'zh-cn'))

    // Assert
    expect(result).toEqual(['https://www.playgwent.com/zh-cn/decks/guides/1', 'https://www.youtube.com/@x'])
  })
})
