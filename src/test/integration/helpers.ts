/**
 * Общие хелперы E2E-тестов.
 *
 * Принципы:
 * - UI-строки НЕ хардкодятся: читаются из `src/i18n/locales/ru/**` с диска (ru()).
 * - Ожидания по фикстуре НЕ хардкодятся: числа зон/связей берутся из
 *   `src/data/sampleTemplate.json` (sampleFixture()), а не литералом.
 * - Подготовка состояния — через ГЛАВНЫЙ мир страницы (page.evaluate):
 *   динамический import модуля приложения по URL dev-сервера возвращает ТОТ ЖЕ
 *   инстанс, что использует приложение (проверено). Спецификаторы модулей
 *   передаются аргументами (нелитеральный import() в TS не резолвится — и не надо:
 *   эти URL существуют только в браузере).
 * - Никаких waitForTimeout/sleep: только web-first ассерты и expect.poll.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, type Locator, type Page } from '@playwright/test'
import type { RmgTemplate } from '../../types/rmg'

/* ------------------------------------------------------------------ */
/* Пути и URL                                                          */
/* ------------------------------------------------------------------ */

/** URL dev-сервера: боевые модули приложения (главный мир, тот же инстанс store). */
const STORE_MODULE = '/src/store/editorStore.ts'
const FS_MODULE = '/src/utils/fsAccess.ts'
const VALIDATE_MODULE = '/src/utils/validate.ts'
const CATALOG_MODULE = '/src/data/catalog.ts'
const SAMPLE_TPL_URL = '/src/data/sampleTemplate.json'
const SAMPLE_SIDE_URL = '/src/data/sampleTemplate.editor.json'

/**
 * Точный URL модуля store, который загрузило САМО приложение.
 *
 * Зачем: после правок app-файлов при живом dev-сервере Vite помечает
 * инвалидированные модули штампом `?t=…` в трансформированных импортах; приложение
 * получает store по URL со штампом, а прямой import(plain-URL) из теста создал бы
 * ВТОРОЙ инстанс store (расщепление наблюдалось 04.10.2026: loadSampleTemplate
 * через plain-URL не влиял на UI). Resource timing даёт фактический URL модуля
 * текущей страницы — импорт именно его гарантирует общий инстанс. Нет записи
 * (буфер resource timing переполнен) — фолбэк на plain-URL (поведение до фикса).
 */
async function storeModuleUrl(page: Page): Promise<string> {
  const url = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource')
    const hit = entries.find((e) => e.name.includes('/src/store/editorStore.ts'))
    return hit ? hit.name : null
  })
  return url ?? STORE_MODULE
}

/**
 * Ключ localStorage снапшота сессии — SESSION_KEY из `src/store/editorStore.ts`
 * (константа не экспортируется; при её изменении в приложении тесты нужно синхронизировать).
 */
export const SESSION_KEY = 'oe-editor:session'

/**
 * Ключ localStorage выбранной локали — LOCALE_LS_KEY из `src/i18n/index.ts`.
 * Там константа экспортируется, но импорт этого модуля в раннер выполнил бы
 * инициализацию i18next (+react-i18next) в процессе тест-раннера — лишний
 * побочный эффект ради одной строки. Дублируем по образцу SESSION_KEY;
 * при изменении в приложении тесты нужно синхронизировать.
 */
export const LOCALE_LS_KEY = 'oe-editor.locale'

/** Подпись PNG (проверка, что сохранённое превью — действительно PNG). */
export const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/* ------------------------------------------------------------------ */
/* Строки ru-локали (источник истины — файлы локали, не литералы)      */
/* ------------------------------------------------------------------ */

type Dict = Record<string, string>

