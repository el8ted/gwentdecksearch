import { eld } from 'eld/medium'
import { youtubeUrl } from './sources.ts'

/** A guide's text as playgwent stores it: Quill delta ops (text, or an embedded video or image). */
export interface GuideContent {
  ops?: { insert?: string | { video?: string; image?: string }; attributes?: { link?: string } }[]
}

/** What a guide offers besides its deck, measured once at fetch time (the text itself isn't published). */
export interface GuideInfo {
  /** The first YouTube video it embeds or links. */
  video?: string
  /** Words, links and repeated words left out; in Chinese and Japanese each character counts as one. */
  words: number
  /** Distinct words among them: padding like "text text text" has many words but few distinct ones. */
  unique: number
  images: number
  /** The language the text reads as (ISO 639-1, e.g. `ru`), when the detector is sure. */
  lang?: string
}

// A Han or kana character is a word of its own; otherwise a run of letters and digits.
const WORD = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu

/**
 * Measures a guide's content.
 *
 * @param content - The guide API's `content`
 * @returns Its info, and its plain text (for a local cache that tunes thresholds without refetching)
 */
export function guideInfo(content: GuideContent | null | undefined): { info: GuideInfo; text: string } {
  let text = ''
  let images = 0
  const videos: string[] = []
  for (const op of content?.ops ?? []) {
    if (typeof op.insert === 'string') text += op.insert
    else if (op.insert?.image) images++
    else if (op.insert?.video) videos.push(op.insert.video)
    if (op.attributes?.link) videos.push(op.attributes.link)
  }
  const prose = text.replace(/https?:\/\/\S+/g, ' ')
  for (const [url] of text.matchAll(/https?:\/\/\S+/g)) videos.push(url)
  const words = (prose.match(WORD) ?? []).map((w) => w.toLowerCase())
  const detected = words.length ? eld.detect(prose) : undefined
  const info: GuideInfo = { words: words.length, unique: new Set(words).size, images }
  const video = videos.map(youtubeUrl).find(Boolean)
  if (video) info.video = video
  if (detected?.language && detected.isReliable()) info.lang = detected.language
  return { info, text: text.trim() }
}
