import * as fs from 'node:fs/promises'
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readJson, writeJson } from '../store.ts'

vi.mock('node:fs/promises', async (original) => {
  const real = await original<typeof import('node:fs/promises')>()
  return { ...real, rename: vi.fn(real.rename) }
})

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'store-'))
})

describe('writeJson', () => {
  it('replaces the file and leaves no temporary file behind', async () => {
    // Arrange
    const path = join(dir, 'a.json')
    await writeJson(path, { v: 1 })

    // Act
    await writeJson(path, { v: 2 })

    // Assert
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ v: 2 })
    expect(await readdir(dir)).toEqual(['a.json'])
  })

  it('keeps the existing file when the write is interrupted before the rename', async () => {
    // Arrange
    const path = join(dir, 'a.json')
    await writeJson(path, { v: 1 })
    vi.mocked(fs.rename).mockRejectedValueOnce(new Error('interrupted'))

    // Act
    const attempt = writeJson(path, { v: 2 })

    // Assert
    await expect(attempt).rejects.toThrow('interrupted')
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ v: 1 })
  })

  it('sorts nested keys, keeps array order and ends with a newline', async () => {
    // Arrange
    const path = join(dir, 'sub', 'a.json')

    // Act
    await writeJson(path, { b: 1, a: { d: [3, 1, { z: 0, y: 0 }], c: null } })

    // Assert
    expect(await readFile(path, 'utf8')).toBe(
      `${JSON.stringify({ a: { c: null, d: [3, 1, { y: 0, z: 0 }] }, b: 1 }, null, 2)}\n`,
    )
  })

  it('keeps arrays of plain values and pairs on one line, and empty containers short', async () => {
    // Arrange
    const path = join(dir, 'a.json')

    // Act
    await writeJson(path, {
      cards: [
        [1, 1],
        [10, 2],
      ],
      tags: ['x', null],
      none: [],
      empty: {},
    })

    // Assert
    expect(await readFile(path, 'utf8')).toBe(
      '{\n  "cards": [[1,1],[10,2]],\n  "empty": {},\n  "none": [],\n  "tags": ["x",null]\n}\n',
    )
  })

  it('reports whether the file changed', async () => {
    // Arrange
    const path = join(dir, 'a.json')

    // Act
    const results = [await writeJson(path, { a: 1 }), await writeJson(path, { a: 1 }), await writeJson(path, { a: 2 })]

    // Assert
    expect(results).toEqual([true, false, true])
  })
})

describe('readJson', () => {
  it('returns the fallback for a missing file', async () => {
    // Act
    const result = await readJson(join(dir, 'none.json'), { empty: true })

    // Assert
    expect(result).toEqual({ empty: true })
  })

  it('throws on invalid JSON instead of reading it as empty', async () => {
    // Arrange
    const path = join(dir, 'bad.json')
    await writeFile(path, '{')

    // Act
    const act = readJson(path, {})

    // Assert
    await expect(act).rejects.toThrow()
  })
})
