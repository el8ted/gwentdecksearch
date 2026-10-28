/** A YouTube channel of a creator: its ID, its title when read, and the language its cards are played in. */
export interface CreatorChannel {
  id: string
  title: string
  /** playgwent code; `en` unless the channel plays in another client language. */
  lang: string
}

/**
 * A person (or a group) who publishes Gwent decks on YouTube, in the hand-kept registry (`data/source/creators.json`):
 * their channels, read for deck links and credited by name, and their Gwent IDs once confirmed.
 */
export interface Creator {
  /**
   * Gwent IDs (in-game or playgwent names) the maintainer has **confirmed** are theirs, from their videos or from
   * them. Never guessed: an ID here makes search treat it and the channel as one creator.
   */
  gwent?: string[]
  channels: CreatorChannel[]
  /** Don't read their channels: an opt-out, or a channel that links no decks. Nothing of theirs is credited. */
  skip?: boolean
}

/**
 * The name a creator is credited by: their first channel's title, their brand on YouTube.
 *
 * @param creator - The creator
 * @returns Their display name
 */
export const creatorName = (creator: Creator): string => creator.channels[0]?.title ?? ''

/**
 * Every name a creator can be found by besides the one shown: their confirmed Gwent IDs and their other channels.
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
 * New registry entries from community guides' videos: a channel at least {@link MIN_GUIDES} of whose videos one guide
 * author embeds (and no one else does) is likely a creator's, its language their guides' most common. Only the
 * channel is added: a guide author embedding a channel's videos doesn't make it theirs (alkso's guides embed Electric
 * 000, whose videos show RGT_Makstron), so Gwent IDs are added by hand once confirmed. Channels the registry already
 * has are left to it, so a hand-made entry is never overridden.
 *
 * @param videos - Every guide video with its channel
 * @param known - The registry
 * @returns Entries to add, by channel in first-seen order
 */
export function seedCreators(videos: GuideVideo[], known: Creator[]): Creator[] {
  const knownChannels = new Set(known.flatMap((c) => c.channels.map((ch) => ch.id)))
  const byChannel = new Map<string, GuideVideo[]>()
  for (const v of videos) byChannel.set(v.channel, [...(byChannel.get(v.channel) ?? []), v])
  const added: Creator[] = []
  for (const [id, list] of byChannel) {
    const authors = new Set(list.map((v) => v.author.toLowerCase()))
    if (knownChannels.has(id) || list.length < MIN_GUIDES || authors.size > 1) continue
    const langs = new Map<string, number>()
    for (const v of list) langs.set(v.lang, (langs.get(v.lang) ?? 0) + 1)
    const [lang] = [...langs].sort((a, b) => b[1] - a[1])[0]
    added.push({ channels: [{ id, title: list[0].channelTitle.trim(), lang }] })
  }
  return added
}

/**
 * What the data says about a creator's Gwent IDs, for the maintainer to confirm: the guide authors their channels'
 * own descriptions link (strong: the channel publishes that author's guides), and the authors whose guides embed their
 * videos (weak: anyone can embed a video). Neither proves an ID; it says which IDs are worth checking in a video.
 *
 * @param creator - The creator
 * @param links - Each channel's stored deck links (from `videos.json`), by channel ID
 * @param guideAuthor - Guide URL → author, for the guides in the pool
 * @param embeds - Every guide video with its channel
 * @returns Authors with counts, most first, and those of them (2 or more) that aren't confirmed IDs yet
 */
export function creatorEvidence(
  creator: Creator,
  links: Record<string, string[]>,
  guideAuthor: Map<string, string>,
  embeds: GuideVideo[],
): { linked: [string, number][]; embedding: [string, number][]; toCheck: string[] } {
  const ids = new Set(creator.channels.map((c) => c.id))
  const count = (names: string[]) => {
    const n = new Map<string, number>()
    for (const name of names) n.set(name, (n.get(name) ?? 0) + 1)
    return [...n].sort((a, b) => b[1] - a[1])
  }
  const linked = count([...ids].flatMap((id) => (links[id] ?? []).flatMap((url) => guideAuthor.get(url) ?? [])))
  const embedding = count(embeds.filter((v) => ids.has(v.channel)).map((v) => v.author))
  const confirmed = new Set((creator.gwent ?? []).map((n) => n.toLowerCase()))
  const toCheck = [...new Set([...linked, ...embedding].filter(([, n]) => n >= 2).map(([a]) => a))].filter(
    (a) => !confirmed.has(a.toLowerCase()),
  )
  return { linked, embedding, toCheck }
}
