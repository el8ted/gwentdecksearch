import { describe, expect, it } from 'vitest'
import { fold } from '../autocomplete.ts'

describe('fold', () => {
  it('drops accents and case, so plain typing finds accented names', () => {
    // Act
    const folded = [
      'Coën',
      'Síle de Tansarville',
      'Éibhear Hattori',
      'Angoulême',
      'Ёж',
      'Łucja',
      'Søren',
      'Straße',
    ].map(fold)

    // Assert
    expect(folded).toEqual([
      'coen',
      'sile de tansarville',
      'eibhear hattori',
      'angouleme',
      'еж',
      'lucja',
      'soren',
      'strasse',
    ])
  })

  it('reads curly apostrophes as the straight one a keyboard types', () => {
    // Act
    const folded = fold('Raffard’s Vengeance')

    // Assert
    expect(folded).toBe("raffard's vengeance")
  })

  it('leaves Japanese and Korean as typed', () => {
    // Act
    const folded = ['ゲラルト', 'が', '게롤트'].map(fold)

    // Assert
    expect(folded).toEqual(['ゲラルト', 'が', '게롤트'])
  })
})
