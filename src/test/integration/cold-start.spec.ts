/**
 * Сценарий «холодный старт»: редактор открывается пустым «Новым шаблоном»,
 * канва пуста, панель «Проблемы» сразу говорит правду (пустой вариант — ошибка).
 * Все строки — из ru-локали (helpers.ru()), числа — из кода приложения.
 * Браузеры: все три (ветка без FS Access не задействуется — только чтение DOM).
 */
import { expect, test } from '@playwright/test'
import { interp, ru, storeState, validateTruth, watchConsoleErrors } from './helpers'

test.describe('Холодный старт', () => {
  test('пустой «Новый шаблон»: шапка, пустая канва, truthful «Проблемы»', async ({ page }) => {
    const consoleErrors = watchConsoleErrors(page)
    const R = ru()

    await page.goto('/')

    // Каркас отрисовался
    await expect(page.locator('.react-flow')).toBeVisible()
    // index.html:7 — статический брендовый title; i18n и приложение его не меняют (проверено grep по document.title)
    await expect(page).toHaveTitle('Template Editor | Heroes Olden Era')
    // i18n детектит ru по языку браузера: конфиг пинит locale 'ru-RU' (ветки детекта — locale.spec.ts)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')

    // Шапка: пустой шаблон из makeEmptyTemplate (editorStore.ts)
    await expect(page.locator('.app__brand')).toHaveText(R.app.brand)
    await expect(page.locator('.app__name')).toHaveText(R.store.newTemplateName)
    await expect(page.locator('.app__badge').nth(0)).toHaveText(R.gameModeClassicLabel)
    await expect(page.locator('.app__badge').nth(1)).toHaveText('128×128') // дефолт makeEmptyTemplate: sizeX/sizeZ = 128
    // Бейджа источника в шапке больше нет: .app__source рисуется только после
    // сохранения («✓ время»); до того элемента нет вовсе (app.sourceDemo удалён из локали)
    await expect(page.locator('.app__source')).toHaveCount(0)
    await expect(page.locator('#variant-select')).toHaveText(
      interp(R.app.variantOption, { index: 1, zones: 0 }),
    )

    // Все действия шапки на месте
    for (const name of [R.app.new, R.app.openFile, R.app.openFolder, R.app.preview, R.app.save]) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('tab', { name: R.app.footerTabIssues })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    // Канва пуста
    await expect(page.locator('.react-flow__node')).toHaveCount(0)
    await expect(page.locator('.react-flow__edge')).toHaveCount(0)

    // Панель «Проблемы»: чипы = ground truth валидатора, пустой вариант — ошибка
    const truth = await validateTruth(page)
    expect(truth.errors).toBeGreaterThan(0)
    await expect(page.locator('.validator__chip--error')).toHaveText(String(truth.errors))
    await expect(page.locator('.validator__chip--warning')).toHaveText(String(truth.warnings))
    await expect(page.locator('.validator__chip--info')).toHaveText(String(truth.infos))

    // Раскрыть замечания: «Нет ни одной зоны» + всего строк = errors+warnings+infos
    await page.locator('.validator__details summary').click()
    await expect(page.locator('.validator__body')).toContainText(R.issue('noZones'))
    await expect(page.locator('.validator__body .issue')).toHaveCount(
      truth.errors + truth.warnings + truth.infos,
    )

    // Store: чистое состояние, ничего не грязное
    const state = await storeState(page)
    expect(state.dirty).toBe(false)
    expect(state.pastCount).toBe(0)
    expect(state.templateName).toBe(R.store.newTemplateName)

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})
