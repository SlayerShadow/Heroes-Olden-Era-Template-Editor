import { defineConfig } from 'vitest/config'

// Два проекта (бывш. workspace):
// - unit — чистые функции и store, окружение node (как раньше; поддерживает
//   `node scripts/check_root_validate.mjs` с его требованием erasableSyntaxOnly);
// - ui — компонентные тесты (testing-library), окружение jsdom.
// Разделение по расширению: `*.test.ts` — node, `*.test.tsx` — jsdom.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['src/test/setup.ts'],
        },
      },
    ],
  },
})
