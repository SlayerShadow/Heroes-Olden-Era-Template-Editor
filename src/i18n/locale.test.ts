import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Детекция и сохранение локали (src/i18n/index.ts).
 *
 * Модуль инициализирует i18next при импорте, поэтому каждый тест импортирует
 * его заново (vi.resetModules) с подставленными localStorage/navigator —
 * паттерн editorStore.restore.test.ts. Окружение node: DOM-ветки
 * (applyDocumentLang) защищены typeof document и не исполняются.
 *
 * Правила продукта:
 * - первый визит: сохранённой локали нет → язык браузера (ru/en) → фолбэк en;
 * - детект НЕ пишет в localStorage — выбор запоминается только при явном
 *   действии пользователя (setLocale из селектора);
 * - сохранённая локаль побеждает язык браузера.
 */

/** Дублирует LOCALE_LS_KEY: импорт константы инициализировал бы i18n до подстановок. */
const LOCALE_KEY = 'oe-editor.locale'

interface StubOpts {
  /** Значение сохранённой локали в localStorage (null — нет). */
  stored?: string | null
  /** navigator.languages браузера. */
  languages?: string[]
}

/** Подставить localStorage/navigator и импортировать i18n-модуль с чистого листа. */
async function freshI18n({ stored = null, languages = [] }: StubOpts = {}) {
  const ls = new Map<string, string>()
  if (stored !== null) ls.set(LOCALE_KEY, stored)
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => ls.get(key) ?? null,
    setItem: (key: string, value: string) => void ls.set(key, value),
  })
  vi.stubGlobal('navigator', { languages, language: languages[0] ?? '' })
  vi.resetModules()
  const mod = await import('./index')
  return { mod, storedNow: () => ls.get(LOCALE_KEY) ?? null }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('detectLocale: выбор локали по умолчанию', () => {
  it('первый визит, браузер русский — ru, localStorage не тронут', async () => {
    const { mod, storedNow } = await freshI18n({ languages: ['ru-RU', 'en-US'] })
    expect(mod.detectLocale()).toBe('ru')
    expect(mod.default.language).toBe('ru')
    // Выбор не сохраняется, пока пользователь сам не тронул селектор
    expect(storedNow()).toBeNull()
  })

  it('первый визит, браузер английский (en-US) — en', async () => {
    const { mod } = await freshI18n({ languages: ['en-US', 'en'] })
    expect(mod.detectLocale()).toBe('en')
    expect(mod.default.language).toBe('en')
  })

  it('первый визит, браузер прочий (fr/de) — фолбэк en', async () => {
    const { mod } = await freshI18n({ languages: ['fr-FR', 'de-DE'] })
    expect(mod.detectLocale()).toBe('en')
    expect(mod.default.language).toBe('en')
  })

  it('список браузера пуст — фолбэк en', async () => {
    const { mod } = await freshI18n({ languages: [] })
    expect(mod.detectLocale()).toBe('en')
  })

  it('первым поддерживаемым языком считается первый в списке браузера', async () => {
    const ruFirst = await freshI18n({ languages: ['ru-RU', 'en-US'] })
    expect(ruFirst.mod.detectLocale()).toBe('ru')
    vi.unstubAllGlobals()
    vi.resetModules()
    const enFirst = await freshI18n({ languages: ['en-GB', 'ru-RU'] })
    expect(enFirst.mod.detectLocale()).toBe('en')
  })

  it('сохранённая локаль побеждает язык браузера', async () => {
    const { mod } = await freshI18n({ stored: 'ru', languages: ['en-US'] })
    expect(mod.detectLocale()).toBe('ru')
    expect(mod.default.language).toBe('ru')
  })

  it('несохранённый неподдерживаемый код (de) игнорируется — берётся язык браузера', async () => {
    const { mod } = await freshI18n({ stored: 'de', languages: ['ru-RU'] })
    expect(mod.detectLocale()).toBe('ru')
  })
})

describe('setLocale: сохранение выбора при смене пользователем', () => {
  it('пишет локаль в localStorage и переключает язык i18next без перезагрузки', async () => {
    const { mod, storedNow } = await freshI18n({ languages: ['ru-RU'] })
    expect(mod.default.language).toBe('ru')
    expect(storedNow()).toBeNull()
    mod.setLocale('en')
    expect(storedNow()).toBe('en')
    // changeLanguage асинхронен — дожидаемся фактической смены языка
    await vi.waitFor(() => expect(mod.default.language).toBe('en'))
  })

  it('обратное переключение на ru тоже сохраняется', async () => {
    const { mod, storedNow } = await freshI18n({ languages: ['en-US'] })
    mod.setLocale('ru')
    expect(storedNow()).toBe('ru')
    await vi.waitFor(() => expect(mod.default.language).toBe('ru'))
  })
})
