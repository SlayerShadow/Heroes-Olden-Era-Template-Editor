/**
 * Кит UI-операций для сценарных E2E-тестов редактора.
 * Спеки должны читаться как сценарий — вся обвязка локаторов живёт здесь и в helpers.ts.
 *
 * Соглашения приложения (проверены чтением компонентов):
 * - Поле = <label class="ef"><span class="ef__label">Подпись</span><input|select|textarea></label>
 *   (editors/fields.tsx) ЛИБО input c aria-label (ComboInput в GroupRefList/PoolListEditor).
 *   Обязательные поля получают «*» в подписи → здесь getByLabel с заякоренным regex.
 * - Секция = details.editor__sec > summary (fields.tsx Section); раскладка хранится
 *   в store.sectionStates (persistKey) — поэтому «открой секцию» идемпотентно.
 * - Карточка (главный объект / дорога / лэйаут / элемент группы) = details.mo > summary,
 *   по умолчанию свёрнута.
 * - Строка дерева = .tree-row[data-sel-kind][data-sel-id] (TemplateTree.tsx) —
 *   стабильные data-атрибуты приложения, текст не нужен.
 * - Узел канвы = .react-flow__node c .zone-node__name (helpers.zoneNode);
 *   ребро = g[data-testid="rf__edge-<id>"] (@xyflow/react); точки-крепления =
 *   [data-handleid] (ZoneNode.tsx: src-… и tgt-… по сторонам).
 * - ComboInput (fields.tsx) рисует dropdown в portal: после fill надо закрыть его
 *   Escape до коммита Enter — иначе портал перехватит следующий клик (hit-target).
 * - Никаких waitForTimeout: только web-first ассерты (expect/poll).
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { escapeRegExp, L, zoneNode } from './helpers'

/* ------------------------------------------------------------------ */
/* Панели и вкладки                                                    */
/* ------------------------------------------------------------------ */

/** Редактор активной вкладки правой панели (зона/связь/корень — div.editor). */
export function editorPane(page: Page): Locator {
  return page.locator('.app__inspector div.editor')
}

/** Корневая панель вкладок «Контент»/«Лимиты» (div.rootpanel). */
export function rootPane(page: Page): Locator {
  return page.locator('.app__inspector div.rootpanel')
}

/** Переключить вкладку правой панели («Инспектор»/«Контент»/«Лимиты»/«Шаблон»/«Вариант»). */
export async function setInspectorTab(page: Page, tabName: string): Promise<void> {
  await page.locator('.inspector__tabs').getByRole('button', { name: tabName, exact: true }).click()
}

/* ------------------------------------------------------------------ */
/* Секции и поля                                                       */
/* ------------------------------------------------------------------ */

/**
 * Секция инспектора по префиксу заголовка; раскрыть, если свёрнута.
 * Префикс достаточен для секций со счётчиком («Главные объекты», «Дороги»).
 */
export async function openSection(
  page: Page,
  scope: Locator,
  titlePrefix: string,
): Promise<Locator> {
  // НЕ :text-matches("…") — парсер селекторов разэкранирует \( до ( и regex
  // становится невалидным (проверено: секции со скобками в заголовке — 0 совпадений).
  // Рабочий вариант: вложенный filter по hasText с regex (префикс заголовка).
  const sec = scope.locator('details.editor__sec').filter({
    has: page.locator('summary').filter({ hasText: new RegExp(`^${escapeRegExp(titlePrefix)}`) }),
  })
  await expect(sec, `секция «${titlePrefix}…»`).toHaveCount(1)
  const isOpen = await sec.evaluate((el) => (el as HTMLDetailsElement).open)
  if (!isOpen) {
    // .first() — у секции может быть вложенный details (карточка лэйаута):
    // её summary идёт в документе после summary самой секции.
    await sec.locator('summary').first().click()
    await expect(sec).toHaveAttribute('open', '')
  }
  return sec
}

