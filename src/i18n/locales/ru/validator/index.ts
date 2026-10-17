import type { IssueCode, ScopeCode } from '../../../../utils/validate'
import issuesConnection from './issues/connection.json'
import issuesRoad from './issues/road.json'
import issuesRoot from './issues/root.json'
import issuesVariant from './issues/variant.json'
import issuesZone from './issues/zone.json'
import scope from './scope.json'

/**
 * Неймспейс `validator`: `scope` — подписи областей замечаний (ScopeCode),
 * `issues/*` — тексты замечаний по группам IssueCode (файл ↔ группы кодов):
 *
 * - issues/root.json       — корень шаблона: общее, группы контента, valueOverrides/
 *                            globalBans/gameRules, zoneLayouts
 * - issues/variant.json    — вариант карты + ориентация макета (orientation*) и
 *                            граница карты (border*) — emit'ятся с group 'variant'
 * - issues/connection.json — связи (conn*)
 * - issues/zone.json       — зоны: ссылки (zoneRef*), поля зоны, правила групп (mcGroupRule*)
 * - issues/road.json       — дороги (road*)
 *
 * Целостность сборки (нет потерянных и задвоенных кодов) проверяет тест
 * `src/i18n/locales.test.ts`.
 */

// Компиляторная проверка исчерпаемости переводов валидатора:
// новый код в IssueCode/ScopeCode без перевода в файлах ru/validator/ ломает `npm run build`.
export const RU_ISSUES: Record<IssueCode, string> = {
  ...issuesRoot,
  ...issuesVariant,
  ...issuesConnection,
  ...issuesZone,
  ...issuesRoad,
}
export const RU_SCOPES: Record<ScopeCode, string> = scope

export const ruValidator = { scope: RU_SCOPES, issues: RU_ISSUES }
