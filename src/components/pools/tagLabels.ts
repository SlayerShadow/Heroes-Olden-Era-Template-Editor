// Перевод кодов тегов пула (utils/pools) и humanized-подписей имён
// (utils/poolNames) в строки интерфейса через i18next.
// Слой utils/ чистый и возвращает коды/части — переводит этот UI-хелпер.
import type { PoolNamePart } from '../../utils/poolNames'
import { humanizePoolName, UNITS_BANK_SID } from '../../utils/poolNames'
import { sidHint, type SidNameLang } from '../../data/sidCatalog'

const TRANSLATABLE_TAG = /^(?:kind|guard|profile)\./

export type TranslateFn = (key: string) => string

export function translatePoolTags(codes: string[], t: TranslateFn): string {
  return codes.map((c) => (TRANSLATABLE_TAG.test(c) ? t(`poolTags.${c}`) : c)).join(' · ')
}

/** Интерполяция {{param}} без опций i18next — t остаётся с простой сигнатурой. */
function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s
  return s.replace(/\{\{(\w+)\}\}/g, (m, k: string) =>
    k in params ? String(params[k]) : m,
  )
}

/** Собрать строку-подпись из частей humanizePoolName. lang — язык каталога имён sid (банков). */
export function poolNameLabel(parts: PoolNamePart[], t: TranslateFn, lang: SidNameLang = 'ru'): string {
  const segs = parts.map((p) => {
    if (p.type === 'text') return p.text
    if (p.type === 'i18n') return interpolate(t(p.key), p.params)
    const name = (i: number) => sidHint(UNITS_BANK_SID[i], lang) ?? t('poolNames.bankFallback').replace('{{n}}', String(i))
    return interpolate(t('poolNames.bankPair'), { a: name(p.a), b: name(p.b) })
  })
  const label = segs.join(' · ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Подпись имени пула/списка на языке каталога; null — имя не распознано (показывать сырое). */
export function humanPoolName(name: string, t: TranslateFn, lang: SidNameLang = 'ru'): string | null {
  const parts = humanizePoolName(name)
  return parts ? poolNameLabel(parts, t, lang) : null
}
