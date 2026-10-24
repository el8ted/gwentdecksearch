import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize } from 'node:path'
import { expect, test } from '@playwright/test'

// The site over HTTP (service workers don't run from file://), going offline mid-visit as a phone at a match might.
const DIST = join(import.meta.dirname, '..', 'dist')
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
}

let server: Server
let origin: string

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname))
    try {
      const body = await readFile(join(DIST, path.endsWith('/') ? `${path}index.html` : path))
      // As GitHub Pages serves it.
      res.writeHead(200, {
        'content-type': TYPES[extname(path) || '.html'] ?? 'application/octet-stream',
        'cache-control': 'max-age=600',
      })
      res.end(body)
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

test('offline after a visit, the page reloads and every leader icon still draws', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', "Playwright's offline mode reaches service workers in Chromium only")
  // Arrange: a first visit, which saves the offline copy
  await page.goto(`${origin}/`)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

  // Act: the network goes, and the visitor reloads and picks a faction whose icons never showed
  await context.setOffline(true)
  await page.reload()
  await page.locator('[data-faction="NG"]').click()

  // Assert
  const icons = page.locator('#leader img')
  await expect(icons.first()).toBeVisible()
  const broken = await icons.evaluateAll(
    (imgs) => (imgs as HTMLImageElement[]).filter((i) => !i.complete || i.naturalWidth === 0).length,
  )
  expect(broken).toBe(0)
  await expect(page.locator('#deck-count, .result-head').first()).toBeVisible()
})
