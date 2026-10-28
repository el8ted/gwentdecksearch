import { listKey } from '../../src/filter.ts'
import { LANGUAGES } from '../../src/i18n.ts'
import { type Card, type Dataset, type Deck, SOURCE_NAMES, SOURCES, type Source, type Video } from '../../src/types.ts'
import { rarityOf } from './cards.ts'
import { type Creator, creatorAliases, creatorName } from './creators.ts'
import type { GuideInfo } from './guide.ts'
import type { DeckEntry } from './sources.ts'
import type { CatalogCard, StoredDeck } from './store.ts'
import { TERM_KEYS } from './terms.ts'
import { addTerm, type Glossary, translateName } from './translate.ts'
import { readChannels, type StoredVideo } from './youtube.ts'

/** Tactical Advantage: playgwent leaves the default stratagem out of a deck's card list. */
export const DEFAULT_STRATAGEM = 202140

/** Everything the build reads; all of it committed, so the build needs no network. */
export interface BuildInput {
  /** Deck links from every source, in name-priority order (the first entry for a deck names it). */
  entries: DeckEntry[]
  store: Record<string, StoredDeck>
  cards: Record<number, CatalogCard>
  /** Per language: card ID → localized name. */
  cardNames: Record<string, Record<number, string>>
  /** Per language: phrase key → official term. */
  terms: Record<string, Record<string, string>>
  /** Per language (English included): tag key → name. */
  tags: Record<string, Record<string, string>>
  /** Per language: localized category (list) → English. */
  categories: Record<string, Record<string, string>>
  /** YouTube uploads that link a deck, by channel ID, then video ID. */
  videos: Record<string, Record<string, StoredVideo>>
  /** The creator registry: whose channels those are. */
  creators: Creator[]
  /** Per language: original deck name → English (hand-edited or machine-translated). */
  translations: Record<string, Record<string, string>>
  scrapedAt: string
}

/** What the build writes, plus what it found. */
export interface BuildOutput {
  dataset: Dataset
  /** `data/decklist.md` */
  decklist: string
  /** `data/creators.md` */
  creators: string
  /** `data/i18n/{lang}.js` by language */
  packs: Record<string, string>
  /** Reported but harmless: the deck is left out (or a name falls back). */
  warnings: string[]
  /** The data is wrong; nothing should be written. */
  errors: string[]
}

/**
 * A language's glossary (localized term → English) from its card names and categories.
 *
 * @param lang - playgwent language code
 * @param input - Card table, localized names and categories
 * @returns The glossary for {@link translateName}
 */
export function glossaryFor(lang: string, input: Pick<BuildInput, 'cards' | 'cardNames' | 'categories'>): Glossary {
  const glossary: Glossary = new Map()
  for (const [id, name] of Object.entries(input.cardNames[lang] ?? {}))
    addTerm(glossary, name, input.cards[Number(id)]?.name)
  for (const [local, en] of Object.entries(input.categories[lang] ?? {})) addTerm(glossary, local, en)
  return glossary
}

/** Fewer distinct words than this, or mostly repeats, is padding to get past playgwent's minimum length. */
const MIN_WORDS = 10
/** "Mostly repeats" only judges short texts: long real guides repeat common words, so their share of new words drops. */
const REPEAT_CHECK_WORDS = 50
// The detector's ISO codes that differ from playgwent's.
const PLAYGWENT_LANG: Record<string, string> = { pt: 'pt-BR', zh: 'zh-cn' }

/**
 * A guide's language, if it has real text. Whether that text is useful isn't judged: copied filler and blurbs
 * can't be told apart from advice without reading it.
 *
 * @param info - Its measures
 * @param declared - The language its author set
 * @returns Nothing for padding; else its detected language (the declared one when unsure)
 */
export function guideSummary(info: GuideInfo, declared: string): Pick<Deck, 'guideLang'> {
  if (info.unique < MIN_WORDS || (info.unique < REPEAT_CHECK_WORDS && info.unique < info.words * 0.3)) return {}
  return { guideLang: info.lang ? (PLAYGWENT_LANG[info.lang] ?? info.lang) : declared }
}

/** The app's view of a catalog card, keys in the order the dataset has always used; `tags` only the named ones. */
function appCard(
  id: number,
  { name, type, faction, provisions, craftingCost, rarity, power, secondaryFaction, tags }: CatalogCard,
  named: Set<string>,
): Card {
  const known = tags?.filter((k) => named.has(k)) ?? []
  return {
    name,
    type,
    faction,
    provisions,
    scraps: craftingCost,
    rarity: rarityOf(rarity, id),
    ...(power !== undefined && { power }),
    ...(secondaryFaction && { secondaryFaction }),
    ...(known.length && { tags: known }),
  }
}

