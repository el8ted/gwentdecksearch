/** Card types as reported by playgwent. */
export type CardType = 'leader' | 'stratagem' | 'unit' | 'special' | 'artifact'

/** Faction codes; `NE` is neutral. */
export type Faction = 'MO' | 'NG' | 'NR' | 'SK' | 'ST' | 'SY' | 'NE'

/** Every playable faction, in display order (neutral excluded: no deck has a neutral leader). */
export const FACTIONS: readonly Faction[] = ['MO', 'NG', 'NR', 'SK', 'ST', 'SY']

/**
 * Where a deck was listed, in display order: Community first, then deck-list authors alphabetically.
 * (Which source names a shared deck is decided separately, by entry order in scripts/lib/entries.ts.)
 */
export const SOURCES = ['community', 'metallic-danny', 'shinmiri2'] as const

/** A deck source. */
export type Source = (typeof SOURCES)[number]

/**
 * Each list's owner by their playgwent name, so their list and their community guides count as one author in search.
 * A new list needs its owner's playgwent name.
 */
export const SOURCE_AUTHORS: Record<Exclude<Source, 'community'>, string> = {
  shinmiri2: 'shinmiri2',
  'metallic-danny': 'MetallicDanny',
}

/** Display names for {@link Source}. */
export const SOURCE_NAMES: Record<Source, string> = {
  community: 'Community',
  shinmiri2: 'Shinmiri2',
  'metallic-danny': 'MetallicDanny',
}

/** How rare a card is, which sets what it costs to craft; cheapest first. */
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const
/** One of {@link RARITIES}. */
export type Rarity = (typeof RARITIES)[number]

/** A card as used by the app. */
export interface Card {
  name: string
  type: CardType
  faction: Faction
  /** Second faction of a dual-faction card (e.g. Tatterwing: SY + MO); such cards fit either faction's decks. */
  secondaryFaction?: Faction
  /** Base power; units only. */
  power?: number
  /** Card cost; for a leader, the bonus added to the 150 provision limit (current, from playgwent's card search). */
  provisions: number
  /** Scraps to craft one copy; 0 for leaders and the default stratagem, which every player has. */
  scraps: number
  rarity: Rarity
  /** {@link TagKey}s: the card's categories, then the abilities its text names. */
  tags?: TagKey[]
}

/**
 * A deck-builder tag: `c{id}` for a category (Beast, Ogroid, Spell…), or an ability's slug (`devotion`, `order`…).
 * One key per playgwent ID, however the card text words it (Order/Orders, Coin/Coins).
 */
export type TagKey = string

/** playgwent's deck totals, which are current. */
export interface DeckStats {
  scraps: number
  cards: number
  units: number
  /** Provisions used, excluding the leader. */
  provisions: number
}

/** A gameplay video for a deck. */
export interface Video {
  url: string
  /** The language it's narrated in (playgwent code, e.g. `en`, `ru`). */
  lang: string
}

/** One deck list. Alternate versions are separate records sharing a `name`. */
export interface Deck {
  name: string
  /** playgwent deck hash. */
  id: string
  url: string
  /** When the guide was last edited (ISO time); guides only, as a sheet deck has no meaningful date. */
  updated?: string
  stats: DeckStats
  /** The source's own name and language, when that wasn't English (shown to visitors using that language). */
  original?: { lang: string; name: string }
  /** Every source listing this deck, in {@link SOURCES} order. */
  sources: Source[]
  /** Community guides only: playgwent votes and author. */
  votes?: number
  author?: string
  /**
   * Community guides with real text only: the language it reads as (playgwent code; the author's setting when unsure).
   * Padding ("text text text") has none.
   */
  guideLang?: string
  /** A gameplay video one of the sources links. */
  video?: Video
  /** Creators whose videos link this deck, by channel name, newest video first. */
  featured?: string[]
  /** `[cardId, copies]`, including the leader and stratagem. */
  cards: [cardId: number, copies: number][]
}

/** The generated dataset shipped with the app. */
export interface Dataset {
  scrapedAt: string
  cards: Record<number, Card>
  /** English name of every tag on {@link cards}. */
  tags: Record<TagKey, string>
  decks: Deck[]
  /** Creators' confirmed Gwent IDs (and any other channel) by channel name: search treats them as one author. */
  aliases?: Record<string, string[]>
}
