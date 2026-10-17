import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources'

export interface SupportedLocale {
  /** Код локали (BCP-47 base subtag, например 'ru'). */
  code: string
  /** Самоназвание языка для селектора (не переводится). */
  label: string
}

/** Доступные локали интерфейса; ru — источник истины, en — зеркальный перевод. */
export const SUPPORTED_LOCALES: SupportedLocale[] = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
]

/** Ключ localStorage с выбранной локалью (по образцу oe-editor.panel.*). */
export const LOCALE_LS_KEY = 'oe-editor.locale'

/**
 * Фолбэк недостающих переводов i18next: ru — источник истины (en зеркалит его
 * ключ в ключ и может отставать — пропущенный en-ключ лучше показать по-русски,
 * чем сырым ключом).
 */
const FALLBACK_LOCALE = 'ru'

/** Локаль по умолчанию, когда язык браузера не ru/en (детект, не fallbackLng). */
const DETECT_FALLBACK = 'en'

function readStoredLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_LS_KEY)
  } catch {
    /* localStorage может быть недоступен (Node/тесты, приватный режим) */
    return null
  }
}

export function storeLocale(code: string): void {
  try {
    localStorage.setItem(LOCALE_LS_KEY, code)
  } catch {
    /* localStorage может быть недоступен — просто не запоминаем выбор */
  }
}

function browserLocale(): string | null {
  if (typeof navigator === 'undefined') return null
  const langs = navigator.languages && navigator.languages.length > 0 ? navigator.languages : [navigator.language]
  for (const full of langs) {
    if (typeof full !== 'string') continue
    const base = full.toLowerCase().split('-')[0]
    const hit = SUPPORTED_LOCALES.find((l) => l.code === base)
    if (hit) return hit.code
  }
  return null
}

/**
 * Выбор локали: сохранённая в localStorage → язык браузера (ru/en) → фолбэк en.
 * Результат детекта намеренно НЕ пишется в localStorage: выбор запоминается
 * только при явном действии пользователя (setLocale из селектора).
 */
export function detectLocale(): string {
  const stored = readStoredLocale()
  if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) return stored
  return browserLocale() ?? DETECT_FALLBACK
}

function applyDocumentLang(code: string): void {
  if (typeof document !== 'undefined') document.documentElement.lang = code
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLocale(),
  fallbackLng: FALLBACK_LOCALE,
  supportedLngs: SUPPORTED_LOCALES.map((l) => l.code),
  ns: ['common', 'validator'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

applyDocumentLang(i18n.language)

/**
 * Смена локали интерфейса (действие пользователя): i18next + localStorage +
 * <html lang>. Перезагрузка страницы не нужна — react-i18next перерисовывает
 * UI по событию languageChanged.
 */
export function setLocale(code: string): void {
  storeLocale(code)
  applyDocumentLang(code)
  void i18n.changeLanguage(code)
}

export default i18n