/**
 * Builds the dataset, the merged deck list and the language packs from the committed stores.
 *
 * Decks are deduped by playgwent hash, and a plain deck link also by its cards (the same list saved twice): the first
 * entry names a deck, and every source and creator listing it is kept. Stats
 * (provisions, scraps, card and unit counts) come from the current card table, so they follow balance changes.
 *
 * @param input - The stores
 * @returns Output files, warnings and errors
 */
export function buildDataset(input: BuildInput): BuildOutput {
  const { entries, store, cards: catalog } = input
  const warnings: string[] = []
  const errors: string[] = []
  const used: Record<number, Card> = {}
  const decks: Deck[] = []
  const byHash = new Map<string, Deck>()
  // Card list (leader and stratagem included) → the first deck with it.
  const byList = new Map<string, Deck>()
  const urlSources = new Map<string, Set<Source>>()
  // A deck's video is the first one any source links, in entry order.
  const urlVideo = new Map<string, Video>()
  for (const e of entries) {
    urlSources.set(e.url, (urlSources.get(e.url) ?? new Set()).add(e.source))
    if (e.video && !urlVideo.has(e.url)) urlVideo.set(e.url, e.video)
  }
  // Channel videos by the deck code their description links (a guide link through its stored deck), newest first.
  const codeOf = (url: string) => {
    const s = store[url]
    return s && !('missing' in s) ? s.hash : url.match(/\/decks\/([^/]+)$/)?.[1]
  }
  const channelVideo = new Map<string, Video>()
  // Who features each deck code, newest video first: credit for the video, not a claim to the deck.
  const featuredBy = new Map<string, string[]>()
  const uploads = readChannels(input.creators)
    .flatMap(({ channel, creator }) =>
      Object.entries(input.videos[channel.id] ?? {}).map(([id, v]) => ({ id, v, channel, creator })),
    )
    .sort((a, b) => b.v.published.localeCompare(a.v.published))
  // Whose upload each video is, so the creator of the video a deck shows is credited first.
  const uploadCreator = new Map(uploads.map(({ id, creator }) => [`https://youtu.be/${id}`, creatorName(creator)]))
  const shownFirst = (names: string[], video: Video | undefined) => {
    const own = video && uploadCreator.get(video.url)
    return own && names.includes(own) ? [own, ...names.filter((n) => n !== own)] : names
  }
  for (const { id, v, channel, creator } of uploads) {
    for (const code of v.decks.map(codeOf)) {
      if (!code) continue
      if (!channelVideo.has(code)) channelVideo.set(code, { url: `https://youtu.be/${id}`, lang: channel.lang })
      const names = featuredBy.get(code) ?? []
      if (!names.includes(creatorName(creator))) featuredBy.set(code, [...names, creatorName(creator)])
    }
  }
  const seen = new Set<string>()
  const glossaries = new Map<string, Glossary>()
  const tagNames = input.tags.en ?? {}
  const named = new Set(Object.keys(tagNames))

  for (const entry of entries) {
    // Later entries for the same URL only add their source (collected above).
    if (seen.has(entry.url)) continue
    seen.add(entry.url)
    const stored = store[entry.url]
    if (!stored || 'missing' in stored) {
      warnings.push(`${stored ? 'not found' : 'not fetched'}: [${entry.source}] ${entry.name} — ${entry.url}`)
      continue
    }
    const label = `${entry.name} (${stored.hash})`
    const unknown = stored.cards.filter(([id]) => !catalog[id])
    if (unknown.length) {
      warnings.push(`${label}: skipped, unknown cards ${unknown.map(([id]) => id).join(', ')}`)
      continue
    }
    const copies = stored.cards.map(([id, n]) => [id, n] as [number, number])
    if (!copies.some(([id]) => catalog[id].type === 'stratagem')) copies.splice(1, 0, [DEFAULT_STRATAGEM, 1])
    for (const [id] of copies) used[id] ??= appCard(id, catalog[id], named)

    const summary = entry.guide && stored.guide ? guideSummary(stored.guide, entry.lang) : {}
    // A guide's own video (narrated, presumably, in the language the guide is written in) comes first, then a list's,
    // then a channel video whose description links the same deck code.
    const video: Video | undefined = stored.guide?.video
      ? { url: stored.guide.video, lang: summary.guideLang ?? entry.lang }
      : (urlVideo.get(entry.url) ?? channelVideo.get(stored.hash))
    // The same saved deck, or (for a plain deck link, not a guide) the same cards saved under another hash: one deck,
    // with every source and creator. Guides stay apart: each has its own author, votes and text.
    const list = listKey(copies)
    const known = byHash.get(stored.hash) ?? (entry.guide ? undefined : byList.get(list))
    if (known) {
      known.sources = SOURCES.filter((s) => known.sources.includes(s) || urlSources.get(entry.url)?.has(s))
      known.video ??= video
      const featured = [...new Set([...(known.featured ?? []), ...(featuredBy.get(stored.hash) ?? [])])]
      if (featured.length) known.featured = shownFirst(featured, known.video)
      byHash.set(stored.hash, known)
      continue
    }
    const count = (t: Card['type']) => copies.filter(([id]) => catalog[id].type === t).length
    if (count('leader') !== 1 || count('stratagem') !== 1) {
      errors.push(`${label}: not exactly one leader/stratagem`)
      continue
    }
    const leader = copies.find(([id]) => catalog[id].type === 'leader')?.[0]
    const nonLeader = copies.filter(([id]) => id !== leader)
    const deck: Deck = {
      name: entry.name,
      id: stored.hash,
      url: entry.url,
      ...(stored.guideModified && { updated: stored.guideModified }),
      stats: {
        // Fetched copies only: the default stratagem playgwent leaves out costs no scraps.
        scraps: stored.cards.reduce((n, [id, k]) => n + catalog[id].craftingCost * k, 0),
        cards: nonLeader.filter(([id]) => catalog[id].type !== 'stratagem').reduce((n, [, k]) => n + k, 0),
        units: copies.filter(([id]) => catalog[id].type === 'unit').reduce((n, [, k]) => n + k, 0),
        provisions: nonLeader.reduce((n, [id, k]) => n + catalog[id].provisions * k, 0),
      },
      sources: SOURCES.filter((s) => urlSources.get(entry.url)?.has(s)),
      ...(entry.guide && { votes: entry.guide.votes, author: entry.guide.author }),
      ...summary,
      ...(video && { video }),
      ...(featuredBy.has(stored.hash) && { featured: shownFirst(featuredBy.get(stored.hash) ?? [], video) }),
      cards: copies,
    }
    // Some guides tagged English carry Russian names.
    const lang = entry.lang === 'en' && /\p{Script=Cyrillic}/u.test(entry.name) ? 'ru' : entry.lang
    // Guides can be published without a name: show the leader's instead of a blank row.
    if (!entry.name.trim() && leader !== undefined) deck.name = catalog[leader].name
    else if (lang !== 'en') {
      if (!glossaries.has(lang)) glossaries.set(lang, glossaryFor(lang, input))
      deck.name =
        input.translations[lang]?.[entry.name] ||
        translateName(entry.name, glossaries.get(lang) ?? new Map(), lang).text
      deck.original = { lang, name: entry.name }
    }
    byHash.set(stored.hash, deck)
    if (!byList.has(list)) byList.set(list, deck)
    decks.push(deck)
  }

  // A tag playgwent gives no English name for can't be offered as a search term.
  const unnamed = new Set(
    Object.keys(used).flatMap((id) => catalog[Number(id)].tags?.filter((k) => !named.has(k)) ?? []),
  )
  if (unnamed.size) warnings.push(`tags with no English name, left out: ${[...unnamed].sort().join(', ')}`)
  const tags = Object.fromEntries(
    [...new Set(Object.values(used).flatMap((c) => c.tags ?? []))].sort().map((k) => [k, tagNames[k]]),
  )

  const packs: Record<string, string> = {}
  for (const lang of LANGUAGES.filter((l) => l !== 'en')) {
    const names = input.cardNames[lang] ?? {}
    const packCards = Object.fromEntries(
      Object.keys(used).map((id) => [id, names[Number(id)] ?? used[Number(id)].name]),
    )
    const missingNames = Object.keys(used).filter((id) => names[Number(id)] === undefined).length
    if (missingNames) warnings.push(`${lang}: ${missingNames} cards have no localized name; using English`)
    const terms = Object.fromEntries(TERM_KEYS.map((k) => [k, input.terms[lang]?.[k]]))
    const localTags = input.tags[lang] ?? {}
    const packTags = Object.fromEntries(Object.entries(tags).map(([k, en]) => [k, localTags[k] ?? en]))
    const missingTags = Object.keys(tags).filter((k) => localTags[k] === undefined).length
    if (missingTags) warnings.push(`${lang}: ${missingTags} tags have no localized name; using English`)
    const pack = JSON.stringify({ terms, cards: packCards, tags: packTags })
    packs[lang] = `;(globalThis.GDS_I18N ??= {})[${JSON.stringify(lang)}] = ${pack}\n`
  }

  // Other names of the creators the decks credit, as guide author or in a video.
  const credited = new Set(decks.flatMap((d) => [d.author, ...(d.featured ?? [])]).map((n) => n?.toLowerCase()))
  const aliases = Object.fromEntries(
    input.creators
      .filter((c) => !c.skip && credited.has(creatorName(c).toLowerCase()) && creatorAliases(c).length)
      .map((c) => [creatorName(c), creatorAliases(c)]),
  )

  return {
    dataset: { scrapedAt: input.scrapedAt, cards: used, tags, decks, ...(Object.keys(aliases).length && { aliases }) },
    decklist: decklistMarkdown(decks, used),
    creators: creatorsMarkdown(input.creators, decks),
    packs,
    warnings,
    errors,
  }
}

