import type { IssueCode, ScopeCode } from '../../../../utils/validate'
import issuesConnection from './issues/connection.json'
import issuesRoad from './issues/road.json'
import issuesRoot from './issues/root.json'
import issuesVariant from './issues/variant.json'
import issuesZone from './issues/zone.json'
import scope from './scope.json'

/**
 * Неймспейс `validator` локали `en`: зеркало locales/ru/validator —
 * `scope` — подписи областей замечаний (ScopeCode), `issues/*` — тексты
 * замечаний по группам IssueCode (раскладка файлов — как в ru).
 *
 * Компиляторная проверка исчерпаемости переводов — как на стороне ru:
 * новый код в IssueCode/ScopeCode без перевода в файлах en/validator/
 * ломает `npm run build`.
 */
export const EN_ISSUES: Record<IssueCode, string> = {
  ...issuesRoot,
  ...issuesVariant,
  ...issuesConnection,
  ...issuesZone,
  ...issuesRoad,
}
export const EN_SCOPES: Record<ScopeCode, string> = scope

export const enValidator = { scope: EN_SCOPES, issues: EN_ISSUES }
