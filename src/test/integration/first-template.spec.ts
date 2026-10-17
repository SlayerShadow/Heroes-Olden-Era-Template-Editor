/**
 * Практикум «Мой первый шаблон» (docs/manual/ru/19-first-template.md) как E2E:
 * шаблон «Первая дуэль» собирается с нуля СТРОГО по шагам мануала (только UI:
 * канва, инспектор, дерево, каталог пулов, JSON-блок), сохраняется штатным
 * «Сохранить» (Chromium-ветка FS Access через OPFS-шим), и итоговый
 * `.rmg.json` сравнивается с
 * эталоном `export/One To One.rmg.json` глубоким диффом (jsonDiff.ts).
 *
 * Назначение теста — ответить на вопрос «повторяет ли алгоритм мануала эталон,
 * а если нет — что и в какой момент пошло не так»:
 * - каждый шаг обёрнут в test.step с именем раздела мануала (видно в отчёте/trace);
 * - расхождения с эталоном НЕ маскируются: полный дифф с классификацией
 *   (значение/порядок/лишнее/потеря) и примечаниями «какой шаг мануала задал
 *   значение» уходит в ассерт-сообщение и в аттачменты HTML-отчёта
 *   (diff-with-etalon.txt, produced-template.rmg.json).
 *
 * Семантика сравнения (решение пользователя от 04.10.2026): порядок элементов в
 * variants[].zones / variants[].connections НЕ сравнивается (в игре не важен);
 * количество элементов и наполнение каждого — строгое сопоставление по имени
 * зоны / каноническому id связи; всё остальное — строгое равенство.
 * `$.name` сравнивается с TEMPLATE_NAME отдельным ассертом, а в deepDiff эталон
 * нормализован к TEMPLATE_NAME: закоммиченный эталон сохранён под именем
 * «One To One» (английское имя того же шаблона — содержимое идентично).
 *
 * Условия запуска:
 * - только Chromium: сохранение байт идёт через OPFS-шим showDirectoryPicker
 *   (в Firefox/WebKit supportsFsAccess()=false — download-фолбэк в headless
 *   блокируется браузером, байты не прочитать);
 * - эталон `export/One To One.rmg.json` закоммичен в git (.gitignore: `export/*`
 *   + ре-включение эталона) — тест выполняется и локально, и в CI. Скипа по
 *   existsSync намеренно нет: раз эталон в репозитории, его отсутствие — ЧП,
 *   которое должно падать (readFileSync бросит ENOENT), а не молча скипаться.
 *
 * Осознанные отклонения от буквального текста мануала (структуру результата НЕ меняют):
 * - «Дублировать связь» для запасных проходов вызывается ПКМ по строке дерева,
 *   а не по линии канвы: мануал документирует оба способа как равносильные
 *   (§«Связь второго игрока дублированием»), а на канве свеже-созданные узлы
 *   при авто-зуме 2.5 перекрывают линии — ПКМ по ребру нестабилен (проверено
 *   разведкой: Playwright hit-target попадает в чужой узел);
 * - перенос настроек через JSON-блок читает текст блока inputValue'ом и пишет
 *   исправленный fill'ом (вместо буфера обмена): результат идентичен, детерминирован.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import {
  installOpfsSaveShim,
  interp,
  L,
  opfsFiles,
  readOpfsText,
  watchConsoleErrors,
  zoneNode,
} from './helpers'
import { deepDiff, formatDiff } from './jsonDiff'
import {
  addGroupRef,
  addPoolsViaCatalog,
  addZoneOnCanvas,
  blockByLabel,
  card,
  chipOn,
  comboFill,
  dragConnection,
  duplicateConnectionViaTree,
  duplicateViaInspectorHeader,
  editorPane,
  ensureCanvas,
  ensureNodesVisible,
  fillField,
  fillNumList,
  fld,
  groupCardAt,
  jsonTextarea,
  openCard,
  openJsonBlock,
  openSection,
  pbField,
  renameGroup,
  rootPane,
  selectField,
  selectInTree,
  setInspectorTab,
  treeRow,
} from './ui'

/* ------------------------------------------------------------------ */
/* Данные сценария (значения из мануала — это вход сценария, не UI-строки) */
/* ------------------------------------------------------------------ */

const TEMPLATE_NAME = 'Первая дуэль'
/** Все три зоны практикума — для канвас-ожиданий (ensureCanvas). */
const ALL_ZONES: string[] = ['Spawn-1', 'Spawn-2', 'Center']
const OPFS_DIR = 'oe-e2e-first-template'
const ETALON_PATH = fileURLToPath(new URL('../../../export/One To One.rmg.json', import.meta.url))

/** Пулы контента (19-first-template §«Наполнение зоны», §«Наполнение центральной зоны»). */
const POOLS_SPAWN_GUARDED = [
  'classic_template_pool_random_t2_item',
  'classic_template_pool_random_t2_hire',
  'classic_template_pool_random_t2_unit_bank',
]
const POOLS_SPAWN_UNGUARDED = ['classic_template_pool_random_unguarded_t2_base']
const POOLS_SPAWN_RESOURCES = ['content_pool_general_resources_start_zone_medium']
const POOLS_CENTER_GUARDED = [
  'classic_template_pool_random_t4_item',
  'classic_template_pool_random_t5_item',
]
const POOLS_CENTER_UNGUARDED = ['classic_template_pool_random_unguarded_t4_base']
const POOLS_CENTER_RESOURCES = ['content_pool_general_resources_treasure_zone_rich']

