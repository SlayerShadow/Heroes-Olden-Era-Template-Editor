/**
 * Сценарий «язык интерфейса»: детект локали при холодном старте и явное
 * переключение в селекторе шапки (LocaleSelect).
 *
 * Поведение приложения (src/i18n/index.ts): сохранённая в localStorage
 * `oe-editor.locale` → первый поддерживаемый базовый тег navigator.languages
 * (ru/en) → фолбэк en. Детект НЕ пишет в localStorage — запись только при
 * явном выборе (setLocale); переключение живое, без перезагрузки
 * (react-i18next languageChanged).
 *
 * Связка с конфигом: playwright.config.ts пинит locale 'ru-RU' (иначе браузеры
 * Playwright с дефолтным en-US стартовали бы на английском и все ru-спеки
 * упали); ветки детекта проверяются здесь через test.use({ locale }) —
 * переопределение пина на тест, контекст остаётся fixture'ным.
 *
 * Строки — из файлов обеих локалей (LFor, конвенция helpers.ts). Опции
 * селектора — самоназвания языков ('Русский'/'English', SUPPORTED_LOCALES),
 * они не переводятся — это единственные «литералы» спека.
 *
 * Браузеры: все три (обычный <select> + i18next, FS Access не задействован).
 */
import { expect, test, type Page } from '@playwright/test'
import { LFor, LOCALE_LS_KEY, watchConsoleErrors } from './helpers'

/** Значение ключа локали в localStorage страницы (null — не записан). */
function storedLocale(page: Page): Promise<string | null> {
  return page.evaluate((key: string) => localStorage.getItem(key), LOCALE_LS_KEY)
}

test.describe('Явное переключение локали (браузер ru-RU)', () => {
  test('ru → en: UI без перезагрузки, выбор записан и переживает reload', async ({ page }) => {
    const consoleErrors = watchConsoleErrors(page)
    await page.goto('/')

    // Старт на ru — детект по языку браузера (пин 'ru-RU' в конфиге)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    await expect(page.locator('.app__brand')).toHaveText(LFor('ru', 'app.brand'))
    // Первый визит не пишет localStorage: детект намеренно ничего не сохраняет
    expect(await storedLocale(page)).toBeNull()

    // Действие пользователя: выбрать English в селекторе шапки (aria-label — ru)
    await page.getByLabel(LFor('ru', 'locale.selectLabel'), { exact: true }).selectOption('en')

    // Живое переключение: <html lang>, шапка, кнопка и вкладка футера — en-строки
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('.app__brand')).toHaveText(LFor('en', 'app.brand'))
    await expect(
      page.getByRole('button', { name: LFor('en', 'app.save'), exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('tab', { name: LFor('en', 'app.footerTabIssues') })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    // ru-интерфейс ушёл целиком (не частично): русской «Сохранить» больше нет
    await expect(
      page.getByRole('button', { name: LFor('ru', 'app.save'), exact: true }),
    ).toHaveCount(0)
    // Селектор перерисован вместе с остальным UI и держит новое значение
    await expect(page.getByLabel(LFor('en', 'locale.selectLabel'), { exact: true })).toHaveValue('en')

    // Явный выбор записан в localStorage (setLocale → storeLocale)
    expect(await storedLocale(page)).toBe('en')

    // Сохранённая локаль побеждает язык браузера: после reload остаётся en
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('.app__brand')).toHaveText(LFor('en', 'app.brand'))
    await expect(page.getByLabel(LFor('en', 'locale.selectLabel'), { exact: true })).toHaveValue('en')

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})

test.describe('Детект локали по языку браузера', () => {
  test.use({ locale: 'en-US' })

  test('браузер en-US: старт на английском, localStorage не записан', async ({ page }) => {
    const consoleErrors = watchConsoleErrors(page)
    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('.app__brand')).toHaveText(LFor('en', 'app.brand'))
    await expect(page.locator('.app__name')).toHaveText(LFor('en', 'store.newTemplateName'))
    await expect(
      page.getByRole('button', { name: LFor('en', 'app.openFile'), exact: true }),
    ).toBeVisible()
    // Детект не пишет выбор — только явное действие пользователя
    expect(await storedLocale(page)).toBeNull()

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})

test.describe('Детект локали: фолбэк', () => {
  test.use({ locale: 'de-DE' })

  test('язык браузера вне ru/en (de-DE): фолбэк en', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('.app__brand')).toHaveText(LFor('en', 'app.brand'))
    expect(await storedLocale(page)).toBeNull()
  })
})
