/** A YouTube channel of a creator: its ID, its title when read, and the language its cards are played in. */
export interface CreatorChannel {
  id: string
  title: string
  /** playgwent code; `en` unless the channel plays in another client language. */
  lang: string
}

/**
 * A person (or a group) who publishes Gwent decks: their Gwent names and their channels, in the hand-kept registry
 * (`data/source/creators.json`). Their channels are read for deck links, and every one of their names finds them.
 */
export interface Creator {
  /** Their in-game (playgwent) names; the first is the one shown. A group channel has none. */
  gwent?: string[]
  channels: CreatorChannel[]
  /** Don't read their channels: an opt-out, or a channel that links no decks. Nothing of theirs is credited. */
  skip?: boolean
}

/**
 * The name a creator is shown by: their first Gwent name, else their first channel's title.
 *
 * @param creator - The creator
 * @returns Their display name
 */
export const creatorName = (creator: Creator): string => creator.gwent?.[0] ?? creator.channels[0]?.title ?? ''

/**
 * Every name a creator can be found by besides the one shown: their other Gwent names and their channels' titles.
 *
 * @param creator - The creator
 * @returns Other names, each once, case ignored, the display name left out
 */
export function creatorAliases(creator: Creator): string[] {
  const shown = creatorName(creator).toLowerCase()
  const seen = new Set([shown])
  return [...(creator.gwent ?? []), ...creator.channels.map((c) => c.title)].filter((n) => {
    const key = n.toLowerCase()
    if (!n || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** A community guide's video, with the channel it's on. */
export interface GuideVideo {
  author: string
  /** The guide's language (playgwent code). */
  lang: string
  channel: string
  channelTitle: string
}

/** A channel counts as a guide author's own only with at least this many of their guides' videos on it. */
const MIN_GUIDES = 3

/**
 * New registry entries from community guides' videos: a channel whose guide videos (at least {@link MIN_GUIDES}) all
 * belong to one author is that author's channel, its language their guides' most common. Channels and authors the
 * registry already has are left to it, so a hand-made entry is never overridden. Shared channels (several authors)
 * aren't guessed: add them by hand.
 *
 * @param videos - Every guide video with its channel
 * @param known - The registry
 * @returns Entries to add, by channel in first-seen order
 */
export function seedCreators(videos: GuideVideo[], known: Creator[]): Creator[] {
  const knownChannels = new Set(known.flatMap((c) => c.channels.map((ch) => ch.id)))
  const knownNames = new Set(known.flatMap((c) => c.gwent ?? []).map((n) => n.toLowerCase()))
  const byChannel = new Map<string, GuideVideo[]>()
  for (const v of videos) byChannel.set(v.channel, [...(byChannel.get(v.channel) ?? []), v])
  const added: Creator[] = []
  for (const [id, list] of byChannel) {
    const authors = new Set(list.map((v) => v.author.toLowerCase()))
    if (knownChannels.has(id) || list.length < MIN_GUIDES || authors.size > 1) continue
    const author = list[0].author
    if (knownNames.has(author.toLowerCase())) continue
    const langs = new Map<string, number>()
    for (const v of list) langs.set(v.lang, (langs.get(v.lang) ?? 0) + 1)
    const [lang] = [...langs].sort((a, b) => b[1] - a[1])[0]
    added.push({ gwent: [author], channels: [{ id, title: list[0].channelTitle.trim(), lang }] })
  }
  return added
}
