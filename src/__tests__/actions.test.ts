/**
 * Page buttons are dispatched by their `data-*` attribute through ui/actions.ts's ACTIONS table. A button whose attribute
 * has no entry does nothing when clicked, so this checks every one the markup and renderers emit has an action.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')
const read = (file: string) => readFileSync(join(SRC, file), 'utf8')
const camel = (attr: string) => attr.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
// Handled elsewhere: the Display menu's buttons (ui/display-menu.ts), Craft's Have it checkboxes (a change listener in
// ui/actions.ts), and links the page rewrites (data-pg, data-repo).
const ELSEWHERE = new Set(['pref', 'value', 'have', 'pg', 'repo'])

describe('ACTIONS', () => {
  it('has an action for every button attribute', () => {
    // Arrange
    const source = read('ui/actions.ts')
    const table = source.slice(
      source.indexOf('const ACTIONS'),
      source.indexOf('\n}\n', source.indexOf('const ACTIONS')),
    )
    const actions = new Set([...table.matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]))
    const html = [...read('index.html').matchAll(/<button[^>]*>/g)].map((m) => m[0]).join('\n')
    // Renderers build buttons in template strings; `data-${attr}` (leader and stratagem pills) is listed by hand.
    const markup = [html, ...['page', 'results', 'filters', 'panel', 'craft'].map((f) => read(`ui/${f}.ts`))].join('\n')

    // Act
    const attrs = new Set([...markup.matchAll(/\bdata-([a-z][a-z-]*)="/g)].map((m) => camel(m[1])))
    for (const a of ['leader', 'stratagem']) attrs.add(a)
    const missing = [...attrs].filter((a) => !actions.has(a) && !ELSEWHERE.has(a))

    // Assert
    expect(actions.size).toBeGreaterThan(20)
    expect(missing).toEqual([])
  })
})
