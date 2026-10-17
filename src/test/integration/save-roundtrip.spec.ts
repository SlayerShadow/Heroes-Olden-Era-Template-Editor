/**
 * Сценарий «Сохранить» + round-trip: НАСТОЯЩАЯ Chromium-ветка записи в папку
 * (File System Access API), но нативный showDirectoryPicker подменён реальным
 * OPFS-handle: боевой код
 * writeTextFile/writeBlobFile/createWritable выполняется по-настоящему, байты
 * остаются в приватном хранилище происхождения (тесты не пишут на диск).
 *
 * Только Chromium: в Firefox/WebKit supportsFsAccess() = false и сохранение
 * уходит в download-фолбэк, а headless-браузеры блокируют серийные
 * автоматические скачивания (проверено) — сценарий там не автоматизируется.
 *
 * Имя файлов = sanitizeFileName(template.name): пробелы сохраняются
 * («Sample Editor.rmg.json»).
 */
import { expect, test } from '@playwright/test'
import {
  installOpfsSaveShim,
  interp,
  loadSampleTemplate,
  loadTemplateFromText,
  opfsFiles,
  PNG_MAGIC,
  readOpfsText,
  ru,
  sampleFixture,
  storeState,
  waitForCanvas,
  watchConsoleErrors,
} from './helpers'

/** Имя OPFS-папки теста (у каждого браузерного контекста своё хранилище — изоляция). */
const OPFS_DIR = 'oe-e2e-save'

test.describe('Сохранение в папку и round-trip', () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(
      browserName !== 'chromium',
      'Ветка FS Access есть только в Chromium; download-фолбэк в headless блокируется браузером',
    )
    await page.goto('/')
    await expect(page.locator('.react-flow')).toBeVisible()
    await loadSampleTemplate(page)
    const fx = sampleFixture()
    await waitForCanvas(page, fx.zoneCount, fx.connCount)
    // Шим ставится ПОСЛЕ загрузки (на document_start navigator.storage ещё нет)
    await installOpfsSaveShim(page, OPFS_DIR)
  })

  test('«Сохранить»: пара .rmg.json + .editor.json + PNG, dirty сброшен, папка запомнена', async ({
    page,
  }) => {
    const consoleErrors = watchConsoleErrors(page)
    const fx = sampleFixture()
    const R = ru()
    const base = fx.template.name // sanitizeFileName пробелы сохраняет

    await page.getByRole('button', { name: R.app.save, exact: true }).click()

    // Запись асинхронна (рендер PNG 700×700) — только expect.poll, никаких sleep.
    // Одиночный waitForFunction с async-предикатом по OPFS ненадёжен (грабли рецепта).
    await expect
      .poll(async () => (await opfsFiles(page, OPFS_DIR)).map((f) => f.name).sort(), {
        timeout: 15_000,
        message: 'в OPFS-папке должны появиться ровно три файла сохранения',
      })
      .toEqual([`${base}.editor.json`, `${base}.png`, `${base}.rmg.json`])

    const files = await opfsFiles(page, OPFS_DIR)
    for (const f of files) {
      expect(f.size, `${f.name} пуст`).toBeGreaterThan(0)
    }
    const png = files.find((f) => f.name === `${base}.png`)
    expect(png, 'PNG-превью не найдено').toBeDefined()
    expect(png?.head).toEqual(PNG_MAGIC)

    // Состояние: dirty сброшен, папка привязана (повторное сохранение пойдёт без пикера)
    const state = await storeState(page)
    expect(state.dirty).toBe(false)
    expect(state.rootName).toBe(OPFS_DIR)
    expect(state.hasDirHandle).toBe(true)

    // UI: отметка «✓ время» в шапке + info-тост о сохранении в папку
    await expect(page.locator('.app__source--ok')).toContainText('✓')
    await expect(page.getByRole('status')).toHaveText(
      interp(R.app.alertSavedFolder, { folder: OPFS_DIR }),
    )

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })

  test('round-trip: сохранённый .rmg.json идентичен исходному, повторное открытие даёт ту же схему', async ({
    page,
  }) => {
    const fx = sampleFixture()
    const R = ru()
    const base = fx.template.name

    await page.getByRole('button', { name: R.app.save, exact: true }).click()
    await expect
      .poll(async () => (await opfsFiles(page, OPFS_DIR)).length, { timeout: 15_000 })
      .toBe(3)

    // «Сохранил → открыл снова → получил то же»: байты .rmg.json deep-equal исходной фикстуре
    const savedText = await readOpfsText(page, OPFS_DIR, `${base}.rmg.json`)
    const saved = JSON.parse(savedText) as unknown
    expect(saved).toEqual(fx.template)

    // Sidecar: позиции всех зон (формат buildSidecar — без version)
    const sideText = await readOpfsText(page, OPFS_DIR, `${base}.editor.json`)
    const side = JSON.parse(sideText) as {
      editor: string
      templateFile: string
      positions: Record<string, { x: number; y: number }>[]
    }
    expect(side.editor).toBe('oe-template-editor')
    expect(side.templateFile).toBe(`${base}.rmg.json`)
    // Порядок ключей = порядок вставки в store — не гарантирован, сравниваем множества
    expect(Object.keys(side.positions[0] ?? {}).sort()).toEqual([...fx.zoneNames].sort())

    // Повторное открытие сохранённых байтов боевым парсером → та же схема
    await loadTemplateFromText(page, savedText, `${base}.rmg.json`)
    await waitForCanvas(page, fx.zoneCount, fx.connCount)
    await expect(page.locator('.app__name')).toHaveText(base)
  })
})