/**
 * Поле (input/select/textarea) по ТОЧНОЙ подписи.
 *
 * Ищем обёртку <label class="ef"> по точному тексту её span.ef__label
 * (заякоренный regex: отличает «Бюджет охраняемого контента» от «…(на площадь)»,
 * допускает хвост «*» обязательного поля), затем берём единственный контрол внутри.
 *
 * Почему не getByLabel:
 * - у <select> textContent label'а включает тексты <option> («Подпись—A B C…») —
 *   точное совпадение невозможно (проверено разведкой);
 * - у <textarea> React пишет value дочерним текстовым узлом, и после ввода
 *   textContent label'а становится «Подпись20, 2, 1» — заякоренный regex отваливается
 *   (проверено разведкой: count 1 до fill, 0 после).
 * span.ef__label от значения не зависит никогда.
 */
export function fld(scope: Locator, label: string): Locator {
  const re = new RegExp(`^${escapeRegExp(label)}\\s*\\*?$`)
  return scope
    .locator('label.ef')
    .filter({ has: scope.page().locator('span.ef__label').filter({ hasText: re }) })
    .locator('input, select, textarea')
}

/** Заполнить обычное поле (Num/Text) и закоммитить Enter'ом (конвенция fields.tsx: commit on blur). */
export async function fillField(scope: Locator, label: string, value: string): Promise<void> {
  const input = fld(scope, label)
  await input.fill(value)
  await input.press('Enter')
}

/** Выбрать значение в нативном select (Select/TriSelect из fields.tsx). */
export async function selectField(scope: Locator, label: string, value: string): Promise<void> {
  await fld(scope, label).selectOption(value)
}

/**
 * Заполнить ComboInput (свободный текст с dropdown): fill → Escape (закрыть
 * портал-список, иначе перехватит следующий клик) → Enter (blur → onCommit).
 */
export async function comboFill(scope: Locator, label: string, value: string): Promise<void> {
  const input = fld(scope, label)
  await input.fill(value)
  await input.press('Escape')
  await input.press('Enter')
}

/** Заполнить список чисел (NumList — textarea): commit по Ctrl+Enter. */
export async function fillNumList(scope: Locator, label: string, value: string): Promise<void> {
  const ta = fld(scope, label)
  await ta.fill(value)
  await ta.press('Control+Enter')
}

/* ------------------------------------------------------------------ */
/* Карточки (details.mo), чипы, блоки с подписью                       */
/* ------------------------------------------------------------------ */

/** Карточка details.mo по точному тексту первого span в summary (тип объекта/имя лэйаута). */
export function card(page: Page, scope: Locator, summaryText: string): Locator {
  return scope.locator('details.mo').filter({
    has: page.locator(`summary span:text-is("${summaryText}")`),
  })
}

/** Раскрыть карточку details, если свёрнута (клик по summary). */
export async function openCard(details: Locator): Promise<void> {
  const isOpen = await details.evaluate((el) => (el as HTMLDetailsElement).open)
  if (!isOpen) await details.locator('summary').first().click()
}

/**
 * Блок-группа полей с собственной подписью span.ef__label (не label.ef):
 * слой биома («Биом зоны (поверхность)»), конец дороги («Куда — конец дороги»),
 * поле с чипами (div.pb-field). Текст — точное совпадение.
 */
export function blockByLabel(page: Page, scope: Locator, labelText: string): Locator {
  return scope.locator('div.full').filter({
    has: page.locator(`span.ef__label:text-is("${labelText}")`),
  })
}

/** Чип TermChips (биом/фракция): текст «Песок» или «✓ Песок» в состоянии on. */
export function chip(scope: Locator, label: string): Locator {
  return scope.locator('button.chip').filter({
    hasText: new RegExp(`^(✓\\s*)?${escapeRegExp(label)}$`),
  })
}