export interface RuStrings {
  /** common/app.json → app.* (шапка, тосты сохранения). */
  app: Dict
  /** common/app.json → fs.* (файловые ошибки). */
  fs: Dict
  /** common/app.json → store.* (имя нового шаблона, восстановление сессии). */
  store: Dict
  /** common/dialogs.json → confirm.* (модалка подтверждения). */
  confirm: Dict
  /** common/panels.json → inspector.* (заголовок инспектора). */
  inspector: Dict
  /** common/panels.json → validator.* (панель «Проблемы»). */
  validatorPanel: Dict
  /** common/zone.json → zone.* (подписи полей инспектора зоны). */
  zoneLabels: Dict
  /** validator/scope.json (подписи областей замечаний, с {{params}}). */
  scope: Dict
  /** root.gameModes.Classic.label (бейдж режима игры в шапке). */
  gameModeClassicLabel: string
  /** Текст замечания валидатора по IssueCode (слияние validator/issues/*.json). */
  issue: (code: string) => string
}

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8')) as Record<
    string,
    unknown
  >
}

let ruCache: RuStrings | null = null

/** Строки ru-локали, прочитанные с диска (кэшируется на процесс воркера). */
export function ru(): RuStrings {
  if (ruCache) return ruCache
  const appJson = readJson('../../i18n/locales/ru/common/app.json')
  const dialogsJson = readJson('../../i18n/locales/ru/common/dialogs.json')
  const panelsJson = readJson('../../i18n/locales/ru/common/panels.json')
  const zoneJson = readJson('../../i18n/locales/ru/common/zone.json')
  const rootJson = readJson('../../i18n/locales/ru/common/root.json')
  const issues: Dict = {}
  for (const file of ['root', 'variant', 'zone', 'connection', 'road']) {
    Object.assign(issues, readJson(`../../i18n/locales/ru/validator/issues/${file}.json`))
  }
  const root = rootJson.root as Record<string, unknown>
  const gameModes = root.gameModes as Record<string, { label: string }>
  ruCache = {
    app: appJson.app as Dict,
    fs: appJson.fs as Dict,
    store: appJson.store as Dict,
    confirm: dialogsJson.confirm as Dict,
    inspector: panelsJson.inspector as Dict,
    validatorPanel: panelsJson.validator as Dict,
    zoneLabels: zoneJson.zone as Dict,
    scope: readJson('../../i18n/locales/ru/validator/scope.json') as unknown as Dict,
    gameModeClassicLabel: gameModes.Classic.label,
    issue: (code: string) => {
      const text = issues[code]
      if (text === undefined) throw new Error(`В ru-локали нет текста issue «${code}»`)
      return text
    },
  }
  return ruCache
}

/** Подставить параметры в i18n-строку вида «… {{name}} …» (аналог t()). */
export function interp(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => String(params[key] ?? ''))
}

/** Локали UI приложения (SUPPORTED_LOCALES, src/i18n/index.ts: ru — источник истины, en — зеркало). */
export type UiLocale = 'ru' | 'en'

/**
 * Все строки неймспейса `common` выбранной локали, слитые как в
 * `src/i18n/locales/{locale}/common/index.ts` (каждый доменный файл владеет
 * своими верхнеуровневыми группами ключей). Кэшируется на процесс воркера.
 */
const COMMON_FILES = [
  'app',
  'biomes',
  'canvas',
  'conn',
  'dialogs',
  'error',
  'panels',
  'pools',
  'roads',
  'root',
  'shared',
  'variant',
  'zone',
]

const commonCache = new Map<UiLocale, Record<string, unknown>>()

export function commonFor(locale: UiLocale): Record<string, unknown> {
  const hit = commonCache.get(locale)
  if (hit) return hit
  const merged: Record<string, unknown> = {}
  for (const file of COMMON_FILES) {
    Object.assign(merged, readJson(`../../i18n/locales/${locale}/common/${file}.json`))
  }
  commonCache.set(locale, merged)
  return merged
}

export function ruCommon(): Record<string, unknown> {
  return commonFor('ru')
}

/**
 * Строка локали (неймспейс common) по точечному пути: LFor('en', 'app.brand').
 * Бросает при отсутствии ключа — тест не может «на глаз» хардкодить UI-строки
 * (конвенция helpers.ts).
 */
export function LFor(
  locale: UiLocale,
  path: string,
  params?: Record<string, string | number>,
): string {
  let cur: unknown = commonFor(locale)
  for (const key of path.split('.')) {
    if (cur == null || typeof cur !== 'object' || !(key in (cur as Record<string, unknown>))) {
      throw new Error(`В ${locale}-локали (common) нет ключа «${path}» (сбой на «${key}»)`)
    }
    cur = (cur as Record<string, unknown>)[key]
  }
  if (typeof cur !== 'string') throw new Error(`Ключ «${path}» в ${locale}-локали не строка`)
  return params ? interp(cur, params) : cur
}

