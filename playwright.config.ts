import { defineConfig, devices } from '@playwright/test'

/**
 * Конфигурация E2E.
 *
 * - Тесты идут против локального Vite dev-сервера: подготовка состояния в тестах
 *   использует модули приложения по URL dev-сервера (page.evaluate, главный мир),
 *   чего прод-сборка не отдаёт. webServer поднимает dev-сервер сам (CI) или
 *   переиспользует уже запущенный (локально, reuseExistingServer).
 * - html-репортёр с open: 'never' — прогон из shell не блокируется; отчёт
 *   смотреть через `npm run test:e2e:report`.
 * - Артефакты падений (trace/скриншот/видео) — в gitignored test-results/.
 */
export default defineConfig({
  testDir: './src/test/integration',
  /* Тесты в файлах независимы и параллельны (состояние каждого готовиться явно). */
  fullyParallel: true,
  /* Случайный test.only не должен доезжать до CI. */
  forbidOnly: !!process.env.CI,
  /* В CI — ретраи против инфры; локально флаки чиним, а не ретраим. */
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  /* Dev-сервер холодный трансформирует ~1 МБ poolCatalog при первом импорте — запас. */
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: [['line'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    /* ПИН ЛОКАЛИ. Детект локали приложения (src/i18n/index.ts): сохранённая
     * `oe-editor.locale` → первый поддерживаемый базовый тег navigator.languages
     * (ru/en) → фолбэк en. Контексты Playwright по умолчанию en-US → без пина UI
     * стартовал бы на английском и все спеки с ru-строками падали (воспроизведено
     * 04.10.2026: <html lang="en">). ru-RU = браузер русскоязычного пользователя;
     * десктоп-дескрипторы устройств locale не содержат (проверено на 1.63.0) —
     * значение применяется ко всем трём проектам. Ветки детекта (язык браузера,
     * фолбэк, сохранённая локаль) проверяет locale.spec.ts через test.use({ locale }). */
    locale: 'ru-RU',
    /* Trace на ретрае, скриншот/видео при падении — диагностика без ручных прогонов. */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  /* Локально переиспользуем уже поднятый dev-сервер; в CI поднимаем свой. */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
