import { afterEach, describe, expect, it, vi } from 'vitest'
import { byId, esc, newTabLink, readStorage, writeStorage } from '../dom.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('esc', () => {
  it('escapes every HTML-significant character', () => {
    // Act
    const out = esc(`&<>"'`)

    // Assert
    expect(out).toBe('&#38;&#60;&#62;&#34;&#39;')
  })

  it('leaves plain text and numbers unchanged', () => {
    // Act + Assert
    expect(esc('Geralt of Rivia')).toBe('Geralt of Rivia')
    expect(esc(42)).toBe('42')
  })

  it('makes injected markup inert', () => {
    // Act
    const out = esc('<img src=x onerror="alert(1)">')

    // Assert
    expect(out).not.toMatch(/[<>"]/)
  })
})

describe('newTabLink', () => {
  it('escapes the href and text and opens a new tab', () => {
    // Act
    const html = newTabLink('https://x.test/?a=1&b="2"', '<b>Name</b>')

    // Assert
    expect(html).toBe(
      '<a href="https://x.test/?a=1&#38;b=&#34;2&#34;" target="_blank" rel="noopener">&#60;b&#62;Name&#60;/b&#62;</a>',
    )
  })
})

describe('byId', () => {
  it('returns the element', () => {
    // Arrange
    const el = { id: 'meta' }
    vi.stubGlobal('document', { getElementById: (id: string) => (id === 'meta' ? el : null) })

    // Act + Assert
    expect(byId('meta')).toBe(el)
  })

  it('throws when index.html lacks the element', () => {
    // Arrange
    vi.stubGlobal('document', { getElementById: () => null })

    // Act + Assert
    expect(() => byId('nope')).toThrow('#nope missing from index.html')
  })
})

describe('readStorage / writeStorage', () => {
  it('read and write through to localStorage', () => {
    // Arrange
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    })

    // Act
    writeStorage('k', 'v')

    // Assert
    expect(readStorage('k')).toBe('v')
    expect(readStorage('missing')).toBeNull()
  })

  it('swallow errors when storage is blocked', () => {
    // Arrange
    const blocked = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })

    // Act + Assert
    expect(readStorage('k')).toBeNull()
    expect(() => writeStorage('k', 'v')).not.toThrow()
  })
})
