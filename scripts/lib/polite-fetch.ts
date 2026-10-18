import { setTimeout as sleep } from 'node:timers/promises'
import { consola } from 'consola'

const USER_AGENT = 'gwent-deck-search (personal, non-commercial)'
const BACKOFF_MS = [5_000, 10_000, 20_000]
const TIMEOUT_MS = 30_000

/** Raised for a 404 or similar permanent failure; the run continues without that page. */
export class NotFoundError extends Error {}

/** Per-host minimum gap between requests, in milliseconds. */
export type HostDelays = Record<string, number>

/**
 * Creates a sequential, throttled fetcher: the scraper's request policy.
 *
 * - One request in flight at a time, with a minimum gap per host (`delays`); unknown hosts are refused.
 * - An honest User-Agent naming the tool.
 * - On 429 or 5xx: honor `Retry-After`, else back off 5 s, 10 s, 20 s; after that, throw. Any other failure
 *   throws at once (the scraper then stops; the stores keep what was fetched).
 * - Only fetch URLs the site's robots.txt allows (playgwent's blocks only GPTBot). Nothing here enforces this:
 *   check robots.txt before adding a new host or path.
 *
 * Callers must `await` each call before the next: the throttle assumes one request in flight.
 *
 * @param delays - Minimum gap per host; unknown hosts are refused so nothing is fetched unthrottled
 * @returns `get(url)` resolving to the body as text, and `get.bytes(url)` as bytes; both throw {@link NotFoundError}
 *   for a 404
 */
export function createPoliteFetch(delays: HostDelays) {
  const lastRequest = new Map<string, number>()

  async function throttle(host: string) {
    const wait = (lastRequest.get(host) ?? 0) + delays[host] - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequest.set(host, Date.now())
  }

  async function bytes(url: string): Promise<Buffer> {
    const host = new URL(url).host
    if (!(host in delays)) throw new Error(`No throttle configured for ${host}`)

    for (let attempt = 0; ; attempt++) {
      await throttle(host)
      // The timeout also covers the body, so it's read inside the catch: a stalled download is retried too.
      const got = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
        .then(async (r) => ({ r, body: r.ok ? Buffer.from(await r.arrayBuffer()) : Buffer.alloc(0) }))
        .catch((e: Error) => e)
      const res = got instanceof Error ? got : got.r
      if (!(got instanceof Error) && got.r.ok) {
        return got.body
      }
      if (!(res instanceof Error) && res.status === 404) throw new NotFoundError(`404 ${url}`)
      const retryable = res instanceof Error || res.status === 429 || res.status >= 500
      const reason = res instanceof Error ? res.message : `HTTP ${res.status}`
      if (!retryable || attempt >= BACKOFF_MS.length) throw new Error(`${reason} for ${url}`)
      const retryAfter = res instanceof Error ? Number.NaN : Number(res.headers.get('retry-after'))
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : BACKOFF_MS[attempt]
      consola.warn(`${reason} for ${url}; retrying in ${wait / 1000}s`)
      await sleep(wait)
    }
  }

  // TextDecoder, like Response.text(), drops a byte-order mark.
  const get = async (url: string) => new TextDecoder().decode(await bytes(url))
  return Object.assign(get, { bytes })
}
