/**
 * Ядро редактирования: изменил → канва/инспектор показали правду → панель
 * «Проблемы» не врёт → undo/redo работает → несохранённые изменения защищены
 * модалкой. Состояние готовится загрузкой демо-пары через боевой loadTemplate
 * (главный мир page.evaluate — тот же инстанс store, см. helpers.ts).
 * Браузеры: все три. Строки — из ru-локали, числа — из фикстуры.
 */
import { expect, test } from '@playwright/test'
import {
  interp,
  loadSampleTemplate,
  ru,
  sampleFixture,
  storeState,
  validateTruth,
  waitForCanvas,
  watchConsoleErrors,
  zoneNode,
} from './helpers'

test.describe('Редактирование, валидатор, undo/redo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.react-flow')).toBeVisible()
    await loadSampleTemplate(page)
    const fx = sampleFixture()
    await waitForCanvas(page, fx.zoneCount, fx.connCount)
  })

  test('переименование зоны в инспекторе: канва, dirty, undo/redo', async ({ page }) => {
    const fx = sampleFixture()
    const R = ru()

    // Выбор зоны кликом по узлу канвы → инспектор
    await zoneNode(page, 'Center').click()
    await expect(page.locator('.inspector__kind')).toHaveText(R.inspector.kindZone)
    await expect(page.locator('.inspector__title')).toHaveText('Center')

    // Переименование через поле «Имя зоны» (Enter = blur = commit)
    const nameInput = page.getByLabel(R.zoneLabels.nameLabel)
    await nameInput.fill('Center-Renamed')
    await nameInput.press('Enter')

    await expect(zoneNode(page, 'Center-Renamed')).toBeVisible()
    await expect(zoneNode(page, 'Center')).toHaveCount(0)
    await expect(page.locator('.inspector__title')).toHaveText('Center-Renamed')
    // Связи не потерялись (renameZone каскадный)
    await expect(page.locator('.react-flow__edge')).toHaveCount(fx.connCount)

    // dirty + история (white-box: эти флаги гейтят модалку и кнопки undo/redo)
    let state = await storeState(page)
    expect(state.dirty).toBe(true)
    expect(state.pastCount).toBe(1)
    expect(state.zoneNames).toEqual(
      fx.zoneNames.map((n) => (n === 'Center' ? 'Center-Renamed' : n)),
    )

    // Undo хоткеем → прежнее имя
    await page.keyboard.press('Control+z')
    await expect(zoneNode(page, 'Center')).toBeVisible()
    await expect(zoneNode(page, 'Center-Renamed')).toHaveCount(0)

    // Redo хоткеем → снова переименовано
    await page.keyboard.press('Control+Shift+z')
    await expect(zoneNode(page, 'Center-Renamed')).toBeVisible()
    state = await storeState(page)
    expect(state.futureCount).toBe(0)
    expect(state.dirty).toBe(true)
  })

  test('панель «Проблемы»: счётчики = валидатору, ошибка по клику ведёт к зоне', async ({
    page,
  }) => {
    const consoleErrors = watchConsoleErrors(page)
    const R = ru()

    // Демо-пара: чипы панели равны ground truth (validateTemplate + каталог пулов)
    const before = await validateTruth(page)
    expect(before.errors).toBe(0) // инвариант демо-фикстуры: ошибок нет
    await expect(page.locator('.validator__chip--error')).toHaveText(String(before.errors))
    await expect(page.locator('.validator__chip--warning')).toHaveText(String(before.warnings))
    await expect(page.locator('.validator__chip--info')).toHaveText(String(before.infos))

    // Ломаем размер зоны через инспектор (size ≤ 0 → error zoneSizePositive)
    await zoneNode(page, 'Center').click()
    const sizeInput = page.getByLabel(R.zoneLabels.sizeLabel)
    await sizeInput.fill('0')
    await sizeInput.press('Enter')

    const after = await validateTruth(page)
    expect(after.errors).toBe(before.errors + 1)
    await expect(page.locator('.validator__chip--error')).toHaveText(String(after.errors))

    // Раскрыть замечания: первая строка — наша ошибка (сортировка errors-first)
    await page.locator('.validator__details summary').click()
    const firstIssue = page.locator('.validator__body .issue').first()
    await expect(firstIssue.locator('.issue__scope')).toHaveText(
      interp(R.scope.zone, { variant: 1, zone: 'Center' }),
    )
    await expect(firstIssue.locator('.issue__msg')).toHaveText(R.issue('zoneSizePositive'))

    // Клик по замечанию навигирует: выбираем другую зону, затем возвращаемся кликом по issue
    await zoneNode(page, 'Treasure-1').click()
    await expect(page.locator('.inspector__title')).toHaveText('Treasure-1')
    await firstIssue.click()
    await expect(page.locator('.inspector__title')).toHaveText('Center')

    // Undo → панель снова чиста по ошибкам
    await page.keyboard.press('Control+z')
    await expect(page.locator('.validator__chip--error')).toHaveText(String(before.errors))

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })

  test('«Новый» при несохранённых изменениях: модалка, «Отмена» сохраняет, «Продолжить» сбрасывает', async ({
    page,
  }) => {
    const R = ru()

    // Делаем dirty переименованием
    await zoneNode(page, 'Center').click()
    const nameInput = page.getByLabel(R.zoneLabels.nameLabel)
    await nameInput.fill('Center-Dirty')
    await nameInput.press('Enter')
    await expect(zoneNode(page, 'Center-Dirty')).toBeVisible()

    const dialog = page.getByRole('dialog', { name: R.confirm.discardTitle })

    // «Новый» → модалка подтверждения
    await page.getByRole('button', { name: R.app.new, exact: true }).click()
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(R.confirm.discardMessage)

    // «Отмена» → работа на месте
    await dialog.getByRole('button', { name: R.confirm.cancel }).click()
    await expect(dialog).toBeHidden()
    await expect(zoneNode(page, 'Center-Dirty')).toBeVisible()

    // «Продолжить» → чистый «Новый шаблон»
    await page.getByRole('button', { name: R.app.new, exact: true }).click()
    await dialog.getByRole('button', { name: R.confirm.discardConfirm }).click()
    await expect(dialog).toBeHidden()
    await expect(page.locator('.react-flow__node')).toHaveCount(0)
    await expect(page.locator('.app__name')).toHaveText(R.store.newTemplateName)
    const state = await storeState(page)
    expect(state.dirty).toBe(false)
  })
})
