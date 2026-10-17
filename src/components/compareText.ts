import type { FieldDiff } from '../utils/variantDiff'

/** Минимальная сигнатура i18next `t` (по образцу fsAccess.fsErrorMessage). */
export type Translate = (key: string, opts?: Record<string, unknown>) => string

/**
 * Значение FieldDiff как текст: скаляры — «old → new» («—» для отсутствующего
 * поля), массивы — счётчики «0 → 2», объекты без счётчика — «изменено».
 * Общий для ComparePanel и бейджа инспектора.
 */
export function fieldDiffText(d: FieldDiff, t: Translate): string {
  if (d.kind === 'scalar') {
    return `${d.oldValue ?? t('compare.absent')} → ${d.newValue ?? t('compare.absent')}`
  }
  if (d.oldCount !== undefined || d.newCount !== undefined) {
    return `${d.oldCount ?? 0} → ${d.newCount ?? 0}`
  }
  return t('compare.changed')
}

/** Краткая сводка изменённых полей: «size: 1 → 1.5, roads: 0 → 2». */
export function fieldsSummary(fields: FieldDiff[], t: Translate): string {
  return fields.map((f) => `${f.field}: ${fieldDiffText(f, t)}`).join(', ')
}

/** Подробная сводка (tooltip): каждое поле с новой строки. */
export function fieldsDetail(fields: FieldDiff[], t: Translate): string {
  return fields.map((f) => `${f.field}: ${fieldDiffText(f, t)}`).join('\n')
}
