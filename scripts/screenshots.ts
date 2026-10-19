/**
 * Retakes the README and guide screenshots (docs/screenshots/*.png) from the built site, so they follow the current
 * data and UI. Examples use every source, and searches whose top decks come from a mix of authors, so no one creator
 * is featured.
 *
 * Run: `pnpm build && pnpm screenshots`. If the data no longer supports an example, the script stops and says which.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { type Browser, chromium, type Page } from '@playwright/test'
import { consola } from 'consola'
import { BUDGETS, budgetSide, indexDecks, matchDecks } from '../src/filter.ts'
import { LANGUAGES } from '../src/i18n.ts'
import type { Dataset } from '../src/types.ts'

const ROOT = join(import.meta.dirname, '..')
const PAGE_URL = pathToFileURL(join(ROOT, 'dist', 'index.html')).href
const OUT = join(ROOT, 'docs', 'screenshots')
const data: Dataset = JSON.parse(readFileSync(join(ROOT, 'data', 'decks.json'), 'utf8'))

/** A card's ID by English name; fails if a data refresh dropped it. */
function card(name: string): number {
  const id = Object.keys(data.cards).find((k) => data.cards[Number(k)].name === name)
  if (!id) throw new Error(`No card named ${name}; pick another example`)
  return Number(id)
}

const ARACHAS = card('Arachas Swarm')
const HIVE_MIND = card('Hive Mind')
const HIDEOUS_FEAST = card('Hideous Feast')
const GOLDEN_NEKKER = card('Golden Nekker')
const FRUITS = card('Fruits of Ysgith')
const SHIELDWALL = card('Shieldwall')
// Decks exactly on the provision limit, so the example shows decks ready to play.
const PAIR = [card('Queen Meve'), card('Griffin Witcher'), card('Margarita Laux-Antille'), card('Bloody Baron')]
const TATTERWING = card('Tatterwing')
const ANY_CARDS = [HIVE_MIND, GOLDEN_NEKKER, TATTERWING]
// ≈ for an Over deck with a handful of close decks that fit: the first such deck, so reruns pick the same one.
const decks = indexDecks(data)
const valid = BUDGETS.filter((b) => budgetSide(b) !== 'over')
const NEAR = decks.find((e) => {
  if (budgetSide(e.budget) !== 'over') return false
  const n = matchDecks(decks, { factions: [], picks: [], leader: e.leader, budgets: valid, near: e.deck.id }).length
  return n >= 3 && n <= 6
})
if (!NEAR) throw new Error('similar: no Over deck with 3–6 similar decks; change the range')

