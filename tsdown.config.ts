import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { app: 'src/main.ts' },
  platform: 'browser',
  // IIFE (not ESM) so dist/index.html works from file://, where module scripts are blocked.
  format: 'iife',
  dts: false,
  minify: true,
  copy: [
    'src/index.html',
    'src/styles.css',
    // The release zip is a copy of the software: the license terms and notice must travel with it.
    'LICENSE',
    'NOTICE.md',
    { from: 'src/icons/*', to: 'dist/icons' },
    // Language packs, loaded on demand by language.
    { from: 'data/i18n/*.js', to: 'dist/i18n' },
  ],
})
