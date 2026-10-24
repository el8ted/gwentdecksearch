import { describe, expect, it } from 'vitest'
import { GLYPHS, icon } from '../icons.ts'

describe('icon', () => {
  it('is decoration: hidden from screen readers, never a tab stop, in the text colour', () => {
    // Act
    const svg = icon('x')

    // Assert
    expect(svg).toMatch(/^<svg class="icon" [^>]*aria-hidden="true" focusable="false">/)
    expect(svg).toContain('stroke="currentColor"')
  })

  it('draws every symbol Help text uses', () => {
    // Act / Assert
    for (const name of Object.values(GLYPHS)) expect(icon(name)).toMatch(/<(path|circle) /)
  })
})