/**
 * The creators page the site's Credits links to: every creator whose channels are read (not `skip`), each channel
 * linked, with their confirmed Gwent IDs and how many decks credit them, most first.
 */
function creatorsMarkdown(creators: Creator[], decks: Deck[]): string {
  const cell = (s: string) => s.replaceAll('|', '\\|')
  const credited = (name: string) => decks.filter((d) => d.featured?.includes(name)).length
  const rows = creators
    .filter((c) => !c.skip)
    .map((c) => ({ c, n: credited(creatorName(c)) }))
    .sort((a, b) => b.n - a.n || creatorName(a.c).localeCompare(creatorName(b.c)))
    .map(({ c, n }) => {
      const channels = c.channels
        .map((ch) => `[${cell(ch.title)}](https://www.youtube.com/channel/${ch.id})`)
        .join(', ')
      const langs = [...new Set(c.channels.map((ch) => ch.lang.toUpperCase()))].join(', ')
      return `| ${channels} | ${cell((c.gwent ?? []).join(', '))} | ${langs} | ${n} |`
    })
  return `# Creators

Gwent creators whose YouTube videos link decks on Gwent Deck Search. Each deck from their videos credits the channel
(▶ name) and links the video. Please support them: watch, subscribe, drop by a stream.

A Gwent ID is listed only once confirmed, by the creator or from their own videos; search finds the creator by it too.
Creators can fix their names or opt out with the
[I'm a creator](https://github.com/el8ted/gwentdecksearch/issues/new?template=5-creator.yml) form.

| Channel | Gwent ID | Cards in | Decks |
|---|---|---|---:|
${rows.join('\n')}

Generated by \`pnpm build:data\` from \`data/source/creators.json\`: edit that, not this. "Cards in" is the game
language the videos show; "Decks" counts the decks that credit the channel.
`
}

