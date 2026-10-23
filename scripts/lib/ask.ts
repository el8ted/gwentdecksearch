import { consola } from 'consola'
import { type AnalysisData, cardLookup, cardName, describeCards } from './analysis.ts'
import { fixLine, parseChanges, type Unresolved } from './whatif.ts'

/** Whether there's someone to ask: a terminal on both ends, so prompts never land in a redirected report. */
export const canAsk = () => Boolean(process.stdin.isTTY && process.stdout.isTTY)

const TYPE = 'type'
const SKIP = 'skip'

// Ctrl+C at any prompt stops the run, file untouched.
const answer = (value: string | symbol): string => {
  if (typeof value === 'symbol') {
    consola.info('Stopped; nothing written.')
    process.exit(130)
  }
  return value
}

/**
 * Asks which card a ballot line means: one of the suggestions, a name or ID typed in (asked again until it's one card
 * the list can take), or none, to skip the line.
 *
 * @param u - The line, from {@link parseChanges}
 * @param raw - The line as written, to show
 * @param data - Catalog and names
 * @param lang - Language for card names
 * @returns The card, or undefined to skip the line
 */
async function askCard(
  u: Unresolved,
  raw: string,
  data: Pick<AnalysisData, 'catalog' | 'names'>,
  lang: string,
): Promise<number | undefined> {
  const lookup = cardLookup(data)
  // Power lists take units only, so offer only those.
  const fits = (id: number) => u.category.kind !== 'power' || data.catalog[id].type === 'unit'
  let matches = u.matches.filter(fits)
  const none = u.matches.length ? 'No unit matches: power lists take units only.' : 'No card found.'
  let message = `Line ${u.line + 1} (${u.category.name}): "${raw.trim()}"\n${matches.length ? 'Which card?' : none}`
  for (;;) {
    const picked = answer(
      await consola.prompt(message, {
        type: 'select',
        cancel: 'symbol',
        options: [
          ...matches.map((id) => ({ value: String(id), label: describeCards(data, [id], lang).trim() })),
          { value: TYPE, label: 'Type a name or ID…' },
          { value: SKIP, label: 'Skip this line (comment it out)' },
        ],
      }),
    )
    if (picked === SKIP) return undefined
    if (picked !== TYPE) return Number(picked)
    const typed = answer(await consola.prompt('Card name (any language) or ID:', { type: 'text', cancel: 'symbol' }))
    const found = lookup(typed)
    if (found.ok && fits(found.value)) return found.value
    if (found.ok) {
      matches = []
      message = `${cardName(data, found.value, lang)} is a ${data.catalog[found.value].type}: only units have power.`
    } else {
      matches = found.matches.filter(fits)
      message = `"${typed}": ${found.exact ? 'several cards have that name.' : matches.length ? 'did you mean?' : 'no card found.'}`
    }
  }
}

/**
 * Asks about every name in a ballot that isn't one card, and fixes those lines ({@link fixLine}). Other problems
 * (a line outside a list, a card twice) are left for {@link parseChanges} to report.
 *
 * @param text - The ballot
 * @param data - Catalog and names
 * @param lang - Language for card names
 * @returns The ballot with its names fixed, and whether anything changed
 */
export async function askNames(
  text: string,
  data: Pick<AnalysisData, 'catalog' | 'names'>,
  lang: string,
): Promise<{ text: string; changed: boolean }> {
  const parsed = parseChanges(text, data, lang)
  if (parsed.ok || !parsed.unresolved.length) return { text, changed: false }
  const lines = text.split('\n')
  const lookup = cardLookup(data)
  // The English name, unless another card shares it: then the ID, so the line reads as this card next time.
  const written = (id: number) => {
    const { name } = data.catalog[id]
    const found = lookup(name)
    return found.ok && found.value === id ? name : String(id)
  }
  consola.info(`${parsed.unresolved.length} name(s) to pick a card for (Ctrl+C stops, nothing written).`)
  for (const u of parsed.unresolved) {
    const id = await askCard(u, lines[u.line], data, lang)
    lines[u.line] = fixLine(lines[u.line], u.name, id === undefined ? undefined : written(id))
  }
  return { text: lines.join('\n'), changed: true }
}
