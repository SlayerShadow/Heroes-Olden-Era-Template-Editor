import { enCommon } from './locales/en/common'
import { enValidator } from './locales/en/validator'
import { ruCommon } from './locales/ru/common'
import { ruValidator } from './locales/ru/validator'

/**
 * Ресурсы i18next: неймспейсы common (UI) и validator (коды замечаний).
 * Локали разбиты по доменным файлам (карта структуры — locales/ru/README.md;
 * en зеркалит раскладку ru — locales/en/README.md). Компиляторная проверка
 * исчерпаемости переводов валидатора (Record<IssueCode | ScopeCode, string>)
 * живёт в locales/{ru,en}/validator/index.ts, целостность сборки ресурсов —
 * в тесте src/i18n/locales.test.ts.
 */
export const resources = {
  ru: {
    common: ruCommon,
    validator: ruValidator,
  },
  en: {
    common: enCommon,
    validator: enValidator,
  },
}
