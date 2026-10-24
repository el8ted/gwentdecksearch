import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

/** dist/sw.js from src/sw.js: every file the page loads, and a version that changes when any of them does. */
function writeServiceWorker() {
  const top = ['index.html', 'app.iife.js', 'styles.css', 'manifest.webmanifest']
  const siteIcons = ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']
  const files = [
    ...top,
    ...siteIcons,
    ...['icons', 'fonts', 'i18n'].flatMap((dir) => readdirSync(`dist/${dir}`).map((f) => `${dir}/${f}`)),
  ]
  const hash = createHash('sha256')
  for (const file of files) hash.update(file).update(readFileSync(`dist/${file}`))
  const sw = readFileSync('src/sw.js', 'utf8')
    .replace('__VERSION__', hash.digest('hex').slice(0, 12))
    .replace('__FILES__', JSON.stringify(['./', ...files]))
  writeFileSync('dist/sw.js', sw)
}

export default defineConfig({
  entry: { app: 'src/main.ts' },
  platform: 'browser',
  // IIFE (not ESM) so dist/index.html works from file://, where module scripts are blocked.
  format: 'iife',
  dts: false,
  minify: true,
  // The release tag (the release workflow sets RELEASE_TAG), shown in Credits; any other build is "dev".
  define: { __VERSION__: JSON.stringify(process.env.RELEASE_TAG || 'dev') },
  copy: [
    'src/index.html',
    'src/styles.css',
    // The release zip is a copy of the software: the license terms and notice must travel with it.
    'LICENSE',
    'NOTICE.md',
    { from: 'src/icons/*', to: 'dist/icons' },
    // The title's typeface (cut down to its letters) and its licence.
    { from: 'src/fonts/*', to: 'dist/fonts' },
    // Site icons, at the root where browsers look for favicon.ico (the 16px source stays behind).
    { from: 'src/favicon/!(source-16).*', to: 'dist' },
    // Language packs, loaded on demand by language.
    { from: 'data/i18n/*.js', to: 'dist/i18n' },
  ],
  // After the copies above, so the offline copy lists what's really there.
  onSuccess: writeServiceWorker,
})