/** Кликнуть невыбранный чип и проверить, что он включился (chip--on). */
export async function chipOn(scope: Locator, label: string): Promise<void> {
  const c = chip(scope, label)
  await expect(c, `чип «${label}»`).toHaveCount(1)
  await expect(c, `чип «${label}» ещё не выбран`).not.toHaveClass(/chip--on/)
  await c.click()
  await expect(c).toHaveClass(/chip--on/)
}

/* ------------------------------------------------------------------ */
/* Пулы контента: поле + окно каталога                                 */
/* ------------------------------------------------------------------ */

/** Поле списка пулов / ссылок на группы (div.pb-field — PoolListEditor и GroupRefList). */
export function pbField(page: Page, scope: Locator, label: string): Locator {
  return scope.locator('div.pb-field').filter({
    has: page.locator(`span.ef__label:text-is("${label}")`),
  })
}

/**
 * Добавить пулы через окно «Каталог» (PoolBrowser): поиск → отметить строки
 * кнопкой «+» (идентификация — сырое имя пула в .pb-row__tags, как в главе 13-pools)
 * → «Закрыть». totalChips — сколько плашек должно стать в поле после операции.
 */
export async function addPoolsViaCatalog(
  page: Page,
  field: Locator,
  query: string,
  sids: string[],
  totalChips: number,
): Promise<void> {
  await field.getByRole('button', { name: L('poolList.catalog'), exact: true }).click()
  const overlay = page.locator('.pb-overlay')
  await expect(overlay).toBeVisible()
  await overlay.locator('.pb__search').fill(query)
  for (const sid of sids) {
    const row = overlay.locator('details.pb-row').filter({
      has: page.locator(`.pb-row__tags:text-is("${sid}")`),
    })
    await expect(row, `строка каталога «${sid}»`).toHaveCount(1)
    await row.locator('.pb-row__toggle').click()
    await expect(row).toHaveClass(/pb-row--sel/)
  }
  await overlay.getByRole('button', { name: L('pools.close'), exact: true }).click()
  await expect(overlay).toHaveCount(0)
  await expect(field.locator('.pb-field__chip')).toHaveCount(totalChips)
}

/** Вписать имя корневой группы в поле зоны (GroupRefList) и проверить чип. */
export async function addGroupRef(
  page: Page,
  scope: Locator,
  label: string,
  groupName: string,
): Promise<void> {
  const field = pbField(page, scope, label)
  const input = field.getByRole('combobox')
  await input.fill(groupName)
  await input.press('Escape') // закрыть dropdown ComboInput
  await input.press('Enter') // blur → onCommit → add()
  await expect(field.locator(`.pb-field__chname:text-is("${groupName}")`)).toBeVisible()
}

/* ------------------------------------------------------------------ */
/* Корневые группы («Контент»/«Лимиты»)                                */
/* ------------------------------------------------------------------ */

/**
 * Карточка корневой группы (mc-group) по порядковому номеру: группы добавляются
 * в конец списка панели, rename позицию не меняет (React key = имя, порядок
 * элементов в store прежний) — nth стабилен. Значение поля имени после
 * переименования проверять toHaveValue (читает свойство, не атрибут).
 */
export function groupCardAt(page: Page, index: number): Locator {
  return page.locator('details.mc-group').nth(index)
}

/** Переименовать корневую группу (Enter = blur = rename, RootPanels.tsx). */
export async function renameGroup(cardLoc: Locator, newName: string): Promise<void> {
  const input = cardLoc.locator('input.mc-group__name')
  await input.fill(newName)
  await input.press('Enter')
}

/* ------------------------------------------------------------------ */
/* Дерево шаблона                                                      */
/* ------------------------------------------------------------------ */

export function treeRow(page: Page, kind: 'zone' | 'connection', id: string): Locator {
  return page.locator(`.tree-row[data-sel-kind="${kind}"][data-sel-id="${id}"]`)
}

/** Выбрать зону/связь кликом по строке дерева (как в мануале). */
export async function selectInTree(page: Page, kind: 'zone' | 'connection', id: string): Promise<void> {
  await treeRow(page, kind, id).click()
}

