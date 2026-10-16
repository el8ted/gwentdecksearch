import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config.ts'

describe('CONFIG', () => {
  // A self-builder's 0 or 1.5 would otherwise show an empty or broken list.
  it.each(Object.entries(CONFIG))('%s is a positive integer', (_, value) => {
    // Assert
    expect(Number.isInteger(value) && value > 0).toBe(true)
  })
})
