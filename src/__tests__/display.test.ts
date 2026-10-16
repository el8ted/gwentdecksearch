import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, PREFS_KEY, parsePrefs, prefsToAttrs, TEXT_SIZES } from '../display.ts'

describe('parsePrefs', () => {
  it('returns defaults for missing or malformed storage', () => {
    // Arrange
    const inputs = [null, '', 'not json', 'null']

    // Act
    const results = inputs.map(parsePrefs)

    // Assert
    for (const r of results) expect(r).toEqual(DEFAULT_PREFS)
  })

  it('keeps valid values and replaces invalid ones', () => {
    // Arrange
    const raw = JSON.stringify({ text: 9, theme: 'light', contrast: 'loud', cvd: true })

    // Act
    const prefs = parsePrefs(raw)

    // Assert
    expect(prefs).toEqual({ text: 1, theme: 'light', contrast: 'standard', cvd: true })
  })
})

describe('prefsToAttrs', () => {
  it('resolves the system theme from the OS preference', () => {
    // Arrange
    const prefs = DEFAULT_PREFS

    // Act
    const [dark, light] = [prefsToAttrs(prefs, true), prefsToAttrs(prefs, false)]

    // Assert
    expect(dark['data-theme']).toBe('dark')
    expect(light['data-theme']).toBe('light')
  })

  it('maps an explicit theme, contrast, palette and text size', () => {
    // Arrange
    const prefs = { text: 4, theme: 'dark' as const, contrast: 'high' as const, cvd: true }

    // Act
    const attrs = prefsToAttrs(prefs, false)

    // Assert
    expect(attrs).toEqual({
      'data-theme': 'dark',
      'data-contrast': 'high',
      'data-cvd': 'true',
      style: 'font-size:150%',
    })
  })
})

describe('index.html head script', () => {
  // It repeats parsePrefs to avoid a flash before first paint; the two copies must agree.
  const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8')

  it('uses the same storage key', () => {
    // Act
    const key = html.match(/localStorage\.getItem\('([^']+)'\)/)?.[1]

    // Assert
    expect(key).toBe(PREFS_KEY)
  })

  it('uses the same text sizes and default size', () => {
    // Act
    const sizes = JSON.parse(html.match(/const sizes = (\[[^\]]*\])/)?.[1] ?? 'null')
    const fallback = Number(html.match(/sizes\[p\.text\] \?\? ([\d.]+)/)?.[1])

    // Assert
    expect(sizes).toEqual([...TEXT_SIZES])
    expect(fallback).toBe(TEXT_SIZES[DEFAULT_PREFS.text])
  })
})
