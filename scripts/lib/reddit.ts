import {
  BUDGETS,
  budgetSide,
  deckBody,
  type IndexedDeck,
  listForUrl,
  matchDecks,
  overlap,
  provisionStatus,
} from '../../src/filter.ts'
import { encodeState } from '../../src/hash.ts'
import type { Dataset } from '../../src/types.ts'

/** The live site, which every link in a reply opens. */
export const SITE = 'https://el8ted.github.io/gwentdecksearch/'

/** A reply to post, or why there's nothing worth posting. */
export type RedditReply = { ok: true; markdown: string } | { ok: false; reason: string }

/**
 * A short, polite Reddit comment (Markdown, old and new Reddit) for a shared playgwent deck: its gameplay video and, if
 * it's over today's provision limit, the close decks that still fit. Only when one of those exists: a reply with
 * nothing new in it is just an ad.
 *
 * @param data - The dataset the site ships
 * @param decks - `indexDecks(data)`
 * @param url - The playgwent.com deck or guide link from the post
 * @param options - `author`: the site's author is posting, so the footer says so (only true for them, so not default)
 * @returns The comment, or the reason not to post one
 */
export function redditReply(
  data: Dataset,
  decks: IndexedDeck[],
  url: string,
  { author = false }: { author?: boolean } = {},
): RedditReply {
  const list = listForUrl(decks, url)
  const deck = list === undefined ? undefined : decks.find((e) => e.deck.id === list)
  if (!deck) return { ok: false, reason: "That deck isn't in Gwent Deck Search, so there's nothing to link to." }

  const { delta, used, limit } = provisionStatus(deck, data.cards)
  const fits = BUDGETS.filter((b) => budgetSide(b) !== 'over')
  // The ≈ list as the page shows it after clicking ≈: same leader, decks that fit, closest first.
  const similar = { factions: [deck.faction], picks: [], leader: deck.leader, budgets: fits, near: deck.deck.id }
  const fixes = delta < 0 ? matchDecks(decks, similar) : []
  const video = deck.deck.video
  if (!video && fixes.length === 0) {
    const why = delta < 0 ? `it's ${-delta} over today's limit, but no close deck fits` : "it fits today's limit"
    return { ok: false, reason: `No gameplay video, and ${why}: nothing worth posting.` }
  }

  const deckLink = `${SITE}?deck=${encodeURIComponent(deck.deck.url)}`
  const lines = [`Hi! I looked this deck up on [Gwent Deck Search](${SITE}), a free fan-made deck finder:`, '']
  if (video) {
    const lang = new Intl.DisplayNames('en', { type: 'language' }).of(video.lang) ?? video.lang
    lines.push(
      `* **Gameplay video** (${lang}): [watch it here](${video.url}). The [deck page](${deckLink}) has it next to the guide.`,
    )
  }
  if (delta < 0) {
    const over = `With today's card costs it's **${-delta} over** the provision limit (${used}/${limit})`
    if (fixes.length) {
      const size = deckBody(deck).reduce((n, [, c]) => n + c, 0)
      const closest = overlap(deck, fixes[0])
      const decks = fixes.length === 1 ? '1 similar deck' : `${fixes.length} similar decks`
      lines.push(
        `* **Provisions:** ${over}. [${decks} that fit](${SITE}${encodeState(similar)}) share most of its cards, the closest ${closest} of ${size}.`,
      )
    } else lines.push(`* **Provisions:** ${over}, so it needs a cheaper card or two before it's playable.`)
  }
  const date = data.scrapedAt.slice(0, 10)
  lines.push('', `^(Data as of ${date}. Unofficial fan project, not affiliated with CD PROJEKT RED.)`)
  if (author) lines.push('', '^(I made Gwent Deck Search; happy to answer questions.)')
  return { ok: true, markdown: lines.join('\n') }
}
