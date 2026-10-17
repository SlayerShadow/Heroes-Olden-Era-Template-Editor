/**
 * Сценарий «Открыть файл» (фолбэк-ветка без File System Access API — работает
 * во всех трёх браузерах: в Chromium пикеры удаляем, в Firefox/WebKit их нет).
 * Покрывает: открытие пары .rmg.json + .editor.json (зоны/связи/позиции sidecar,
 * шапка) и негативный путь — файл не-шаблон → тост с ошибкой, состояние не тронуто.
 * Числа берутся из фикстуры (sampleFixture), строки — из ru-локали (ru()).
 */
import { expect, test } from '@playwright/test'
import {
  interp,
  openViaFileFallback,
  removeFsPickers,
  ru,
  SAMPLE_SOURCE_NAME,
  sampleFixture,
  storeState,
  waitForCanvas,
  watchConsoleErrors,
} from './helpers'

test.describe('Открытие шаблона файлом (фолбэк)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.react-flow')).toBeVisible()
    await removeFsPickers(page)
  })

  test('пара .rmg.json + .editor.json: зоны и связи на канве, позиции из sidecar', async ({
    page,
  }) => {
    const consoleErrors = watchConsoleErrors(page)
    const fx = sampleFixture()
    const R = ru()

    await openViaFileFallback(page, [fx.templatePath, fx.sidecarPath])
    await waitForCanvas(page, fx.zoneCount, fx.connCount)

    // Шапка отражает загруженный шаблон
    await expect(page.locator('.app__name')).toHaveText(fx.template.name)
    await expect(page.locator('.app__badge').nth(0)).toHaveText(R.gameModeClassicLabel)
    await expect(page.locator('.app__badge').nth(1)).toHaveText(
      `${fx.template.sizeX}×${fx.template.sizeZ}`,
    )
    // Источник файла шапка больше не показывает (бейдж .app__source — только после
    // сохранения): имя источника живёт в store и проверяется ниже через storeState
    await expect(page.locator('#variant-select')).toHaveText(
      interp(R.app.variantOption, { index: 1, zones: fx.zoneCount }),
    )

    // Имена узлов канвы — как зоны фикстуры (порядок = порядок zones[])
    await expect(page.locator('.zone-node__name')).toHaveText(fx.zoneNames)

    // Sidecar применён: у каждой зоны есть сохранённая позиция
    const state = await storeState(page)
    expect(state.positionCount).toBe(fx.zoneCount)
    expect(state.dirty).toBe(false)
    expect(state.pastCount).toBe(0) // loadTemplate не пишет undo-снапшот
    expect(state.sourceName).toBe(SAMPLE_SOURCE_NAME) // имя источника — из store, не из шапки

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })

  test('файл не-шаблон: тост с ошибкой, редактор остаётся нетронутым', async ({ page }) => {
    const fx = sampleFixture()
    const R = ru()

    await openViaFileFallback(page, [fx.brokenPath])

    // parseTemplate бросает fs.notTemplate → error-тост (role=alert) с переводом из локали
    await expect(page.getByRole('alert')).toHaveText(R.fs.notTemplate)
    await expect(page.locator('.react-flow__node')).toHaveCount(0)
    await expect(page.locator('.app__name')).toHaveText(R.store.newTemplateName)
  })
})
