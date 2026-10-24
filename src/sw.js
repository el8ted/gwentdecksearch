// The site's offline copy, so a match in progress survives the network going away: the page always shows the date
// of its data, so a saved copy is safe to use. Registered from src/main.ts; tsdown.config.ts copies this file to
// dist/sw.js with FILES (everything the page loads) and VERSION (a hash of them) filled in.
const VERSION = '__VERSION__'
const FILES = __FILES__
const CACHE = `gds-${VERSION}`
const SAVED = new Set(FILES.map((f) => new URL(f, location).href))

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  )
})

// A new version replaces the old copy entirely, so the page and its data never mix releases offline.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== location.origin) return
  // Icons and fonts only change with a release, which saves them anew: no need to ask the network first.
  event.respondWith(/\/(icons|fonts)\//.test(url.pathname) ? savedFirst(request) : networkFirst(event))
})

async function savedFirst(request) {
  return (await caches.match(request)) ?? fetch(request)
}

// shortcut: no timeout, so a connection that hangs (rather than fails) waits on the browser before the saved copy;
// add one if that bites, but a timeout can pair a fresh page with a saved script from the release before.
async function networkFirst(event) {
  const { request } = event
  try {
    const response = await fetch(request)
    // The page with ?lang= is the same page: saved under its plain address, kept current with each visit.
    const key = request.mode === 'navigate' ? new URL('./', location).href : request.url
    if (response.ok && SAVED.has(key)) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(key, copy)))
    }
    return response
  } catch (error) {
    const saved = await caches.match(request, { ignoreSearch: request.mode === 'navigate' })
    if (saved) return saved
    throw error
  }
}