/** Префикс заголовка секции со счётчиком: «Главные объекты ({{n}})» → «Главные объекты». */
function secPrefix(key: string): string {
  return L(key, { n: '' }).replace(/\([^)]*\)\s*$/, '').trim()
}

/* ------------------------------------------------------------------ */
/* Примечания к диффу: путь → какой шаг мануала задал значение          */
/* ------------------------------------------------------------------ */

const MANUAL_ANNOTATIONS: ReadonlyArray<{ re: RegExp; note: string }> = [
  {
    re: /^gameRules\.heroCountMax$/,
    note: 'задано по мануалу: 01-quick-start §«Правила игры» шаг 2 — «Максимальное количество героев» = 3 (глава 19 §«Лэйаут зон и правила игры» отсылает к quick-start, «значения не повторяются»)',
  },
  {
    re: /^gameRules\.tournamentRules$/,
    note: 'мануал поле не заполняет: в «шести записях» 01-quick-start §«Правила игры» «Турнирные правила» нет',
  },
  {
    re: /^variants\[0\]\.connections\[Spawn-[12]-Center-1\]\.guardWeeklyIncrement$/,
    note: 'задано по мануалу: 19-first-template §«Запасные проходы» шаг 2 — «Еженедельный прирост стражи» = 0.1 (у главных проходов 0.15; копия-запасная несёт перенесённый JSON)',
  },
  {
    re: /^variants\[0\]\.connections\[Spawn-1-Center\]\.name$/,
    note: 'мануал: 19-first-template §«Создание связи и стража прохода» — «Авто-имя оставьте как есть» (поле «Имя связи» пустое); редактор не пишет ключ name в .rmg.json для авто-имени',
  },
]

function annotateManualStep(path: string): string | undefined {
  for (const a of MANUAL_ANNOTATIONS) if (a.re.test(path)) return a.note
  return undefined
}

/* ------------------------------------------------------------------ */
/* Сценарий                                                            */
/* ------------------------------------------------------------------ */