/**
 * Строка ru-локали (неймспейс common) по точечному пути: L('zone.nameLabel'),
 * L('graph.ctx.duplicateConnection') — шорткат LFor('ru', …).
 */
export function L(path: string, params?: Record<string, string | number>): string {
  return LFor('ru', path, params)
}

/* ------------------------------------------------------------------ */
/* Фикстуры                                                            */
/* ------------------------------------------------------------------ */

export interface SampleFixture {
  /** Разобранный demo-шаблон (для deep-equal и имён/чисел — не хардкодить!). */
  template: RmgTemplate
  zoneCount: number
  connCount: number
  zoneNames: string[]
  /** Абсолютные пути на диске (для filechooser). */
  templatePath: string
  sidecarPath: string
  /** Заведомо не-шаблон (валидный JSON без name/variants) — негативный сценарий. */
  brokenPath: string
}

let fixtureCache: SampleFixture | null = null

/** Демо-пара `src/data/sampleTemplate.json` + sidecar (в git; регенерация — `npm run sample`). */
export function sampleFixture(): SampleFixture {
  if (fixtureCache) return fixtureCache
  const templatePath = fileURLToPath(new URL('../../data/sampleTemplate.json', import.meta.url))
  const sidecarPath = fileURLToPath(new URL('../../data/sampleTemplate.editor.json', import.meta.url))
  const brokenPath = fileURLToPath(new URL('./fixtures/broken.rmg.json', import.meta.url))
  const template = JSON.parse(readFileSync(templatePath, 'utf-8')) as RmgTemplate
  fixtureCache = {
    template,
    zoneCount: template.variants[0].zones.length,
    connCount: template.variants[0].connections.length,
    zoneNames: template.variants[0].zones.map((z) => z.name),
    templatePath,
    sidecarPath,
    brokenPath,
  }
  return fixtureCache
}

/* ------------------------------------------------------------------ */
/* Подготовка состояния страницы                                       */
/* ------------------------------------------------------------------ */

/**
 * Загрузить демо-пару штатным парсером приложения (быстрая подготовка состояния:
 * page.evaluate исполняется в ГЛАВНОМ мире — инстанс store общий с приложением).
 */
export async function loadSampleTemplate(page: Page): Promise<void> {
  await page.evaluate(
    async (a: { store: string; fs: string; tpl: string; sidecar: string; sourceName: string }) => {
      const m = await import(a.store)
      const fs = await import(a.fs)
      const tplRes = await fetch(a.tpl)
      const sideRes = await fetch(a.sidecar)
      if (!tplRes.ok || !sideRes.ok) throw new Error('Демо-фикстура не отдаётся dev-сервером')
      const tpl = fs.parseTemplate(await tplRes.text())
      const side = fs.parseSidecar(await sideRes.text())
      m.useEditorStore.getState().loadTemplate(tpl, a.sourceName, side)
    },
    {
      store: await storeModuleUrl(page),
      fs: FS_MODULE,
      tpl: SAMPLE_TPL_URL,
      sidecar: SAMPLE_SIDE_URL,
      sourceName: SAMPLE_SOURCE_NAME,
    },
  )
}

/** sourceName, с которым демо-пара загружается в тестах (виден в шапке). */
export const SAMPLE_SOURCE_NAME = 'sampleTemplate.json'

/** Загрузить в редактор шаблон из JSON-текста (боевой parseTemplate + loadTemplate). */
export async function loadTemplateFromText(
  page: Page,
  text: string,
  sourceName: string,
): Promise<void> {
  await page.evaluate(
    async (a: { store: string; fs: string; text: string; sourceName: string }) => {
      const m = await import(a.store)
      const fs = await import(a.fs)
      m.useEditorStore.getState().loadTemplate(fs.parseTemplate(a.text), a.sourceName, null)
    },
    { store: await storeModuleUrl(page), fs: FS_MODULE, text, sourceName },
  )
}

