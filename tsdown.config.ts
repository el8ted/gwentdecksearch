import { defineConfig } from 'tsdown'

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
})
