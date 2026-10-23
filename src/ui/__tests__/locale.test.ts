import { describe, expect, it } from 'vitest'
import { makeLocale } from '../locale.ts'

describe('makeLocale', () => {
  it('names a language in the page language, or keeps a code the browser does not know', () => {
    // Arrange
    const de = makeLocale('de')

    // Act / Assert
    expect(de.langName('ru')).toBe('Russisch')
    expect(makeLocale('en').langName('pt-BR')).toBe('Brazilian Portuguese')
    expect(de.langName('not a code')).toBe('not a code')
  })
})