/**
 * Удалить нативные FS Access пикеры → supportsFsAccess() = false во всех браузерах
 * (в Chromium они own-свойства window — delete работает; в Firefox/WebKit их нет).
 * Детерминированная ветка «фолбэк»: открытие через input[type=file] (ловится filechooser).
 */
export async function removeFsPickers(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as { showOpenFilePicker?: unknown; showDirectoryPicker?: unknown }
    delete w.showOpenFilePicker
    delete w.showDirectoryPicker
  })
}

/** Клик «Открыть файл» → filechooser → передать файлы (фолбэк-ветка открытия). */
export async function openViaFileFallback(page: Page, filePaths: string[]): Promise<void> {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: ru().app.openFile, exact: true }).click(),
  ])
  await chooser.setFiles(filePaths)
}

/**
 * Подменить showDirectoryPicker на настоящий OPFS-handle: боевой код
 * записи ФС выполняется по-настоящему,
 * но в приватное хранилище происхождения. Ставить ПОСЛЕ загрузки страницы
 * (на document_start navigator.storage ещё undefined). Только Chromium.
 */
export async function installOpfsSaveShim(page: Page, dirName: string): Promise<void> {
  await page.evaluate(async (name: string) => {
    const sub = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, {
      create: true,
    })
    const proxied = new Proxy(sub, {
      get(target, prop) {
        if (prop === 'name') return name
        const value = Reflect.get(target, prop)
        return typeof value === 'function'
          ? (value as (...args: unknown[]) => unknown).bind(target)
          : value
      },
    })
    const w = window as unknown as {
      showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>
    }
    w.showDirectoryPicker = async () => proxied
  }, dirName)
}

/* ------------------------------------------------------------------ */
/* Чтение состояния (страница)                                         */
/* ------------------------------------------------------------------ */

export interface OpfsFileInfo {
  name: string
  size: number
  /** Первые 8 байт (для проверки PNG-подписи). */
  head: number[]
}

/**
 * Список файлов OPFS-папки. Читать через expect.poll (сохранение асинхронно).
 * НЕ бросает: во время конкурентной записи приложения (createWritable + swap-файлы
 * `<имя>.crswap`) итерация каталога может отдать преходящий NotFoundError — такие
 * ошибки глотаются, возвращается частичный список; poll повторит вызов и соберёт
 * полный (expect.poll прерывается на брошенном исключении — поэтому не бросаем).
 */
export async function opfsFiles(page: Page, dirName: string): Promise<OpfsFileInfo[]> {
  return page.evaluate(async (name: string) => {
    const out: { name: string; size: number; head: number[] }[] = []
    try {
      const sub = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, {
        create: true,
      })
      const entries = sub.entries() as unknown as AsyncIterable<[string, FileSystemHandle]>
      try {
        for await (const [entryName, handle] of entries) {
          if (handle.kind !== 'file') continue
          // временные swap-файлы Chromium во время записи — не результат сохранения
          if (entryName.endsWith('.crswap')) continue
          try {
            const file = await (handle as FileSystemFileHandle).getFile()
            const head = [...new Uint8Array(await file.slice(0, 8).arrayBuffer())]
            out.push({ name: entryName, size: file.size, head })
          } catch {
            // файл недоступен в момент параллельной записи — пропустит следующий poll
          }
        }
      } catch {
        // итератор каталога порвался на конкурентной записи — возвращаем частичный список
      }
    } catch {
      // каталог на мгновение недоступен — пустой список заставит poll повторить
    }
    return out
  }, dirName)
}

/** Текст файла из OPFS-папки. */
export async function readOpfsText(
  page: Page,
  dirName: string,
  fileName: string,
): Promise<string> {
  return page.evaluate(
    async (a: { dir: string; file: string }) => {
      const sub = await (await navigator.storage.getDirectory()).getDirectoryHandle(a.dir)
      const file = await (await sub.getFileHandle(a.file)).getFile()
      return file.text()
    },
    { dir: dirName, file: fileName },
  )
}

export interface StoreView {
  dirty: boolean
  pastCount: number
  futureCount: number
  rootName: string | null
  hasDirHandle: boolean
  templateName: string
  /** Имя файла-источника (шапка больше не показывает его: бейдж только после сохранения). */
  sourceName: string | null
  zoneNames: string[]
  positionCount: number
}