/**
 * Дублировать связь через контекстное меню строки дерева. Мануал документирует
 * этот способ как равносильный ПКМ по линии канвы (19-first-template §«Связь
 * второго игрока дублированием»: «…по правому клику на линии канвы ИЛИ на строке
 * связи в дереве»): на канве только что созданные узлы перекрывают линии при
 * авто-зуме 2.5, и ПКМ по ребру попадает в чужой узел — в дереве детерминированно.
 */
export async function duplicateConnectionViaTree(page: Page, id: string): Promise<void> {
  await treeRow(page, 'connection', id).click({ button: 'right' })
  await page
    .getByRole('menuitem', { name: L('graph.ctx.duplicateConnection'), exact: true })
    .click()
}

/* ------------------------------------------------------------------ */
/* Канва                                                               */
/* ------------------------------------------------------------------ */

/**
 * Дождаться ВИДИМОСТИ узлов канвы перед канвас-операциями (клик/драг).
 *
 * React Flow обмеряет НОВЫЕ узлы при монтаже: до прихода `measured` узел скрыт
 * (visibility:hidden) — обычно меньше кадра, авторетри toBeVisible это съедает.
 * Стойкое «залипание» скрытости, наблюдавшееся ранее на каждом коммите, было
 * дефектом приложения: ZoneGraph.tsx wholesale-заменял массив узлов
 * (`setNodes(initial.nodes)`), сбрасывая `measured`. Дефект починен разработчиком
 * 04.10.2026 (mergeNodes/mergeEdges в utils/graph.ts сохраняют measured/selected
 * и возвращают прежний объект при идентичности). Тест намеренно НЕ содержит
 * «тихого лечения» (undo/redo, reload): регрессия этого дефекта должна уронить
 * тест громко, а не замаскироваться (конвенция: баги приложения не маскируем).
 */
export async function ensureNodesVisible(page: Page, names: string[]): Promise<void> {
  for (const name of names) {
    await expect(zoneNode(page, name), `узел «${name}» не виден на канве`).toBeVisible({
      timeout: 10_000,
    })
  }
}

/**
 * Готовность канвы к операциям/ассертам: узлы видимы и связи отрисованы.
 * Рёбра React Flow рисует только по измеренным узлам, поэтому счётчик рёбер
 * проверяем ПОСЛЕ гарантии видимости узлов.
 */
export async function ensureCanvas(page: Page, zones: string[], edges: number): Promise<void> {
  await ensureNodesVisible(page, zones)
  await expect(page.locator('.react-flow__edge')).toHaveCount(edges)
}

/** Кнопка «+ зона» на канве (rf-panel top-left). */
export async function addZoneOnCanvas(page: Page): Promise<void> {
  await page.getByRole('button', { name: L('graph.addZone'), exact: true }).click()
}

/**
 * Первая ОТКРЫТАЯ точка-крепление узла (не закрытая чужими узлами и видимая в
 * панели канвы): probe elementFromPoint в центре хендла. Нужна потому, что
 * авто-раскладка «+ зона» ставит узлы впритык (48/164 flow-px при nodeOrigin
 * по центру), и крупный узел (Center size 1.5) на дефолтном зуме 2.5 перекрывает
 * правые хендлы соседей — mousedown ушёл бы на чужой узел (драг узла вместо
 * создания связи; проверено разведкой). Порядок сторон — как в мануале
 * (правый/левый край приоритетом), но сторона на структуру результата не
 * влияет: from/to связи определяются узлами, а не хендлами (ConnectionMode.Loose).
 */
