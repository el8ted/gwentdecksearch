import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DIR = join(import.meta.dirname, '..', '..', '..', '.github', 'ISSUE_TEMPLATE')

describe('issue forms', () => {
  // GitHub's form parser rejects YAML dates ("Tried to load unspecified class: Date") and then won't show the form, so a
  // value like 2026-10-16 must be quoted.
  it('quote every date-like value', () => {
    // Arrange
    const files = readdirSync(DIR).filter((f) => f.endsWith('.yml'))

    // Act
    const unquoted = files.flatMap((f) =>
      readFileSync(join(DIR, f), 'utf8')
        .split('\n')
        .flatMap((line, i) => (/^\s*-?\s*[\w-]+:\s+\d{4}-\d{2}-\d{2}/.test(line) ? [`${f}:${i + 1}`] : [])),
    )

    // Assert
    expect(files.length).toBeGreaterThan(0)
    expect(unquoted).toEqual([])
  })
})
