import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config.ts'

describe('CONFIG', () => {
  // A self-builder's 0 or 1.5 would otherwise show an empty or broken list.
  it.each([
    'resultsPageSize',
    'frequencyBars',
    'maxSuggestions',
    'maxAuthorSuggestions',
    'similarMinShared',
    'craftNeutralSample',
  ] as const)('%s is a positive integer', (key) => {
    // Act
    const value = CONFIG[key]

    // Assert
    expect(Number.isInteger(value) && value > 0).toBe(true)
  })

  it('leaves author suggestions room among all suggestions', () => {
    // Assert
    expect(CONFIG.maxAuthorSuggestions).toBeLessThanOrEqual(CONFIG.maxSuggestions)
  })

  it('bounds the filter label column, smallest first', () => {
    // Act
    const { min, max } = CONFIG.filterLabelEm

    // Assert
    expect(min > 0 && min <= max).toBe(true)
  })

  it('takes a source loss as a share between none and all of its decks', () => {
    // Assert
    expect(CONFIG.maxSourceLoss > 0 && CONFIG.maxSourceLoss < 1).toBe(true)
  })

  it('gives the repository and site as https URLs, the site with its trailing slash', () => {
    // Assert
    expect(CONFIG.repoUrl).toMatch(/^https:\/\/[^/]+\/.+[^/]$/)
    expect(CONFIG.siteUrl).toMatch(/^https:\/\/.+\/$/)
  })

  // The page's links work before the script runs; the script then rewrites them from CONFIG, so the two must agree.
  it("gives each repository link in index.html CONFIG's address as its fallback", () => {
    // Arrange
    const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8')

    // Act
    const links = [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0]).filter((a) => a.includes('data-repo='))
    const wrong = links.filter((a) => {
      const href = /href="([^"]*)"/.exec(a)?.[1]
      const path = /data-repo="([^"]*)"/.exec(a)?.[1]
      return href !== `${CONFIG.repoUrl}${path}`
    })

    // Assert
    expect(links.length).toBeGreaterThan(4)
    expect(wrong).toEqual([])
  })
})
