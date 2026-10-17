import type { Connection, Variant, Zone } from '../types/rmg'

/**
 * Сравнение двух вариантов шаблона — чистая функция без зависимостей
 * (по образцу validate.ts). Возвращает данные без подписей: имена полей —
 * JSON-ключи, значения — строковые представления; переводит UI-слой.
 *
 * Два уровня диффа:
 * - сущность (зона / связь): added | removed | changed;
 * - поле сущности: scalar (со значениями old → new) или complex
 *   (массивы/объекты — только факт изменения и счётчик элементов).
 *
 * Ключи сущностей: зоны — по name; связи — по неупорядоченной паре from↔to
 * (разворот направления связи даёт changed-поля from/to, а не added+removed).
 * Корневые поля варианта (orientation, border) — плоский полевой дифф.
 */

export type FieldDiffKind = 'scalar' | 'complex'

export interface FieldDiff {
  /** Имя поля (JSON-ключ) или путь (`orientation.mode`, `border.waterWidth`) */
  field: string
  kind: FieldDiffKind
  /** scalar: строковое представление значения; undefined — поле отсутствует */
  oldValue?: string
  newValue?: string
  /** complex: число элементов массива; undefined — поле отсутствует или не массив */
  oldCount?: number
  newCount?: number
}

export type EntityDiffStatus = 'added' | 'removed' | 'changed'

export interface EntityDiff {
  kind: 'zone' | 'connection'
  /**
   * id сущности в варианте A для навигации (zone.name / connection
   * `name ?? from-to`) — формат store.findZone/findConnection.
   * Для added (нет в A) — null: фокусировать на канве нечего.
   */
  idA: string | null
  /** Отображаемая подпись (для связи — `from → to` варианта A либо B) */
  label: string
  status: EntityDiffStatus
  /** Изменённые поля; для added/removed — пустой список */
  fields: FieldDiff[]
}

export interface VariantDiff {
  /** Полевой дифф корневых полей варианта (orientation.*, border.*) */
  rootFields: FieldDiff[]
  zones: EntityDiff[]
  connections: EntityDiff[]
  identical: boolean
}

/** Скаляр — то, что показываем значениями old → new. */
function isScalar(v: unknown): boolean {
  return v === undefined || v === null || typeof v !== 'object'
}

/** Устойчивое сравнение значений (порядок ключей объекта не важен). */
function stableStringify(v: unknown): string {
  if (v === undefined) return 'undefined'
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  const obj = v as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

function scalarText(v: unknown): string | undefined {
  if (v === undefined) return undefined
  return String(v)
}

/** Порядок вывода полей: известные поля схемы — по порядку, остальные — по алфавиту. */
function unionKeys(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  order: readonly string[],
): string[] {
  const present = new Set([...Object.keys(a), ...Object.keys(b)])
  const ordered = order.filter((k) => present.has(k))
  const rest = [...present].filter((k) => !order.includes(k)).sort()
  return [...ordered, ...rest]
}

/** Общий полевой дифф двух плоских записей. */
function diffFields(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  order: readonly string[],
  skip: readonly string[],
): FieldDiff[] {
  const out: FieldDiff[] = []
  for (const field of unionKeys(a, b, order)) {
    if (skip.includes(field)) continue
    const va = a[field]
    const vb = b[field]
    if (stableStringify(va) === stableStringify(vb)) continue
    if (isScalar(va) && isScalar(vb)) {
      out.push({ field, kind: 'scalar', oldValue: scalarText(va), newValue: scalarText(vb) })
    } else {
      out.push({
        field,
        kind: 'complex',
        oldCount: Array.isArray(va) ? va.length : undefined,
        newCount: Array.isArray(vb) ? vb.length : undefined,
      })
    }
  }
  return out
}

/** Порядок полей Zone/Connection по src/types/rmg.ts (name зоны — ключ, пропускается). */
const ZONE_FIELD_ORDER = [
  'size',
  'layout',
  'mainObjects',
  'zoneBiome',
  'contentBiome',
  'metaObjectsBiome',
  'roads',
  'mandatoryContent',
  'contentCountLimits',
  'crossroadsPosition',
  'guardedContentValue',
  'guardedContentValuePerArea',
  'unguardedContentValue',
  'unguardedContentValuePerArea',
  'resourcesValue',
  'resourcesValuePerArea',
  'guardedContentPool',
  'unguardedContentPool',
  'resourcesContentPool',
  'guardCutoffValue',
  'guardMultiplier',
  'guardRandomization',
  'guardWeeklyIncrement',
  'guardReactionDistribution',
  'diplomacyModifier',
  'randomHireInitialUnitIncrement',
  'randomHireEnableWeeklyUnitIncrement',
  'encounterHolesSettings',
] as const

const CONN_FIELD_ORDER = [
  'name',
  'from',
  'to',
  'connectionType',
  'guardValue',
  'guardWeeklyIncrement',
  'guardRandomization',
  'guardZone',
  'guardMatchGroup',
  'guardEscape',
  'road',
  'simTurnSquad',
  'gatePlacement',
  'gatePlacementArgs',
  'portalPlacementRulesFrom',
  'portalPlacementRulesTo',
  'length',
] as const

/** Плоское представление корневых полей варианта: `orientation.mode` и т.п. */
const ROOT_FIELD_ORDER = [
  'orientation.mode',
  'orientation.baseAngleMin',
  'orientation.baseAngleMax',
  'orientation.randomAngleAmplitude',
  'orientation.randomAngleStep',
  'orientation.zeroAngleZone',
  'border.cornerRadius',
  'border.obstaclesWidth',
  'border.obstaclesNoise',
  'border.waterWidth',
  'border.waterNoise',
  'border.waterType',
] as const

function flattenRoot(v: Variant): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (v.orientation) {
    for (const [k, val] of Object.entries(v.orientation)) out[`orientation.${k}`] = val
  }
  if (v.border) {
    for (const [k, val] of Object.entries(v.border)) out[`border.${k}`] = val
  }
  return out
}