/** The merged deck list for review: one table row per deck, by faction, leader and name. */
function decklistMarkdown(decks: Deck[], cards: Record<number, Card>): string {
  const leaderOf = (d: Deck) => d.cards.find(([id]) => cards[id].type === 'leader')?.[0] ?? 0
  const cell = (s: string) => s.replaceAll('|', '\\|')
  const rows = decks
    .map((d) => ({ d, faction: cards[leaderOf(d)].faction, leader: cards[leaderOf(d)].name }))
    .sort(
      (a, b) =>
        a.faction.localeCompare(b.faction) || a.leader.localeCompare(b.leader) || a.d.name.localeCompare(b.d.name),
    )
    .map(({ d, faction, leader }) => {
      const sources = d.sources.map((s) => SOURCE_NAMES[s]).join(', ')
      const votes = d.votes === undefined ? '' : `${d.votes} (${cell(d.author ?? '')})`
      const original = d.original ? `${d.original.lang}: ${d.original.name}` : ''
      return `| ${faction} | ${cell(leader)} | ${cell(d.name)} | ${cell(original)} | [${d.id.slice(0, 8)}](${d.url}) | ${sources} | ${votes} |`
    })
  return `# Merged deck list\n\nGenerated by \`pnpm scrape\` — do not edit; fix names in \`data/source/translations.json\`.\n\n| Faction | Leader | Deck Name | Original Name | Deck | Sources | Votes (author) |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`
}
