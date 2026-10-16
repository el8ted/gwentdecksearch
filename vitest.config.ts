import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    // e2e/ holds Playwright specs (pnpm test:e2e); vitest would also pick up *.spec.ts.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/filter.ts',
        'src/hash.ts',
        'src/display.ts',
        'src/i18n.ts',
        'src/config.ts',
        'src/ui/dom.ts',
        'scripts/lib/*.ts',
      ],
      exclude: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
      thresholds: { perFile: true, statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
})
