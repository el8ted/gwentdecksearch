/**
 * Validates contributed phrase files (src/i18n/*.json) against the English master. A failure here
 * explains exactly which key is wrong, so translators can fix a PR without reading code.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUDGETS } from '../filter.ts'
import { LANGUAGES } from '../i18n.ts'
import { FACTIONS } from '../types.ts'

const DIR = join(import.meta.dirname, '..', 'i18n')
const PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other']
type Phrase = string | Record<string, string>
const load = (file: string): Record<string, Phrase | string[]> => JSON.parse(readFileSync(join(DIR, file), 'utf8'))
const en = load('en.json') as Record<string, Phrase>
const placeholders = (p: Phrase) =>
  [...new Set(Object.values(typeof p === 'string' ? { p } : p).flatMap((s) => s.match(/\{\w+\}/g) ?? []))].sort()
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'en.json')

describe('English phrases', () => {
  it('give every plural phrase an "other" form', () => {
    // Arrange
    const plurals = Object.entries(en).filter(([, p]) => typeof p !== 'string')

    // Act
    const missing = plurals.filter(([, p]) => !(p as Record<string, string>).other).map(([k]) => k)

    // Assert
    expect(missing).toEqual([])
  })
})

describe('index.html', () => {
  // A key that is not in en.json is printed as the key itself, so a typo in the markup shows up on the page.
  it('uses only keys that exist in en.json', () => {
    // Arrange
    const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8')

    // Act
    const keys = [...html.matchAll(/data-i18n(?:-(?:title|label|placeholder))?="([^"]+)"/g)].map((m) => m[1])
    const missing = keys.filter((k) => !(k in en))

    // Assert
    expect(missing).toEqual([])
  })
})

describe('code', () => {
  // A key missing from en.json prints as the key itself, so a typo in t('...') shows up on the page.
  it('uses only keys that exist in en.json', () => {
    // Arrange
    const src = join(import.meta.dirname, '..')
    const sources = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.ts') && !f.includes('__tests__'))
      .map((f) => readFileSync(join(src, f), 'utf8'))

    // Act
    // Every plain quoted string in t()'s first argument, so t(open ? 'a' : 'b') counts both.
    const keys = sources.flatMap((text) =>
      [...text.matchAll(/\bt\(([^,)]*)/g)].flatMap((m) => [...m[1].matchAll(/['`]([^'`$]+)['`]/g)].map((k) => k[1])),
    )
    const missing = keys.filter((k) => !(k in en))

    // Assert
    expect(keys.length).toBeGreaterThan(0)
    expect(missing).toEqual([])
  })

  // Built from templates (t(`faction.${f}`), t(`budget.${b}`)), so the scan above can't see them.
  it('has a phrase for every faction and budget', () => {
    // Act
    const keys = [...[...FACTIONS, 'NE'].map((f) => `faction.${f}`), ...BUDGETS.map((b) => `budget.${b}`)]
    const missing = keys.filter((k) => !(k in en))

    // Assert
    expect(missing).toEqual([])
  })
})

describe.each(files)('%s', (file) => {
  const lang = file.replace('.json', '')
  const phrases = load(file)
  const entries = Object.entries(phrases).filter(([k]) => k !== '_needsReview') as [string, Phrase][]
  // Informational, not a test: untranslated phrases fall back to English. stderr, because vitest hides the console
  // output of passing tests, and CONTRIBUTING promises translators this list.
  const have = new Set(entries.map(([k]) => k))
  const untranslated = Object.keys(en).filter((k) => !have.has(k))
  if (untranslated.length)
    process.stderr.write(`${file}: ${untranslated.length} phrases still in English: ${untranslated.join(', ')}\n`)

  it('is named after a supported language', () => {
    // Arrange
    const supported: readonly string[] = LANGUAGES

    // Act
    const ok = supported.includes(lang)

    // Assert
    expect(ok, `${file}: use one of ${LANGUAGES.join(', ')}`).toBe(true)
  })

  it('only uses keys that exist in en.json', () => {
    // Arrange
    const known = new Set(Object.keys(en))

    // Act
    const unknown = entries.map(([k]) => k).filter((k) => !known.has(k))

    // Assert
    expect(unknown, `${file}: remove or rename these keys`).toEqual([])
  })

  it('keeps the same {placeholders} as English', () => {
    // Arrange
    const withEnglish = entries.filter(([k]) => k in en)

    // Act
    const wrong = withEnglish
      .filter(([k, p]) => placeholders(p).join() !== placeholders(en[k]).join())
      .map(
        ([k, p]) =>
          `${k}: has ${placeholders(p).join(' ') || 'none'}, needs ${placeholders(en[k]).join(' ') || 'none'}`,
      )

    // Assert
    expect(wrong).toEqual([])
  })

  it('uses only valid plural forms, always including "other"', () => {
    // Arrange
    const plurals = entries.filter(([, p]) => typeof p !== 'string') as [string, Record<string, string>][]

    // Act
    const wrong = plurals
      .filter(([, p]) => !p.other || Object.keys(p).some((f) => !PLURAL_FORMS.includes(f)))
      .map(([k]) => k)

    // Assert
    expect(wrong).toEqual([])
  })

  it('lists only existing keys under _needsReview', () => {
    // Arrange
    const review = (phrases._needsReview ?? []) as string[]

    // Act
    const stale = review.filter((k) => !(k in phrases))

    // Assert
    expect(stale).toEqual([])
  })
})