/** Opens the page in a fresh context (no saved settings) at 1280×800, dark theme, without animations. */
async function open(browser: Browser, suffix: string, height = 800): Promise<Page> {
  // No transitions, so a shot never catches a pill or panel mid-fade.
  const context = await browser.newContext({
    viewport: { width: 1280, height },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.goto(PAGE_URL + suffix)
  await page.locator('#results [data-toggle]').first().waitFor()
  return page
}

/** How many decks the page lists, read from the results heading. */
async function listed(page: Page): Promise<number> {
  return Number((await page.locator('#result-head').innerText()).match(/\d[\d,]*/)?.[0].replace(/,/g, ''))
}

/**
 * Whether two PNGs show the same thing, decoded by the page: runs encode identical images differently, and anti-aliased
 * edges can differ by a shade or two between runs, so a channel may differ by up to 2 (no visible change does less).
 */
function samePixels(page: Page, a: Buffer, b: Buffer): Promise<boolean> {
  return page.evaluate(
    async ([a, b]) => {
      const pixels = async (base64: string) => {
        const img = new Image()
        img.src = `data:image/png;base64,${base64}`
        await img.decode()
        const ctx = new OffscreenCanvas(img.width, img.height).getContext('2d') as OffscreenCanvasRenderingContext2D
        ctx.drawImage(img, 0, 0)
        return ctx.getImageData(0, 0, img.width, img.height).data
      }
      const [p, q] = await Promise.all([pixels(a), pixels(b)])
      return p.length === q.length && p.every((v, i) => Math.abs(v - q[i]) <= 2)
    },
    [a.toString('base64'), b.toString('base64')],
  )
}

/** Saves a screenshot, leaving the file alone when nothing visible changed so reruns don't churn git history. */
async function save(page: Page, name: string, target?: string) {
  const path = join(OUT, `${name}.png`)
  // Icons and art load after the page: shoot only once every image is in.
  await page.waitForFunction(() => [...document.images].every((img) => img.complete))
  const shot = target ? await page.locator(target).screenshot() : await page.screenshot()
  const same = existsSync(path) && (await samePixels(page, shot, readFileSync(path)))
  if (!same) writeFileSync(path, shot)
  await page.context().close()
  consola.success(`${name}${same ? ' (unchanged)' : ''}`)
}

const browser = await chromium.launch()
try {
  let page = await open(browser, `#f=MO&l=${FRUITS}`)
  await save(page, 'overview')
  // The same view in every other language, for the top of each README.{lang}.md.
  for (const lang of LANGUAGES.filter((l) => l !== 'en')) {
    page = await open(browser, `?lang=${lang}#f=MO&l=${FRUITS}`)
    await save(page, `overview-${lang}`)
  }

  page = await open(browser, `#f=MO&l=${ARACHAS}&c=${HIVE_MIND},${HIDEOUS_FEAST}`, 560)
  await page.locator('#card-input').fill('kiki')
  await page.locator('#suggestions [role="option"]').first().waitFor()
  await save(page, 'autocomplete')

  // A query matching a tag, cards and authors at once.
  page = await open(browser, '', 900)
  await page.locator('#card-input').fill('mag')
  await page.locator('#suggestions [data-tag^="@"]').first().waitFor()
  if (!(await page.locator('#suggestions [data-tag="c14"]').count()))
    throw new Error('search-tags: no Mage tag; pick another query')
  await save(page, 'search-tags')

  page = await open(browser, `#f=MO&l=${ARACHAS}&c=${HIVE_MIND},${HIDEOUS_FEAST}`)
  await save(page, 'common-cards')

  page = await open(browser, `#f=MO&l=${ARACHAS}&c=${HIVE_MIND},${HIDEOUS_FEAST}`)
  await page.locator('[data-freq="least"]').click()
  await save(page, 'least-common')

  // Leaving out a card you'd rather not play, while typing another exclusion.
  page = await open(browser, `#f=MO&c=-${GOLDEN_NEKKER}`, 560)
  await page.locator('#card-input').fill('-kiki')
  await page.locator('#suggestions .sug-without').first().waitFor()
  await save(page, 'exclude')

  // The Over deck's own step on too, so it leads as This deck.
  const steps = [...valid, NEAR?.budget].join(',')
  page = await open(browser, `#f=${NEAR?.faction}&b=${steps}&l=${NEAR?.leader}&n=${NEAR?.deck.id}`, 1100)
  await save(page, 'similar')

  page = await open(browser, `#k=any&c=${ANY_CARDS.join(',')}`)
  await save(page, 'any-cards')

  // A creator and a theme: the Devotion tag with Shinmiri2, in Skellige.
  page = await open(browser, '#f=SK&c=devotion%2C%40shinmiri2')
  const built = await listed(page)
  if (built < 3 || built > 20) throw new Error(`deck-to-build: expected 3–20 decks, got ${built}; pick another example`)
  await save(page, 'deck-to-build')

  // Element shots get a tall window: scrolling to them would slide the sticky filter bar over the decks.
  page = await open(browser, `#f=MO&l=${ARACHAS}&c=${GOLDEN_NEKKER}`, 1600)
  await page.locator('#results [data-toggle]').first().click()
  await save(page, 'decklist', '#results .deck >> nth=0')

  page = await open(browser, `#f=NR&b=exact&l=${SHIELDWALL}&c=${PAIR.join(',')}`, 2400)
  const pair = await listed(page)
  if (pair < 2 || pair > 3) throw new Error(`dim-common: expected 2–3 decks, got ${pair}; pick other cards`)
  await page.locator('#expand-all').click()
  await page.locator('#dim-common').click()
  await save(page, 'dim-common', '#results')

  page = await open(browser, '#f=NR&b=spare3,spare2,spare1', 640)
  await save(page, 'provisions')

  page = await open(browser, '#v=1&gl=en', 640)
  await save(page, 'videos')

  page = await open(browser, '?lang=ru#f=NR')
  await page.locator('#langmenu summary').click()
  await save(page, 'languages')

  page = await open(browser, `#f=MO&l=${ARACHAS}&c=${TATTERWING}`, 640)
  await page.locator('#display summary').click()
  await page.locator('[data-pref="cvd"][data-value="true"]').click()
  await save(page, 'display')

  page = await open(browser, '', 900)
  await page.locator('#shortcuts-open').click()
  await save(page, 'help', '#shortcuts')
} finally {
  await browser.close()
}