async function pickHandle(
  page: Page,
  zone: string,
  side: 'source' | 'target',
): Promise<{ x: number; y: number }> {
  // Источник: только source-хендлы (семантика from) И только «верхние» в hit-test:
  // mousedown обязан попасть именно в хендл, иначе начнётся драг узла. Точки на
  // стороне узла перебираются в порядке мануала (правый край первым); узел может
  // быть перекрыт соседом (авто-раскладка ставит узлы впритык) — тогда берём
  // следующую сторону.
  // Цель: в ConnectionMode.Loose концом связи годится ЛЮБАЯ точка узла-приёмника,
  // и drop у @xyflow proximity-based (connectionRadius от позиции mouseup), а не
  // hit-test: ручку НЕ обязательно быть «сверху» (проверено разведкой: drop на
  // точку, перекрытую чужим узлом, создал связь). Достаточно, что точка лежит
  // внутри панели канвы. Это также устойчиво к z-элевации: RF приподнимает
  // последний кликнутый узел (internal selected), и он может перекрывать ручки
  // соседей — на drop это не влияет.
  const ids =
    side === 'source'
      ? ['src-r', 'src-l', 'src-b', 'src-t']
      : ['tgt-l', 'src-l', 'tgt-r', 'src-r', 'tgt-t', 'src-t', 'tgt-b', 'src-b']
  const pane = await page.locator('.react-flow__pane').boundingBox()
  for (const id of ids) {
    const box = await zoneNode(page, zone).locator(`[data-handleid="${id}"]`).boundingBox()
    if (!box) continue
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    if (side === 'target') {
      if (!pane) continue
      if (cx < pane.x || cy < pane.y || cx > pane.x + pane.width || cy > pane.y + pane.height)
        continue // точка вне панели канвы (обрезана) — mouseup там не поймает ручку
      return { x: cx, y: cy }
    }
    const top = await page.evaluate(
      (p: { x: number; y: number }) => {
        const el = document.elementFromPoint(p.x, p.y)
        const handle = el ? (el as HTMLElement).closest('.react-flow__handle') : null
        return {
          hid: handle?.getAttribute('data-handleid') ?? null,
          node: handle?.closest('.react-flow__node')?.getAttribute('data-id') ?? null,
        }
      },
      { x: cx, y: cy },
    )
    if (top.node !== zone || top.hid !== id) continue // точка закрыта чужим узлом/панелью
    return { x: cx, y: cy }
  }
  throw new Error(`Нет открытой точки-крепления (${side}) у зоны «${zone}»`)
}

/**
 * Создать связь драгом с точки-крепления узла `from` на точку узла `to`
 * (19-first-template §«Создание связи и стража прохода»). @xyflow ловит
 * окончание драга по близости к хендлу (connectionRadius), направление
 * src→tgt даёт from/to связи как в мануале.
 */
export async function dragConnection(page: Page, fromZone: string, toZone: string): Promise<void> {
  const a = await pickHandle(page, fromZone, 'source')
  const b = await pickHandle(page, toZone, 'target')
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 15 })
  await page.mouse.up()
}

/* ------------------------------------------------------------------ */
/* Инспектор: заголовок, дублирование, JSON-блок                       */
/* ------------------------------------------------------------------ */

/** Кнопка-копия в заголовке инспектора («Дублировать зону/связь»). */
export async function duplicateViaInspectorHeader(
  page: Page,
  kind: 'zone' | 'connection',
): Promise<void> {
  const label =
    kind === 'zone' ? L('inspector.duplicateZoneTitle') : L('inspector.duplicateConnectionTitle')
  await page.locator('.inspector__head').getByRole('button', { name: label, exact: true }).click()
}

/** Раскрыть блок «JSON» внизу вкладки «Инспектор» (details.inspector__raw). */
export async function openJsonBlock(page: Page): Promise<Locator> {
  const raw = page.locator('.app__inspector details.inspector__raw')
  const isOpen = await raw.evaluate((el) => (el as HTMLDetailsElement).open)
  if (!isOpen) await raw.locator('summary').click()
  return raw
}

/** Textarea JSON-черновика (aria-label из shared.json jsonEditor.aria). */
export function jsonTextarea(raw: Locator): Locator {
  return raw.getByLabel(L('jsonEditor.aria'))
}
