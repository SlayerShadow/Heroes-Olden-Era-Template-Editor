import type { RmgTemplate, Variant } from '../types/rmg'

/**
 * Чистые функции «умного» JSON-редактора: разбор текста, проверка формы
 * черновика и композиция/декомпозиция корневого JSON шаблона.
 * UI-слой (JsonEditor.tsx) переводит коды ошибок через `jsonEditor.errors.*`.
 */

/** Коды ошибок черновика JSON (переводятся на слое UI). */
export type JsonErrorCode =
  | 'syntax' // JSON.parse бросил исключение
  | 'notObject' // результат — не объект
  | 'zoneNameMissing' // зона: нет непустого name
  | 'zoneNameTaken' // зона: имя занято другой зоной варианта
  | 'connEndpointsMissing' // связь: from/to — не непустые строки
  | 'connTypeMissing' // связь: connectionType — не непустая строка
  | 'connNotFound' // связь: применение не нашло связь в активном варианте
  | 'rootNameMissing' // шаблон: нет непустого name
  | 'rootVariantsMismatch' // шаблон: variants[] отсутствует или другой длины

export interface JsonDraftError {
  code: JsonErrorCode
  /** Деталь для подстановки в перевод (имя, число вариантов, текст SyntaxError). */
  detail?: string
}

export type JsonResult<T> = { ok: true; value: T } | { ok: false; error: JsonDraftError }

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** Разбор текста черновика; SyntaxError возвращается как { code: 'syntax' }. */
export function parseJson(text: string): JsonResult<unknown> {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    return { ok: false, error: { code: 'syntax', detail: e instanceof Error ? e.message : String(e) } }
  }
}

/**
 * Проверка формы черновика зоны. `takenNames` — имена других зон активного
 * варианта (без редактируемой): переименование в занятое имя блокируется.
 */
export function validateZoneDraft(value: unknown, takenNames?: Iterable<string>): JsonDraftError | null {
  if (!isRecord(value)) return { code: 'notObject' }
  if (typeof value.name !== 'string' || !value.name.trim()) return { code: 'zoneNameMissing' }
  if (takenNames) {
    for (const n of takenNames) {
      if (n === value.name) return { code: 'zoneNameTaken', detail: value.name }
    }
  }
  return null
}

/** Проверка формы черновика связи: from/to/connectionType обязательны. */
export function validateConnDraft(value: unknown): JsonDraftError | null {
  if (!isRecord(value)) return { code: 'notObject' }
  if (typeof value.from !== 'string' || !value.from || typeof value.to !== 'string' || !value.to) {
    return { code: 'connEndpointsMissing' }
  }
  if (typeof value.connectionType !== 'string' || !value.connectionType) {
    return { code: 'connTypeMissing' }
  }
  return null
}

/** Проверка формы черновика шаблона (без зон/связей). */
export function validateRootDraft(value: unknown, variantsCount: number): JsonDraftError | null {
  if (!isRecord(value)) return { code: 'notObject' }
  if (typeof value.name !== 'string' || !value.name.trim()) return { code: 'rootNameMissing' }
  if (!Array.isArray(value.variants) || value.variants.length !== variantsCount) {
    return { code: 'rootVariantsMismatch', detail: String(variantsCount) }
  }
  return null
}

/**
 * JSON шаблона без зон и связей (они редактируются на канве):
 * variants[] сохраняют orientation/border и прочие поля варианта.
 */
export function rootJsonView(template: RmgTemplate): unknown {
  return {
    ...template,
    variants: (template.variants ?? []).map((v) => variantJsonView(v)),
  }
}

function variantJsonView(v: Variant): unknown {
  const { zones: _zones, connections: _connections, ...rest } = v ?? {}
  return rest
}

/**
 * Обратная сборка: зоны и связи текущего шаблона подставляются в разобранный
 * JSON (порядок и количество вариантов уже проверены validateRootDraft).
 */
export function mergeRootJson(parsed: RmgTemplate, current: RmgTemplate): RmgTemplate {
  const variants: Variant[] = (parsed.variants ?? []).map((v, i) => ({
    ...v,
    zones: current.variants[i]?.zones ?? [],
    connections: current.variants[i]?.connections ?? [],
  }))
  return { ...parsed, variants }
}