test.describe('Практикум «Мой первый шаблон» (19-first-template.md)', () => {
  test('сборка «Первой дуэли» по шагам мануала повторяет эталон export/One To One.rmg.json', async (
    { page, browserName },
    testInfo,
  ) => {
    test.skip(
      browserName !== 'chromium',
      'Сохранение байт для сверки идёт через OPFS-шим showDirectoryPicker — только Chromium ' +
        '(в Firefox/WebKit сохранение уходит в download-фолбэк, серийные скачивания в headless блокируются)',
    )
    // Практикум длинный (~120 UI-операций + ленивый каталог пулов ~1 МБ + рендер PNG).
    test.setTimeout(300_000)

    const consoleErrors = watchConsoleErrors(page)
    const ed = editorPane(page)

    await test.step('Заготовка: «Новый», название «Первая дуэль»', async () => {
      await page.goto('/')
      await expect(page.locator('.react-flow')).toBeVisible()
      // Шим папки — ПОСЛЕ загрузки страницы (на document_start navigator.storage ещё нет)
      await installOpfsSaveShim(page, OPFS_DIR)

      // §«Заготовка шаблона» шаг 1: «Новый». Контекст свежий (dirty=false) —
      // модалки «Несохранённые изменения» быть не должно.
      await page.getByRole('button', { name: L('app.new'), exact: true }).click()
      await expect(
        page.getByRole('dialog', { name: L('confirm.discardTitle') }),
      ).toBeHidden()
      await expect(page.locator('.react-flow__node')).toHaveCount(0)

      // Шаги 3–4: вкладка «Шаблон», секция «Основное», название + Enter
      await setInspectorTab(page, L('inspector.tabRoot'))
      const basics = await openSection(page, ed, L('root.sectionBasics'))
      await fillField(basics, L('root.nameLabel'), TEMPLATE_NAME)
      await expect(page.locator('.app__name')).toHaveText(TEMPLATE_NAME)
      await expect(page.locator('.tree-row--root .tree-row__name')).toHaveText(TEMPLATE_NAME)
    })

    await test.step('Зона Spawn-1: создание, точка появления, наполнение', async () => {
      // §«Создание и точка появления героя»
      await setInspectorTab(page, L('inspector.tabInspector'))
      await addZoneOnCanvas(page)
      await expect(page.locator('.react-flow__node')).toHaveCount(1)
      await expect(page.locator('.inspector__title')).toHaveText('Zone-1')

      const layoutSec = await openSection(page, ed, L('zone.sectionLayout'))
      await fillField(layoutSec, L('zone.nameLabel'), 'Spawn-1')
      await expect(page.locator('.inspector__title')).toHaveText('Spawn-1')
      await expect(zoneNode(page, 'Spawn-1')).toBeVisible()

      // Шаг 4–6:Spawn-объект; плеер и размещение — дефолты заготовки
      const moSec = await openSection(page, ed, secPrefix('zone.sectionMainObjects'))
      await moSec.locator('.mo-add select').selectOption('Spawn')
      await moSec.getByRole('button', { name: L('zone.addObject'), exact: true }).click()
      await expect(moSec.locator('summary').first()).toHaveText(
        L('zone.sectionMainObjects', { n: 1 }),
      )
      const spawnCard = card(page, moSec, 'Spawn')
      await expect(spawnCard).toHaveCount(1)
      await openCard(spawnCard)
      await expect(fld(spawnCard, L('zone.spawnLabel'))).toHaveValue('Player1')
      await expect(fld(spawnCard, L('zone.placementLabel'))).toHaveValue('Center')

      // §«Наполнение зоны» шаг 1: бюджеты «на площадь» 16000 / 2600 / 500
      const budgets = await openSection(page, ed, L('zone.sectionBudgets'))
      await fillField(budgets, L('zone.guardedBudgetAreaLabel'), '16000')
      await fillField(budgets, L('zone.unguardedBudgetAreaLabel'), '2600')
      await fillField(budgets, L('zone.resourcesBudgetAreaLabel'), '500')
      await expect(zoneNode(page, 'Spawn-1').locator('.zone-node__budget')).toHaveText('19.1k')

      // Шаги 2–5: пулы через «Каталог» (поиск + «+» на строке + «Закрыть»)
      const pools = await openSection(page, ed, L('zone.sectionPools'))
      await addPoolsViaCatalog(
        page,
        pbField(page, pools, L('zone.poolGuardedLabel')),
        'random_t2',
        POOLS_SPAWN_GUARDED,
        3,
      )
      await addPoolsViaCatalog(
        page,
        pbField(page, pools, L('zone.poolUnguardedLabel')),
        'unguarded_t2',
        POOLS_SPAWN_UNGUARDED,
        1,
      )
      await addPoolsViaCatalog(
        page,
        pbField(page, pools, L('zone.poolResourcesLabel')),
        'general_resources_start',
        POOLS_SPAWN_RESOURCES,
        1,
      )

      // Шаги 6–7: биомы — все три слоя «как у главного объекта (MatchMainObject)», объект 0, зона пуста
      const biomes = await openSection(page, ed, L('zone.sectionBiomes'))
      for (const key of [
        'zone.zoneBiomeLabel',
        'zone.contentBiomeLabel',
        'zone.metaObjectsBiomeLabel',
      ]) {
        const block = blockByLabel(page, biomes, L(key))
        await expect(block).toHaveCount(1)
        await selectField(block, L('zone.biomeTypeLabel'), 'MatchMainObject')
        await selectField(block, L('zone.biomeArgIndexLabel'), '0')
        await expect(fld(block, L('zone.biomeArgZoneLabel'))).toHaveValue('')
      }

      // Шаг 8: стражи 1.2 / 0.05 / 0.1; реакцию стражей не трогаем (дефолт [1×6])
      const guards = await openSection(page, ed, L('zone.sectionGuards'))
      await fillField(guards, L('zone.guardMultiplierLabel'), '1.2')
      await fillField(guards, L('zone.guardRandomizationLabel'), '0.05')
      await fillField(guards, L('zone.guardWeeklyIncrementLabel'), '0.1')
      await expect(guards.locator('.react-dist__sum')).toContainText('6')
    })

    await test.step('Зона Spawn-2: дубликат Spawn-1, игрок Player2', async () => {
      // §«Дублирование зоны»: выделить Spawn-1. Мануал показывает клик по узлу на
      // канве, но эквивалентный выбор строкой дерева (мануал сам использует его для
      // зон) предпочтительнее: клик по узлу оставляет RF-internal `selected`,
      // а RF приподнимает выбранный узел в z-порядке (elevateNodesOnSelect) —
      // перекрытия узлов меняются и точки-крепления соседей становятся недоступны
      // для последующего драга. Выделение деревом канвас не трогает.
      await ensureNodesVisible(page, ['Spawn-1']) // web-first видимость узла перед выбором (см. ui.ts)
      await selectInTree(page, 'zone', 'Spawn-1')
      await expect(page.locator('.inspector__title')).toHaveText('Spawn-1')
      await duplicateViaInspectorHeader(page, 'zone')
      await expect(page.locator('.react-flow__node')).toHaveCount(2)
      // Копия получает первое свободное имя Zone-N (uniqueZoneName) — «Zone-1»
      await expect(page.locator('.inspector__title')).toHaveText('Zone-1')

      const layoutSec = await openSection(page, ed, L('zone.sectionLayout'))
      await fillField(layoutSec, L('zone.nameLabel'), 'Spawn-2')
      await expect(page.locator('.inspector__title')).toHaveText('Spawn-2')
      await expect(zoneNode(page, 'Spawn-2')).toBeVisible()

      // Шаг 4: Spawn копии → Player2 (иначе ошибка «Player1 уже задан»)
      const moSec = await openSection(page, ed, secPrefix('zone.sectionMainObjects'))
      const spawnCard = card(page, moSec, 'Spawn')
      await openCard(spawnCard)
      await selectField(spawnCard, L('zone.spawnLabel'), 'Player2')
      await expect(zoneNode(page, 'Spawn-2').locator('.zone-node__player')).toHaveText('P2')
    })

    await test.step('Зона Center: город, аванпост, наполнение', async () => {
      // §«Город и заброшенный аванпост» шаги 1–3
      await addZoneOnCanvas(page)
      await expect(page.locator('.react-flow__node')).toHaveCount(3)
      await expect(page.locator('.inspector__title')).toHaveText('Zone-1')

      const layoutSec = await openSection(page, ed, L('zone.sectionLayout'))
      await fillField(layoutSec, L('zone.nameLabel'), 'Center')
      await expect(page.locator('.inspector__title')).toHaveText('Center')
      await fillField(layoutSec, L('zone.sizeLabel'), '1.5')

      // Шаг 4: City; размещение Center и шанс стражи 1 — дефолты заготовки
      const moSec = await openSection(page, ed, secPrefix('zone.sectionMainObjects'))
      await moSec.locator('.mo-add select').selectOption('City')
      await moSec.getByRole('button', { name: L('zone.addObject'), exact: true }).click()
      const cityCard = card(page, moSec, 'City')
      await expect(cityCard).toHaveCount(1)
      await openCard(cityCard)
      await expect(fld(cityCard, L('zone.placementLabel'))).toHaveValue('Center')
      await expect(fld(cityCard, L('zone.guardChanceLabel'))).toHaveValue('1')

      // Шаг 5: фракция FromList + чипы human/demon/dungeon
      await selectField(cityCard, L('zone.factionTypeLabel'), 'FromList')
      await chipOn(cityCard, 'human')
      await chipOn(cityCard, 'demon')
      await chipOn(cityCard, 'dungeon')

      // Шаг 6: пресет застройки — бейдж «в каталоге» подтверждает имя
      await comboFill(cityCard, L('zone.constructionLabel'), 'rich_buildings_construction')
      await expect(cityCard.locator('.preset__badge--ok')).toHaveText(L('fields.badgeOk'))

      // Шаг 7: стража города 20000 / 0.2
      await fillField(cityCard, L('zone.guardValueLabel'), '20000')
      await fillField(cityCard, L('zone.moGuardWeeklyLabel'), '0.2')

      // Шаги 8–9: AbandonedOutpost, размещение Uniform, стража 12000 / 0.1, владелец пуст
      await moSec.locator('.mo-add select').selectOption('AbandonedOutpost')
      await moSec.getByRole('button', { name: L('zone.addObject'), exact: true }).click()
      await expect(moSec.locator('summary').first()).toHaveText(
        L('zone.sectionMainObjects', { n: 2 }),
      )
      const outpostCard = card(page, moSec, 'AbandonedOutpost')
      await expect(outpostCard).toHaveCount(1)
      await openCard(outpostCard)
      await selectField(outpostCard, L('zone.placementLabel'), 'Uniform')
      await fillField(outpostCard, L('zone.guardValueLabel'), '12000')
      await fillField(outpostCard, L('zone.moGuardWeeklyLabel'), '0.1')
      await expect(fld(outpostCard, L('zone.ownerLabel'))).toHaveValue('')

      // §«Наполнение центральной зоны» шаг 1: абсолютные бюджеты 120000 / 20000 / 12000
      const budgets = await openSection(page, ed, L('zone.sectionBudgets'))
      await fillField(budgets, L('zone.guardedBudgetLabel'), '120000')
      await fillField(budgets, L('zone.unguardedBudgetLabel'), '20000')
      await fillField(budgets, L('zone.resourcesBudgetLabel'), '12000')
      await expect(zoneNode(page, 'Center').locator('.zone-node__budget')).toHaveText('152k')

      // Шаг 2: пулы t4/t5
      const pools = await openSection(page, ed, L('zone.sectionPools'))
      await addPoolsViaCatalog(
        page,
        pbField(page, pools, L('zone.poolGuardedLabel')),
        'classic_template_pool_random_t',
        POOLS_CENTER_GUARDED,
        2,
      )
      await addPoolsViaCatalog(
        page,
        pbField(page, pools, L('zone.poolUnguardedLabel')),
        'unguarded_t4',
        POOLS_CENTER_UNGUARDED,
        1,
      )
      await addPoolsViaCatalog(
        page,
        pbField(page, pools, L('zone.poolResourcesLabel')),
        'treasure_zone_rich',
        POOLS_CENTER_RESOURCES,
        1,
      )

      // Шаг 3: биомы — способ FromList (дефолт), чип «Песок» в каждом слое
      const biomes = await openSection(page, ed, L('zone.sectionBiomes'))
      for (const key of [
        'zone.zoneBiomeLabel',
        'zone.contentBiomeLabel',
        'zone.metaObjectsBiomeLabel',
      ]) {
        const block = blockByLabel(page, biomes, L(key))
        await expect(block).toHaveCount(1)
        await expect(fld(block, L('zone.biomeTypeLabel'))).toHaveValue('FromList')
        await chipOn(block, L('biomes.Sand'))
      }

      // Шаг 4: стражи 2.1 / 0.05 / 0.15
      const guards = await openSection(page, ed, L('zone.sectionGuards'))
      await fillField(guards, L('zone.guardMultiplierLabel'), '2.1')
      await fillField(guards, L('zone.guardRandomizationLabel'), '0.05')
      await fillField(guards, L('zone.guardWeeklyIncrementLabel'), '0.15')
    })

    await test.step('Связь Spawn-1-Center: драг, стража 30000/0.15, группа', async () => {
      // §«Создание связи и стража прохода» шаг 1: драг с края Spawn-1 на Center
      await ensureNodesVisible(page, ['Spawn-1', 'Center'])
      await dragConnection(page, 'Spawn-1', 'Center')
      await ensureCanvas(page, ALL_ZONES, 1)
      await expect(page.locator('.inspector__kind')).toHaveText(L('inspector.kindConnection'))
      await expect(treeRow(page, 'connection', 'Spawn-1-Center')).toBeVisible()

      const mainSec = await openSection(page, ed, L('conn.sectionMain'))
      await expect(fld(mainSec, L('conn.nameLabel'))).toHaveValue('') // авто-имя, плейсхолдер «Авто: From-To»
      await expect(fld(mainSec, L('conn.fromLabel'))).toHaveValue('Spawn-1')
      await expect(fld(mainSec, L('conn.toLabel'))).toHaveValue('Center')

      // Шаги 3–7: стража прохода
      const guardSec = await openSection(page, ed, L('conn.sectionGuard'))
      await fillField(guardSec, L('conn.guardValueLabel'), '30000')
      await fillField(guardSec, L('conn.guardWeeklyLabel'), '0.15')
      await expect(fld(guardSec, L('conn.guardRandomLabel'))).toHaveValue('')
      await selectField(guardSec, L('conn.guardZoneLabel'), 'Center')
      await comboFill(guardSec, L('conn.guardGroupLabel'), 'spawn_main_guard')
    })

    await test.step('Связь Spawn-2-Center: дубликат первой, другие концы и имя', async () => {
      // Выделение устанавливаем явно через дерево: оно могло сброситься, если
      // ensureCanvas на прошлом шаге лечил залипание reload'ом страницы
      await selectInTree(page, 'connection', 'Spawn-1-Center')
      // Заголовок инспектора у безымянной связи собран с EN-dash (Inspector.tsx:
      // `conn.name ?? from–to`), канонический id в дереве — с дефисом
      await expect(page.locator('.inspector__title')).toHaveText('Spawn-1–Center')
      // §«Связь второго игрока дублированием»: кнопка-копия в заголовке инспектора
      await duplicateViaInspectorHeader(page, 'connection')
      await expect(page.locator('.inspector__title')).toHaveText('Spawn-1-Center-1')
      await expect(treeRow(page, 'connection', 'Spawn-1-Center-1')).toBeVisible()

      const mainSec = await openSection(page, ed, L('conn.sectionMain'))
      await selectField(mainSec, L('conn.fromLabel'), 'Spawn-2')
      await fillField(mainSec, L('conn.nameLabel'), 'Spawn-2-Center')
      await expect(page.locator('.inspector__title')).toHaveText('Spawn-2-Center')
      await expect(treeRow(page, 'connection', 'Spawn-2-Center')).toBeVisible()
      await ensureCanvas(page, ALL_ZONES, 2)

      // Копия перенесла стражу и группу (мануал: менять только концы и имя)
      const guardSec = await openSection(page, ed, L('conn.sectionGuard'))
      await expect(fld(guardSec, L('conn.guardValueLabel'))).toHaveValue('30000')
      await expect(fld(guardSec, L('conn.guardWeeklyLabel'))).toHaveValue('0.15')
      await expect(fld(guardSec, L('conn.guardZoneLabel'))).toHaveValue('Center')
      await expect(fld(guardSec, L('conn.guardGroupLabel'))).toHaveValue('spawn_main_guard')
    })

    await test.step('Запасные проходы: дублирование + перенос настроек JSON-блоком', async () => {
      // §«Запасные проходы» шаг 1: «Дублировать связь» из контекстного меню.
      // Способ — ПКМ по строке дерева (равнозначен ПКМ по линии, см. шапку файла).
      await duplicateConnectionViaTree(page, 'Spawn-1-Center')
      await expect(page.locator('.inspector__title')).toHaveText('Spawn-1-Center-1')
      await ensureCanvas(page, ALL_ZONES, 3)

      // Шаги 2–3: стража 12000 / 0.1, группа spawn_side_guard, зона стражи остаётся Center
      const guardSec = await openSection(page, ed, L('conn.sectionGuard'))
      await fillField(guardSec, L('conn.guardValueLabel'), '12000')
      await fillField(guardSec, L('conn.guardWeeklyLabel'), '0.1')
      await comboFill(guardSec, L('conn.guardGroupLabel'), 'spawn_side_guard')
      await expect(fld(guardSec, L('conn.guardZoneLabel'))).toHaveValue('Center')

      // Шаг 4: копия Spawn-2-Center → Spawn-2-Center-1, её поля не трогаем
      await duplicateConnectionViaTree(page, 'Spawn-2-Center')
      await expect(page.locator('.inspector__title')).toHaveText('Spawn-2-Center-1')
      await ensureCanvas(page, ALL_ZONES, 4)

      // Шаги 5–8: перенос настроек текстом через JSON-блок
      await selectInTree(page, 'connection', 'Spawn-1-Center-1')
      await expect(page.locator('.inspector__title')).toHaveText('Spawn-1-Center-1')
      const raw = await openJsonBlock(page)
      const ta = jsonTextarea(raw)
      const sample = JSON.parse(await ta.inputValue()) as Record<string, unknown>

      await selectInTree(page, 'connection', 'Spawn-2-Center-1')
      await expect(page.locator('.inspector__title')).toHaveText('Spawn-2-Center-1')
      // Шаг 7: в тексте образца правятся только name и from; to остаётся Center
      const replaced = { ...sample, name: 'Spawn-2-Center-1', from: 'Spawn-2' }
      await ta.fill(JSON.stringify(replaced, null, 2))
      await expect(raw.locator('.json-edit__status')).toHaveText(L('jsonEditor.dirty'))
      await raw.getByRole('button', { name: L('jsonEditor.apply'), exact: true }).click()
      await expect(raw.locator('.json-edit__status')).toHaveCount(0)

      // Шаг 8: формы приняли текст
      await expect(fld(guardSec, L('conn.guardValueLabel'))).toHaveValue('12000')
      await expect(fld(guardSec, L('conn.guardWeeklyLabel'))).toHaveValue('0.1')
      await expect(fld(guardSec, L('conn.guardZoneLabel'))).toHaveValue('Center')
      await expect(fld(guardSec, L('conn.guardGroupLabel'))).toHaveValue('spawn_side_guard')
    })

    await test.step('Дороги внутри зон: по одной каменной от объекта к главному проходу', async () => {
      // §«Дороги внутри зон»: заготовка = Stone, от MainObject[0] к ПЕРВОЙ связи варианта.
      // У Spawn-2 «Куда» надо поменять на Spawn-2-Center (шаг 3); у остальных не трогать.
      const roadPlan: ReadonlyArray<readonly [zoneName: string, toConn: string]> = [
        ['Spawn-1', 'Spawn-1-Center'],
        ['Spawn-2', 'Spawn-2-Center'],
        ['Center', 'Spawn-1-Center'],
      ]
      const fromSuffix = L('roads.endSuffix', { label: L('roads.from') })
      const toSuffix = L('roads.endSuffix', { label: L('roads.to') })

      for (const [zoneName, toConn] of roadPlan) {
        await setInspectorTab(page, L('inspector.tabInspector'))
        await selectInTree(page, 'zone', zoneName)
        await expect(page.locator('.inspector__title')).toHaveText(zoneName)

        const roadsSec = await openSection(page, ed, secPrefix('zone.sectionRoads'))
        await expect(roadsSec.locator('.hint', { hasText: L('roads.empty') })).toBeVisible()
        await roadsSec.getByRole('button', { name: L('roads.add'), exact: true }).click()
        const roadCard = roadsSec.locator('details.road-item')
        await expect(roadCard).toHaveCount(1)
        await openCard(roadCard)

        await expect(fld(roadCard, L('roads.surfaceLabel'))).toHaveValue('Stone')
        const from = blockByLabel(page, roadCard, fromSuffix)
        await expect(fld(from, L('roads.typeLabel'))).toHaveValue('MainObject')
        await expect(fld(from, L('roads.mainObjectLabel'))).toHaveValue('0')
        const to = blockByLabel(page, roadCard, toSuffix)
        await expect(fld(to, L('roads.typeLabel'))).toHaveValue('Connection')
        // Заготовка всегда подставляет первую связь варианта — Spawn-1-Center
        await expect(fld(to, L('roads.connectionLabel'))).toHaveValue('Spawn-1-Center')
        if (toConn !== 'Spawn-1-Center') {
          await selectField(to, L('roads.connectionLabel'), toConn)
          await expect(fld(to, L('roads.connectionLabel'))).toHaveValue(toConn)
        }
      }
    })

    await test.step('Корень: группы обязательного контента + подключение зонам', async () => {
      // §«Группы обязательного контента»: две группы с заготовкой-элементом
      await setInspectorTab(page, L('inspector.tabContent'))
      const panel = rootPane(page)
      await expect(panel.locator('.rootpanel__empty')).toHaveText(L('rootPanels.emptyGroups'))

      const addGroup = panel.getByRole('button', { name: L('rootPanels.addGroup'), exact: true })
      await addGroup.click()
      const groupSpawn = groupCardAt(page, 0)
      await expect(groupSpawn.locator('input.mc-group__name')).toHaveValue('group_1')
      await renameGroup(groupSpawn, 'group_spawn')
      await expect(groupSpawn.locator('input.mc-group__name')).toHaveValue('group_spawn')
      await groupSpawn
        .getByRole('button', { name: L('rootPanels.addObject'), exact: true })
        .click()
      await expect(groupSpawn.locator('details.mc-item')).toHaveCount(1)
      await expect(groupSpawn.locator('.mc-group__count')).toHaveText(
        L('rootPanels.mcCount', { items: 1, zones: 0 }),
      )

      await addGroup.click()
      const groupCenter = groupCardAt(page, 1)
      await expect(groupCenter.locator('input.mc-group__name')).toHaveValue('group_2')
      await renameGroup(groupCenter, 'group_center')
      await expect(groupCenter.locator('input.mc-group__name')).toHaveValue('group_center')
      await groupCenter
        .getByRole('button', { name: L('rootPanels.addObject'), exact: true })
        .click()
      await expect(groupCenter.locator('details.mc-item')).toHaveCount(1)

      // Шаги 6–9: подключить группы зонам (секция «Обязательный контент и лимиты»)
      await setInspectorTab(page, L('inspector.tabInspector'))
      const mcPlan: ReadonlyArray<readonly [zoneName: string, groupName: string]> = [
        ['Spawn-1', 'group_spawn'],
        ['Spawn-2', 'group_spawn'],
        ['Center', 'group_center'],
      ]
      for (const [zoneName, groupName] of mcPlan) {
        await selectInTree(page, 'zone', zoneName)
        const sec = await openSection(page, ed, L('zone.sectionMandatory'))
        await addGroupRef(page, sec, L('zone.mandatoryContentLabel'), groupName)
      }
    })

    await test.step('Корень: группы лимитов количества + подключение зонам', async () => {
      // §«Группы лимитов количества»: то же устройство, заготовка — pandora_box/-1/1
      await setInspectorTab(page, L('inspector.tabLimits'))
      const panel = rootPane(page)
      const addGroup = panel.getByRole('button', { name: L('rootPanels.addGroup'), exact: true })
      await addGroup.click()
      const limSpawn = groupCardAt(page, 0)
      await expect(limSpawn.locator('input.mc-group__name')).toHaveValue('content_limits_1')
      await renameGroup(limSpawn, 'content_limits_spawn')
      await expect(limSpawn.locator('input.mc-group__name')).toHaveValue('content_limits_spawn')
      await limSpawn
        .getByRole('button', { name: L('rootPanels.addLimit'), exact: true })
        .click()
      await expect(limSpawn.locator('details.mc-item')).toHaveCount(1)
      await expect(limSpawn.locator('.mc-group__count')).toHaveText(
        L('rootPanels.clCount', { limits: 1, zones: 0 }),
      )

      await addGroup.click()
      const limCenter = groupCardAt(page, 1)
      await expect(limCenter.locator('input.mc-group__name')).toHaveValue('content_limits_2')
      await renameGroup(limCenter, 'content_limits_center')
      await expect(limCenter.locator('input.mc-group__name')).toHaveValue('content_limits_center')
      await limCenter
        .getByRole('button', { name: L('rootPanels.addLimit'), exact: true })
        .click()
      await expect(limCenter.locator('details.mc-item')).toHaveCount(1)

      await setInspectorTab(page, L('inspector.tabInspector'))
      const clPlan: ReadonlyArray<readonly [zoneName: string, groupName: string]> = [
        ['Spawn-1', 'content_limits_spawn'],
        ['Spawn-2', 'content_limits_spawn'],
        ['Center', 'content_limits_center'],
      ]
      for (const [zoneName, groupName] of clPlan) {
        await selectInTree(page, 'zone', zoneName)
        const sec = await openSection(page, ed, L('zone.sectionMandatory'))
        await addGroupRef(page, sec, L('zone.contentCountLimitsLabel'), groupName)
      }
    })

    await test.step('Корень: лэйаут зоны и правила игры (значения из 01-quick-start)', async () => {
      await setInspectorTab(page, L('inspector.tabRoot'))

      // §«Лэйаут зон и правила игры»: единственная карточка zone_layout_default,
      // значения — таблица 01-quick-start §«Поля лэйаута зоны»
      const layouts = await openSection(page, ed, L('root.sectionLayouts'))
      const layoutCard = layouts.locator('details.mo')
      await expect(layoutCard).toHaveCount(1)
      await fillField(layoutCard, L('root.layoutObstaclesLabel'), '0.5')
      await fillField(layoutCard, L('root.layoutObstaclesVoidLabel'), '0.5')
      await fillField(layoutCard, L('root.layoutLakesLabel'), '0.3')
      await fillField(layoutCard, L('root.layoutElevScaleLabel'), '0.5')
      await fillField(layoutCard, L('root.layoutRoadClusterLabel'), '100')
      await fillField(layoutCard, L('root.gerFractionsLabel'), '0.7')
      await fillField(layoutCard, L('root.ambientRepulsionLabel'), '1')
      await fillField(layoutCard, L('root.ambientNoiseLabel'), '0.35')
      await fillField(layoutCard, L('root.ambientRoadLabel'), '0')
      await fillField(layoutCard, L('root.ambientObstacleLabel'), '0.02')
      await fillNumList(layoutCard, L('root.ambientGroupWeightsLabel'), '20, 2, 1')

      // 01-quick-start §«Правила игры»: 1 / 3 / 1, false, false, «Классическое» = true.
      // «Турнирные правила» мануал не трогает (их нет в перечне шести записей).
      const rules = await openSection(page, ed, L('root.sectionRules'))
      await fillField(rules, L('root.heroCountMinLabel'), '1')
      await fillField(rules, L('root.heroCountMaxLabel'), '3')
      await fillField(rules, L('root.heroCountIncrementLabel'), '1')
      await selectField(rules, L('root.heroHireBanLabel'), 'false')
      await selectField(rules, L('root.encounterHolesLabel'), 'false')
      await selectField(rules, L('root.wcClassicLabel'), 'true')
    })

    await test.step('Проверка: панель «Проблемы» — «шаблон корректен»', async () => {
      // §«Проверка и финал»: панель показывает строку «шаблон корректен».
      // Проверка чисто UI (black-box): white-box сверка через page.evaluate(import(store))
      // в этом сценарии ненадёжна (модульный граф Vite после HMR может дать тесту
      // не тот инстанс store, что рисует UI — наблюдалось 04.10.2026).
      const okLine = page.locator('.validator__ok')
      const clean = await expect(okLine)
        .toBeVisible({ timeout: 10_000 })
        .then(
          () => true,
          () => false,
        )
      if (!clean) {
        // Диагностика: какие замечания не закрыты (тексты строк панели)
        await page.locator('.validator__details summary').click()
        const issues = await page.locator('.validator__body .issue').allTextContents()
        expect(clean, `Панель «Проблемы» не чиста к финалу практикума:\n${issues.join('\n')}`).toBe(
          true,
        )
      }
      await expect(okLine).toHaveText(L('validator.ok'))
    })

    await test.step('Сохранение и сравнение с эталоном export/One To One.rmg.json', async () => {
      // §«Финал: сохранение и установка»: «Сохранить» активна, папка (OPFS-шим), три файла
      const saveBtn = page.getByRole('button', { name: L('app.save'), exact: true })
      await expect(saveBtn).toBeEnabled()
      await saveBtn.click()

      // Запись асинхронна (рендер PNG 700×700) — только expect.poll (грабли recipe save-file.md)
      await expect
        .poll(async () => (await opfsFiles(page, OPFS_DIR)).map((f) => f.name).sort(), {
          timeout: 20_000,
          message: 'в OPFS-папке должны появиться три файла сохранения',
        })
        .toEqual([
          `${TEMPLATE_NAME}.editor.json`,
          `${TEMPLATE_NAME}.png`,
          `${TEMPLATE_NAME}.rmg.json`,
        ])

      // Sidecar и PNG по условию задачи не сравниваются — только факт непустой записи
      const files = await opfsFiles(page, OPFS_DIR)
      for (const f of files) expect(f.size, `${f.name} пуст`).toBeGreaterThan(0)

      const producedText = await readOpfsText(page, OPFS_DIR, `${TEMPLATE_NAME}.rmg.json`)
      const produced = JSON.parse(producedText) as Record<string, unknown>
      const etalonRaw = JSON.parse(readFileSync(ETALON_PATH, 'utf-8')) as Record<string, unknown>

      // $.name — вход сценария, а не часть проверяемого алгоритма: закоммиченный эталон —
      // тот же шаблон, собранный редактором, но под именем «One To One» (его содержимое
      // побайтово идентично локальному «Первая дуэль.rmg.json» кроме name — проверено
      // 15.10.2026). Имя построенного шаблона проверяем строгим ассертом отдельно,
      // а эталон для deepDiff нормализуем к TEMPLATE_NAME.
      expect(produced.name, 'Имя построенного шаблона').toBe(TEMPLATE_NAME)
      expect(etalonRaw.name, 'Эталон обязан содержать name').toBeDefined()
      const etalon = { ...etalonRaw, name: TEMPLATE_NAME }

      const diffs = deepDiff(produced, etalon, '$', {
        // Решение пользователя (04.10.2026): порядок элементов в zones[]/connections[]
        // не сравниваем (на семантику игры не влияет); количество и наполнение
        // каждого элемента — строгое сопоставление по имени/каноническому id.
        orderFree: [/^\$\.variants\[\d+\]\.zones$/, /^\$\.variants\[\d+\]\.connections$/],
      })
      const report = formatDiff(diffs, annotateManualStep)
      await testInfo.attach('diff-with-etalon.txt', {
        body: report,
        contentType: 'text/plain; charset=utf-8',
      })
      await testInfo.attach('produced-template.rmg.json', {
        body: producedText,
        contentType: 'application/json',
      })

      // Сохранение состоялось: отметка «✓ время» в шапке + info-тост о папке
      // (UI-факты вместо white-box storeState — см. комментарий в шаге «Проверка»)
      await expect(page.locator('.app__source--ok')).toContainText('✓')
      await expect(page.getByRole('status')).toHaveText(
        interp(L('app.alertSavedFolder'), { folder: OPFS_DIR }),
      )

      expect(consoleErrors, consoleErrors.join('\n')).toEqual([])

      // Целевой ассерт: структура ЧЁТКО повторяет эталон. Любое расхождение —
      // в сообщение (с классификацией и ссылкой на шаг мануала) и в HTML-отчёт.
      expect(
        diffs.map((d) => `${d.kind} ${d.path}`),
        `Расхождения построенного шаблона с эталоном export/One To One.rmg.json.\n\n${report}`,
      ).toEqual([])
    })
  })
})