function connId(c: Connection): string {
  return c.name ?? `${c.from}-${c.to}`
}

function connPairKey(from: string, to: string): string {
  return from <= to ? `${from}\u0000${to}` : `${to}\u0000${from}`
}

function connLabel(c: Connection): string {
  return `${c.from} → ${c.to}`
}

/** Сравнение двух вариантов: A — базовый (активный), B — сравниваемый. */
export function variantDiff(a: Variant, b: Variant): VariantDiff {
  const rootFields = diffFields(flattenRoot(a), flattenRoot(b), ROOT_FIELD_ORDER, [])

  // Зоны: ключ — name (первая при дублях; дубли — забота валидатора).
  // Слаботипизированный файл: zones/connections могут отсутствовать — пустой список.
  const zonesA = new Map<string, Zone>()
  for (const z of a.zones ?? []) if (!zonesA.has(z.name)) zonesA.set(z.name, z)
  const zonesB = new Map<string, Zone>()
  for (const z of b.zones ?? []) if (!zonesB.has(z.name)) zonesB.set(z.name, z)

  const zones: EntityDiff[] = []
  for (const [name, za] of zonesA) {
    const zb = zonesB.get(name)
    if (!zb) {
      zones.push({ kind: 'zone', idA: name, label: name, status: 'removed', fields: [] })
      continue
    }
    const fields = diffFields(
      za as unknown as Record<string, unknown>,
      zb as unknown as Record<string, unknown>,
      ZONE_FIELD_ORDER,
      ['name'],
    )
    if (fields.length > 0) {
      zones.push({ kind: 'zone', idA: name, label: name, status: 'changed', fields })
    }
  }
  for (const name of zonesB.keys()) {
    if (!zonesA.has(name)) {
      zones.push({ kind: 'zone', idA: null, label: name, status: 'added', fields: [] })
    }
  }

  // Связи: ключ — неупорядоченная пара from↔to.
  const connsA = new Map<string, Connection>()
  for (const c of a.connections ?? []) {
    const key = connPairKey(c.from, c.to)
    if (!connsA.has(key)) connsA.set(key, c)
  }
  const connsB = new Map<string, Connection>()
  for (const c of b.connections ?? []) {
    const key = connPairKey(c.from, c.to)
    if (!connsB.has(key)) connsB.set(key, c)
  }

  const connections: EntityDiff[] = []
  for (const [key, ca] of connsA) {
    const cb = connsB.get(key)
    if (!cb) {
      connections.push({
        kind: 'connection',
        idA: connId(ca),
        label: connLabel(ca),
        status: 'removed',
        fields: [],
      })
      continue
    }
    const fields = diffFields(
      ca as unknown as Record<string, unknown>,
      cb as unknown as Record<string, unknown>,
      CONN_FIELD_ORDER,
      [],
    )
    if (fields.length > 0) {
      connections.push({
        kind: 'connection',
        idA: connId(ca),
        label: connLabel(ca),
        status: 'changed',
        fields,
      })
    }
  }
  for (const [key, cb] of connsB) {
    if (!connsA.has(key)) {
      connections.push({
        kind: 'connection',
        idA: null,
        label: connLabel(cb),
        status: 'added',
        fields: [],
      })
    }
  }

  return {
    rootFields,
    zones,
    connections,
    identical: rootFields.length === 0 && zones.length === 0 && connections.length === 0,
  }
}

/** Поиск диффа сущности по id варианта A (для бейджа инспектора). */
export function findEntityDiff(
  diff: VariantDiff,
  kind: 'zone' | 'connection',
  idA: string,
): EntityDiff | undefined {
  const list = kind === 'zone' ? diff.zones : diff.connections
  return list.find((e) => e.idA === idA)
}
