import { budgetSide, craftList, type IndexedDeck } from '../../src/filter.ts'
import {
  type AnalysisData,
  cardLookup,
  cardName,
  caveat,
  explainLookup,
  factionScope,
  nameLookup,
  profile,
} from './analysis.ts'

/**
 * Cards that play a tag's role without carrying the tag, which deck lists can't show otherwise.
 *
 * shortcut: kept by hand and tiny; extend when someone points out another one.
 */
export const ROLE_EXTRAS: Record<string, number[]> = {
  // Azar Javed spawns scarabs that are defenders; the card itself isn't tagged.
  defender: [202425],
}

/** What a package report starts from: decks with any card carrying a tag, or with at least `min` of some cards. */
export type Seed = { tag: string } | { cards: number[]; min: number }

/** Smallest share of the package's decks a card must be in to be listed as going with it. */
const MIN_SHARE = 0.3
const MAX_ROWS = 20

/**
 * Reads seeds from the command line: card names or IDs in any language, or `tag:<name>` (a deck-builder tag such as
 * `tag:defender` or `tag:dragon`, by key or by name in any language).
 *
 * @param args - The seed arguments
 * @param min - How many of the cards a deck needs (default: all)
 * @param data - Catalog, names and tags
 * @param lang - Language for names in error messages
 * @returns The seed, or every argument that's unknown or ambiguous, explained
 */
export function parseSeed(
  args: string[],
  min: number | undefined,
  data: Pick<AnalysisData, 'catalog' | 'names' | 'tags'>,
  lang = 'en',
): { ok: true; seed: Seed } | { ok: false; errors: string[] } {
  const tags = args.filter((a) => a.startsWith('tag:'))
  if (tags.length) {
    if (args.length > 1) return { ok: false, errors: ['give either one tag:… or cards, not both'] }
    const keys = Object.keys(data.tags.en ?? {})
    const q = tags[0].slice(4)
    const found = keys.includes(q) ? { ok: true as const, value: q } : nameLookup(data.tags)(q)
    if (found.ok) return { ok: true, seed: { tag: found.value } }
    const names = found.matches.map((k) => `  ${k}  ${data.tags.en?.[k] ?? k}`).join('\n')
    return { ok: false, errors: [`no single tag is called "${q}"${names ? `; it could be:\n${names}` : ''}`] }
  }
  const lookup = cardLookup(data)
  const cards: number[] = []
  const errors: string[] = []
  for (const a of args) {
    const found = lookup(a)
    if (found.ok) cards.push(found.value)
    else errors.push(explainLookup(found, a, data, lang))
  }
  const need = min ?? cards.length
  if (!errors.length && !cards.length) errors.push('name a card, or a tag as tag:<name>')
  else if (!errors.length && (need < 1 || need > cards.length))
    errors.push(`--min must be between 1 and ${cards.length}`)
  return errors.length ? { ok: false, errors } : { ok: true, seed: { cards, min: need } }
}

/**
 * The decks a seed picks: those with a card carrying the tag (or a {@link ROLE_EXTRAS} card), or with at least `min`
 * of the cards.
 *
 * @param data - Decks and catalog
 * @param seed - The seed
 * @returns The decks, and the cards that define the package (left out of its companions)
 */
export function packageDecks(
  data: Pick<AnalysisData, 'decks' | 'catalog'>,
  seed: Seed,
): { decks: IndexedDeck[]; core: Set<number> } {
  const core =
    'tag' in seed
      ? new Set([
          ...Object.entries(data.catalog)
            .filter(([, c]) => c.tags?.includes(seed.tag as never))
            .map(([id]) => Number(id)),
          ...(ROLE_EXTRAS[seed.tag] ?? []),
        ])
      : new Set(seed.cards)
  const min = 'tag' in seed ? 1 : seed.min
  const decks = data.decks.filter((d) => [...core].filter((id) => d.ids.has(id)).length >= min)
  return { decks, core }
}

/**
 * The cards that go with a package (leaders and stratagems aside): in at least 30% of its decks, ranked by lift, how much more often they're in
 * these decks than in all decks that could run them (the faction's for a faction card, every deck for a neutral).
 *
 * @param data - Decks and catalog
 * @param decks - The package's decks
 * @param core - Cards that define it, left out
 * @returns `[card, share of the package's decks, lift]`, highest lift first
 */
export function companions(
  data: Pick<AnalysisData, 'decks' | 'catalog' | 'dataset'>,
  decks: IndexedDeck[],
  core: Set<number>,
): [number, number, number][] {
  // Counted as the Craft list counts them: leaders and stratagems aside.
  const count = (set: IndexedDeck[]) =>
    new Map(craftList(set, [...core], data.dataset.cards).map((r): [number, number] => [r.id, r.decks]))
  const inPackage = count(decks)
  const everywhere = count(data.decks)
  const { decksThatCould } = factionScope(data)
  return [...inPackage]
    .filter(([id, n]) => data.catalog[id] && n >= MIN_SHARE * decks.length)
    .map(([id, n]): [number, number, number] => {
      const share = n / decks.length
      return [id, share, share / ((everywhere.get(id) ?? 1) / Math.max(decksThatCould(id), 1))]
    })
    .sort((a, b) => b[2] - a[2] || b[1] - a[1])
    .slice(0, MAX_ROWS)
}

/**
 * The package report: who plays it, when, and what goes with it.
 *
 * @param data - Decks, catalog and names
 * @param seed - From {@link parseSeed}
 * @param lang - Language for card names
 * @returns Markdown
 */
export function packageReport(data: AnalysisData, seed: Seed, lang = 'en'): string {
  const { decks, core } = packageDecks(data, seed)
  const title =
    'tag' in seed
      ? `tag ${data.tags[lang]?.[seed.tag] ?? data.tags.en?.[seed.tag] ?? seed.tag} (${[...core].map((id) => cardName(data, id, lang)).join(', ')})`
      : `${seed.min < seed.cards.length ? `at least ${seed.min} of ` : ''}${seed.cards.map((id) => cardName(data, id, lang)).join(', ')}`
  const out = [`# Package: ${title}`, '', caveat(data), '']
  if (!decks.length) return [...out, 'No deck runs it.', ''].join('\n')
  const within = decks.filter((d) => budgetSide(d.budget) !== 'over').length
  const video = decks.filter((d) => d.deck.video).length
  out.push(`${decks.length} decks: ${within} within today's limit, ${video} with a video.`, '')
  out.push(profile(data, decks, lang), '', '## Cards that go with it', '')
  const rows = companions(data, decks, core)
  if (!rows.length) {
    out.push('No card is in 30% of these decks: they share no core. Add a card to narrow it (e.g. to one faction).', '')
    return out.join('\n')
  }
  out.push('| Card | Faction | Provisions | In these decks | Lift |', '|---|---|---:|---:|---:|')
  for (const [id, share, lift] of rows) {
    const c = data.catalog[id]
    out.push(
      `| ${cardName(data, id, lang)} | ${c.faction} | ${c.provisions} | ${Math.round(share * 100)}% | ×${lift.toFixed(1)} |`,
    )
  }
  out.push('', '_Lift: how much more often a card is in these decks than in all decks that could run it._', '')
  return out.join('\n')
}
