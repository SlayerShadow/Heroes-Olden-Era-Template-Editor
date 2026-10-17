import type { RmgTemplate } from '../types/rmg'
import type { Point } from './graph'

/**
 * Снапшот сессии — аварийная копия текущего состояния редактора в localStorage.
 *
 * Назначение: защита от потери работы при случайном обновлении страницы или
 * закрытии вкладки. Снапшот зеркалит ТЕКУЩЕЕ состояние шаблона каким бы
 * «неправильным» оно ни было (редактор регулярно проходит через невалидные
 * промежуточные состояния) — поэтому проверка структуры минимальная: шаблон
 * должен быть объектом с `name` и `variants`, остальное нормализуется мягко.
 *
 * История undo/redo намеренно НЕ сохраняется — при восстановлении сбрасывается.
 * `dirHandle` (папка сохранения) не сериализуем в принципе — после восстановления
 * сохранение снова спросит папку.
 *
 * Слой чистый: только (де)сериализация, без доступа к localStorage (его читает/пишет store).
 */

/** Версия формата снапшота: при изменении схемы данных старый снапшот отбрасывается. */
export const SNAPSHOT_VERSION = 1

/** Состояние, сохраняемое в снапшот (всё, что нужно для бесшовного продолжения работы). */
export interface SessionSnapshot {
  version: number
  template: RmgTemplate
  /** Позиции узлов по вариантам (sidecar-данные, в .rmg.json не входят). */
  positions: Record<string, Point>[]
  /** Заметки по зонам (sidecar-данные). */
  notes: Record<string, string>
  /** Раскладка свёрнутых секций инспектора. */
  sectionStates: Record<string, boolean>
  activeVariant: number
  /** Имя файла, из которого загружен шаблон (null — новый). */
  sourceName: string | null
  /** Есть несохранённые на диск изменения (на момент записи снапшота). */
  dirty: boolean
  /**
   * Момент записи снапшота (epoch мс); null/отсутствует — неизвестен (старый
   * формат). При восстановлении показывается в тосте «на момент HH:MM», чтобы
   * тихий откат к устаревшей копии был сразу виден пользователю.
   */
  savedAt?: number | null
}

/** Вход сериализации — поля состояния store, которые попадают в снапшот. */
export type SnapshotSource = Omit<SessionSnapshot, 'version'>

/** Сериализовать состояние в JSON-строку снапшота. */
export function serializeSnapshot(src: SnapshotSource): string {
  const snap: SessionSnapshot = { version: SNAPSHOT_VERSION, ...src }
  return JSON.stringify(snap)
}

/**
 * Разобрать JSON-строку снапшота. Возвращает null, если строка пуста/бита,
 * версия не совпадает или template не похож на шаблон (не объект, нет
 * `variants`) — тогда редактор стартует пустым шаблоном, как обычно.
 * Остальные поля нормализуются мягко: битые значения заменяются дефолтами.
 */
export function parseSnapshot(text: string | null | undefined): SessionSnapshot | null {
  if (!text) return null
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const rec = data as Record<string, unknown>
  if (rec.version !== SNAPSHOT_VERSION) return null
  const template = rec.template
  if (!template || typeof template !== 'object') return null
  const tpl = template as RmgTemplate
  if (typeof tpl.name !== 'string' || !Array.isArray(tpl.variants)) return null
  const variantCount = tpl.variants.length
  return {
    version: SNAPSHOT_VERSION,
    template: tpl,
    positions: sanitizePositions(rec.positions, variantCount),
    notes: sanitizeNotes(rec.notes),
    sectionStates: sanitizeSectionStates(rec.sectionStates),
    activeVariant: sanitizeActiveVariant(rec.activeVariant, variantCount),
    sourceName: typeof rec.sourceName === 'string' ? rec.sourceName : null,
    dirty: rec.dirty === true,
    savedAt: sanitizeSavedAt(rec.savedAt),
  }
}

/** Момент записи: конечное число (epoch мс), иначе null (старые снапшоты حفظены без него). */
function sanitizeSavedAt(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

/** Позиции: массив слотов по вариантам; битые/лишние значения отбрасываются, недостающие слоты — пустые. */
function sanitizePositions(raw: unknown, count: number): Record<string, Point>[] {
  const arr = Array.isArray(raw) ? raw : []
  const out: Record<string, Point>[] = []
  for (let i = 0; i < count; i++) {
    const entry = arr[i]
    const map: Record<string, Point> = {}
    if (entry && typeof entry === 'object') {
      for (const [key, val] of Object.entries(entry as Record<string, unknown>)) {
        if (!val || typeof val !== 'object') continue
        const { x, y } = val as Point
        if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
          map[key] = { x, y }
        }
      }
    }
    out.push(map)
  }
  return out
}

/** Заметки: объект имяЗоны→текст; всё остальное игнорируется. */
function sanitizeNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof val === 'string') out[key] = val
  }
  return out
}

/** Раскладка секций: объект ключ→boolean; всё остальное игнорируется. */
function sanitizeSectionStates(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof val === 'boolean') out[key] = val
  }
  return out
}

/** Индекс активного варианта: конечное число в диапазоне [0, variants.length-1], иначе 0. */
function sanitizeActiveVariant(raw: unknown, variantCount: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  const idx = Math.floor(raw)
  if (variantCount <= 0) return 0
  return Math.max(0, Math.min(idx, variantCount - 1))
}