/** Срез состояния store приложения (white-box проверки dirty/истории/папки). */
export async function storeState(page: Page): Promise<StoreView> {
  return page.evaluate(async (spec: string) => {
    const m = await import(spec)
    const s = m.useEditorStore.getState()
    return {
      dirty: s.dirty,
      pastCount: s.past.length,
      futureCount: s.future.length,
      rootName: s.rootName,
      hasDirHandle: s.dirHandle != null,
      templateName: s.template.name,
      sourceName: s.sourceName,
      zoneNames: s.template.variants[s.activeVariant].zones.map((z: { name: string }) => z.name),
      positionCount: Object.keys(s.positions[s.activeVariant] ?? {}).length,
    }
  }, await storeModuleUrl(page))
}

export interface ValidationCounts {
  errors: number
  warnings: number
  infos: number
}

/**Ground truth валидатора ВМЕСТЕ со списком замечаний (диагностика расхождений с панелью). */
export interface ValidationReport extends ValidationCounts {
  issues: Array<{ severity: string; code: string; path: string }>
}

export async function validateReport(page: Page): Promise<ValidationReport> {
  return page.evaluate(
    async (a: { store: string; validate: string; catalog: string }) => {
      const m = await import(a.store)
      const v = await import(a.validate)
      const c = await import(a.catalog)
      const cat = await c.loadCatalog()
      const rep = v.validateTemplate(m.useEditorStore.getState().template, {
        poolNames: cat.poolNames,
        listNames: cat.listNames,
      })
      return {
        errors: rep.errors,
        warnings: rep.warnings,
        infos: rep.infos,
        issues: rep.issues.map((i: { severity: string; code: string; path: string }) => ({
          severity: i.severity,
          code: i.code,
          path: i.path,
        })),
      }
    },
    { store: await storeModuleUrl(page), validate: VALIDATE_MODULE, catalog: CATALOG_MODULE },
  )
}

/**
 * Ground truth валидатора: тот же validateTemplate + ленивый каталог пулов,
 * что использует ValidatorPanel. Сверяем чипы панели с этими числами —
 * регрессия панели ловится без хардкода количества правил.
 */
export async function validateTruth(page: Page): Promise<ValidationCounts> {
  return page.evaluate(
    async (a: { store: string; validate: string; catalog: string }) => {
      const m = await import(a.store)
      const v = await import(a.validate)
      const c = await import(a.catalog)
      const cat = await c.loadCatalog()
      const rep = v.validateTemplate(m.useEditorStore.getState().template, {
        poolNames: cat.poolNames,
        listNames: cat.listNames,
      })
      return { errors: rep.errors, warnings: rep.warnings, infos: rep.infos }
    },
    { store: await storeModuleUrl(page), validate: VALIDATE_MODULE, catalog: CATALOG_MODULE },
  )
}

/** Сырой снапшот сессии из localStorage (null — не записан). */
export async function sessionSnapshotRaw(page: Page): Promise<string | null> {
  return page.evaluate((key: string) => localStorage.getItem(key), SESSION_KEY)
}

/* ------------------------------------------------------------------ */
/* Локаторы и наблюдения                                               */
/* ------------------------------------------------------------------ */

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Узел канвы конкретной зоны (точное совпадение имени, без .first()-фокусов). */
export function zoneNode(page: Page, name: string): Locator {
  return page
    .locator('.react-flow__node')
    .filter({
      has: page.locator('.zone-node__name', { hasText: new RegExp(`^${escapeRegExp(name)}$`) }),
    })
}

/** Дождаться, что канва отрисовала зоны и связи (web-first, авторетри). */
export async function waitForCanvas(
  page: Page,
  zoneCount: number,
  connCount: number,
): Promise<void> {
  await expect(page.locator('.react-flow__node')).toHaveCount(zoneCount)
  await expect(page.locator('.react-flow__edge')).toHaveCount(connCount)
}

/**
 * Сборщик ошибок консоли страницы: вернуть массив в начале теста, в конце
 * проверить expect(errors).toEqual([]) — регрессии не должны шуметь в консоль.
 */
export function watchConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}
