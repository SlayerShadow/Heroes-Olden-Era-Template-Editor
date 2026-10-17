/**
 * Сценарий «работа не теряется»: автосохранение снапшота сессии в localStorage
 * (ключ SESSION_KEY, дебаунс 250 мс — ждём expect.poll, не sleep) и бесшовное
 * восстановление после перезагрузки страницы + info-тост с моментом записи.
 * Браузеры: все три (ветка не зависит от File System Access API).
 */
import { expect, test } from '@playwright/test'
import {
  loadSampleTemplate,
  ru,
  SAMPLE_SOURCE_NAME,
  sampleFixture,
  sessionSnapshotRaw,
  storeState,
  waitForCanvas,
  zoneNode,
} from './helpers'

test.describe('Снапшот сессии', () => {
  test('правка переживает перезагрузку: автосейв → reload → восстановление + тост', async ({
    page,
  }) => {
    const fx = sampleFixture()
    const R = ru()

    await page.goto('/')
    await expect(page.locator('.react-flow')).toBeVisible()
    await loadSampleTemplate(page)
    await waitForCanvas(page, fx.zoneCount, fx.connCount)

    // Правка: переименование зоны (commit → dirty → запланирован снапшот)
    await zoneNode(page, 'Center').click()
    const nameInput = page.getByLabel(R.zoneLabels.nameLabel)
    await nameInput.fill('Center-Session')
    await nameInput.press('Enter')
    await expect(zoneNode(page, 'Center-Session')).toBeVisible()

    // Снапшот пишется с дебаунсом — ждём факта записи poll'ом (детерминированно)
    await expect
      .poll(async () => (await sessionSnapshotRaw(page))?.includes('Center-Session') ?? false, {
        timeout: 10_000,
        message: 'снапшот сессии должен записаться в localStorage после правки',
      })
      .toBe(true)

    await page.reload()

    // Восстановление: info-тост (общая часть обеих форм «…(на момент HH:MM).» / «…»)
    const restoredPrefix = R.store.sessionRestoredAt.split('(')[0].trim()
    await expect(page.getByRole('status')).toContainText(restoredPrefix)

    // Состояние то же: шаблон, источник (в store: снапшот сохраняет sourceName),
    // схема, переименованная зона. Бейдж источника из шапки удалён приложением.
    await expect(page.locator('.app__name')).toHaveText(fx.template.name)
    expect((await storeState(page)).sourceName).toBe(SAMPLE_SOURCE_NAME)
    await waitForCanvas(page, fx.zoneCount, fx.connCount)
    await expect(zoneNode(page, 'Center-Session')).toBeVisible()
    await expect(zoneNode(page, 'Center')).toHaveCount(0)
  })
})
