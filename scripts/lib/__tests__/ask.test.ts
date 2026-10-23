import { consola } from 'consola'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { askNames } from '../ask.ts'
import { DATA } from './analysis-data.ts'

// Each prompt takes the next scripted answer; the calls are kept to check what was offered.
const answering = (...answers: (string | symbol)[]) =>
  vi.spyOn(consola, 'prompt').mockImplementation(async () => answers.shift() as never)
const offered = (prompt: ReturnType<typeof answering>, call: number) =>
  (prompt.mock.calls[call][1] as { options: { value: string }[] }).options.map((o) => o.value)

beforeEach(() => {
  vi.spyOn(consola, 'info').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('askNames', () => {
  it('puts the picked suggestion in place of the name', async () => {
    // Arrange
    const prompt = answering('100')

    // Act
    const asked = await askNames('Provision increase\n3. Caranthir', DATA, 'en')

    // Assert
    expect(offered(prompt, 0)).toEqual(['100', 'type', 'skip'])
    expect(asked).toEqual({ text: 'Provision increase\n3. Caranthir Ar-Feiniel   # was: Caranthir', changed: true })
  })

  it('offers only units on a power list, refuses a typed non-unit, and asks again after a typo', async () => {
    // Arrange: Royal Decree is a special; "Kolgirm" is a typo for Kolgrim (104)
    const prompt = answering('type', 'Royal Decree', 'type', 'Kolgirm', '104')

    // Act
    const asked = await askNames('Power increase\n- Royal Decre', DATA, 'en')

    // Assert
    expect(offered(prompt, 0)).toEqual(['type', 'skip'])
    expect(prompt.mock.calls[2][0]).toMatch(/only units have power/)
    expect(offered(prompt, 4)).toEqual(['104', 'type', 'skip'])
    expect(asked.text).toBe('Power increase\n- Kolgrim   # was: Royal Decre')
  })

  it('comments out a skipped line', async () => {
    // Arrange
    answering('skip')

    // Act
    const asked = await askNames('Provision decrease\n- Zzz', DATA, 'en')

    // Assert
    expect(asked.text).toBe('Provision decrease\n# skipped: - Zzz')
  })

  it('writes the ID when another card shares the English name', async () => {
    // Arrange: a second Kolgrim
    const data = {
      catalog: { ...DATA.catalog, 107: { ...DATA.catalog[104] } },
      names: { ...DATA.names, en: { ...DATA.names.en, 107: 'Kolgrim' } },
    }
    answering('107')

    // Act
    const asked = await askNames('Provision increase\n- Kolgr', data, 'en')

    // Assert
    expect(asked.text).toBe('Provision increase\n- 107   # was: Kolgr')
  })

  it('stops the run on Ctrl+C', async () => {
    // Arrange
    answering(Symbol.for('cancel'))
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })

    // Act / Assert
    await expect(askNames('Provision increase\n- Zzz', DATA, 'en')).rejects.toThrow('exit')
    expect(exit).toHaveBeenCalledWith(130)
  })

  it('asks nothing when every name is one card', async () => {
    // Arrange
    const prompt = answering()

    // Act
    const asked = await askNames('Provision increase\n- Kolgrim', DATA, 'en')

    // Assert
    expect(asked).toEqual({ text: 'Provision increase\n- Kolgrim', changed: false })
    expect(prompt).not.toHaveBeenCalled()
  })
})
