import app from './app.json'
import biomes from './biomes.json'
import canvas from './canvas.json'
import conn from './conn.json'
import dialogs from './dialogs.json'
import error from './error.json'
import panels from './panels.json'
import pools from './pools.json'
import roads from './roads.json'
import root from './root.json'
import shared from './shared.json'
import variant from './variant.json'
import zone from './zone.json'

/**
 * Неймспейс `common`: сливается из доменных файлов, каждый владеет своими
 * верхнеуровневыми группами ключей (файл ↔ группы):
 *
 * - app.json     — app, locale, fs, store, toasts        (обвязка: шапка, файловые ошибки, тосты)
 * - biomes.json  — biomes                                (словарь имён биомов и слоёв: чипы, легенда, узлы канвы)
 * - dialogs.json — manual, pick, preview, confirm        (модальные окна)
 * - panels.json  — sidebar, inspector, tree, compare, validator (боковые панели)
 * - canvas.json  — graph, zoneNode, edge, legend, mcPoint (схема шаблона на canvas)
 * - shared.json  — fields, jsonEditor, mcRules           (сквозные компоненты: поля, JSON-редактор, правила)
 * - zone.json    — zone                                  (инспектор зоны)
 * - conn.json    — conn                                  (инспектор связи)
 * - variant.json — variant                               (панель варианта карты)
 * - root.json    — root, rootPanels                       (корень шаблона: параметры, группы контента)
 * - roads.json   — roads, roadEnd                        (дороги)
 * - pools.json   — pools, poolList, poolTags, poolNames  (пулы контента)
 * - error.json   — error                                 (экран краша рендера: ErrorBoundary)
 *
 * Целостность сборки (нет потерянных и задвоенных ключей) проверяет
 * тест `src/i18n/locales.test.ts`. Порядок spread'ов задаёт порядок
 * верхнеуровневых ключей ресурса — на семантику не влияет.
 */
export const ruCommon = {
  ...app,
  ...biomes,
  ...dialogs,
  ...panels,
  ...canvas,
  ...shared,
  ...zone,
  ...conn,
  ...variant,
  ...root,
  ...roads,
  ...pools,
  ...error,
}
