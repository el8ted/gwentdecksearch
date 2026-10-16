/**
 * Retakes the README screenshots (docs/screenshots/*.png) from the built site, so they follow the current data and
 * UI. Examples use every source, and searches whose top decks come from a mix of authors, so no one creator is
 * featured.
 *
 * Run: `pnpm build && pnpm screenshots`. If the data no longer supports an example, the script stops and says which.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { type Browser, chromium, type Page } from '@playwright/test'
import { consola } from 'consola'
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
const PAIR = [card('Queen Meve'), card('Griffin Witcher'), card('Margarita Laux-Antille')]
const TATTERWING = card('Tatterwing')
const ANY_CARDS = [HIVE_MIND, GOLDEN_NEKKER, TATTERWING]

/** Opens the page in a fresh context (no saved settings) at 1280×800, dark theme. */
async function open(browser: Browser, suffix: string, height = 800): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height }, colorScheme: 'dark' })
  const page = await context.newPage()
  await page.goto(PAGE_URL + suffix)
  await page.locator('#results [data-toggle]').first().waitFor()
  return page
}

/** How many decks the page lists, read from the results heading. */
async function listed(page: Page): Promise<number> {
  return Number((await page.locator('#result-head').innerText()).match(/\d[\d,]*/)?.[0].replace(/,/g, ''))
}

/** Whether two PNGs have the same pixels, decoded by the page: runs encode identical images differently. */
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
      return p.length === q.length && p.every((v, i) => v === q[i])
    },
    [a.toString('base64'), b.toString('base64')],
  )
}

/** Saves a screenshot, leaving the file alone when nothing visible changed so reruns don't churn git history. */
async function save(page: Page, name: string, target?: string) {
  const path = join(OUT, `${name}.png`)
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

  page = await open(browser, `#f=MO&l=${ARACHAS}&c=${HIVE_MIND},${HIDEOUS_FEAST}`)
  await save(page, 'common-cards')

  page = await open(browser, `#f=MO&l=${ARACHAS}&c=${HIVE_MIND},${HIDEOUS_FEAST}`)
  await page.locator('[data-freq="least"]').click()
  await save(page, 'least-common')

  page = await open(browser, `#k=any&c=${ANY_CARDS.join(',')}`)
  await save(page, 'any-cards')

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

  page = await open(browser, '#f=NR&b=spare', 640)
  await save(page, 'provisions')

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
