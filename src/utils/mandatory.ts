import type { Connection, MandatoryContentGroup, MandatoryContentItem, McRule, Variant, Zone } from '../types/rmg'
import type { Point, ResolvedNode } from './roads'
import { borderPoint, connId } from './roads'

/**
 * Геометрия слоя mandatoryContent для канвы (режим «Контент»).
 * Чистые функции без зависимостей от React — покрыты unit-тестами.
 *
 * Каждый элемент обязательного контента зоны — точка на канве; правила
 * размещения (rules[]: Road/MainObject/Crossroads/Sid/Connection) — кольца
 * вокруг цели: targetMin/targetMax — нормализованное расстояние до цели
 * (доля радиуса зоны), рисуется как кольцевая полоса.
 */

/** Радиус зоны для нормировки расстояний rules (доля от минимума размеров). */
export function zoneMcRadius(box: ResolvedNode): number {
  return Math.min(box.width, box.height) / 2
}

/** Золотой угол — непериодическая раскладка точек Crossroads по кругу. */
const GOLDEN = 2.39996

interface FlatItem {
  group: MandatoryContentGroup
  item: MandatoryContentItem
  index: number
}

export interface McRing {
  /** Тип правила (Road/MainObject/Crossroads/Sid/Connection). */
  ruleType: string
  /** Центр кольца в flow-координатах. */
  center: Point
  /** Внутренний/внешний радиус кольца (flow-единицы): targetMin/Max × радиус зоны. */
  rMin: number
  rMax: number
  /** Цель не найдена/не резолвится (Road — дорога генерируется, битый Sid/связь). */
  resolved: boolean
}

export interface McPoint {
  /** Имя зоны, которой принадлежит элемент. */
  zoneName: string
  /** Имя корневой группы mandatoryContent. */
  groupName: string
  /** Индекс элемента внутри группы. */
  index: number
  item: MandatoryContentItem
  /** Подпись точки: name_* → sid; undefined — UI рисует «элемент {{n}}» (common:mcPoint.elementFallback). */
  label?: string
  /** Положение точки (flow-координаты). */
  point: Point
  /** Цель размещения (если позиция выведена из правила) — линия-связка на канве. */
  axis?: Point
  /** Кольца правил размещения. */
  rings: McRing[]
  /** Локале-нейтральные описания правил (тип + аргументы + радиус) — тултип собирает UI. */
  rulesDesc: string[]
}

const norm = (v: Point): Point => {
  const l = Math.hypot(v.x, v.y)
  if (l === 0) return { x: 1, y: 0 }
  return { x: v.x / l, y: v.y / l }
}

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const addDir = (a: Point, dir: Point, dist: number): Point => ({ x: a.x + dir.x * dist, y: a.y + dir.y * dist })

/** Средняя дистанция правила (доля радиуса зоны) или null, если не задана. */
function ruleDistance(rule: McRule): number | null {
  if (rule.targetMin != null || rule.targetMax != null) {
    return ((rule.targetMin ?? rule.targetMax ?? 0) + (rule.targetMax ?? rule.targetMin ?? 0)) / 2
  }
  if (rule.target != null) return rule.target
  return null
}

/** Полоса кольца правила в flow-единицах. */
function ruleBand(rule: McRule, zoneR: number): { rMin: number; rMax: number } {
  if (rule.targetMin != null || rule.targetMax != null) {
    return {
      rMin: (rule.targetMin ?? rule.targetMax ?? 0) * zoneR,
      rMax: (rule.targetMax ?? rule.targetMin ?? 0) * zoneR,
    }
  }
  const t = rule.target ?? 0
  return { rMin: t * zoneR, rMax: t * zoneR }
}

/** Якорь главного объекта на верхней грани узла (как roads.mainObjectAnchor). */
function mainObjectAnchor(zone: Zone, box: ResolvedNode, idx: number): Point {
  const count = zone.mainObjects?.length ?? 0
  const i = count > 0 ? Math.min(idx, count - 1) : 0
  const f = count <= 1 ? 0.5 : 0.15 + (0.7 * i) / (count - 1)
  return { x: box.center.x + (f - 0.5) * box.width, y: box.center.y - box.height / 2 }
}

/** Якорь связи — точка на грани узла в сторону зоны-соседа; null, если связь не найдена. */
function connectionAnchor(
  rule: McRule,
  zone: Zone,
  box: ResolvedNode,
  conns: Connection[],
  nodes: Map<string, ResolvedNode>,
): Point | null {
  const arg = rule.args?.[0]
  if (arg == null) return null
  const conn = conns.find((c) => connId(c) === String(arg))
  if (!conn) return null
  const other = zone.name === conn.from ? conn.to : zone.name === conn.to ? conn.from : undefined
  if (other === undefined) return null
  const toward = nodes.get(other)?.center
  if (!toward) return null
  return borderPoint(box.center, box.width, box.height, toward)
}

/** Позиция точки: первое разрешимое правило; фолбэк — круговая раскладка от центра. */
function placePoint(
  item: MandatoryContentItem,
  zone: Zone,
  box: ResolvedNode,
  zoneR: number,
  k: number,
  n: number,
  conns: Connection[],
  nodes: Map<string, ResolvedNode>,
): { point: Point; axis?: Point } {
  for (const rule of item.rules ?? []) {
    const d = (ruleDistance(rule) ?? 0.5) * zoneR
    switch (rule.type) {
      case 'Crossroads': {
        const ang = k * GOLDEN
        return {
          point: { x: box.center.x + Math.cos(ang) * d, y: box.center.y + Math.sin(ang) * d },
          axis: box.center,
        }
      }
      case 'MainObject': {
        const idx = Number(rule.args?.[0])
        if (!Number.isFinite(idx) || (zone.mainObjects ?? []).length === 0) continue
        const a = mainObjectAnchor(zone, box, idx)
        const spread = (k - (n - 1) / 2) * 5
        return { point: { x: a.x + spread, y: a.y + Math.max(2, d) }, axis: a }
      }
      case 'Connection': {
        const a = connectionAnchor(rule, zone, box, conns, nodes)
        if (!a) continue
        return { point: addDir(a, norm(sub(box.center, a)), d), axis: a }
      }
      default:
        continue
    }
  }
  const ang = (k * Math.PI * 2) / Math.max(1, n) + Math.PI / 2
  const r = Math.min(box.width, box.height) * 0.32
  return { point: { x: box.center.x + Math.cos(ang) * r, y: box.center.y + Math.sin(ang) * r } }
}

function ruleHasDistance(rule: McRule): boolean {
  return rule.targetMin != null || rule.targetMax != null || rule.target != null
}

/** Кольца-полосы всех правил элемента (правила без расстояния — без кольца). */
function buildRings(
  p: McPoint,
  zone: Zone,
  box: ResolvedNode,
  zoneR: number,
  pts: McPoint[],
  conns: Connection[],
  nodes: Map<string, ResolvedNode>,
): McRing[] {
  const rings: McRing[] = []
  for (const rule of p.item.rules ?? []) {
    if (!ruleHasDistance(rule)) continue
    const band = ruleBand(rule, zoneR)
    let center: Point = box.center
    let resolved = true
    switch (rule.type) {
      case 'Crossroads':
        center = box.center
        break
      case 'MainObject': {
        const idx = Number(rule.args?.[0])
        if (Number.isFinite(idx) && (zone.mainObjects ?? []).length > 0) {
          center = mainObjectAnchor(zone, box, idx)
        } else {
          resolved = false
        }
        break
      }
      case 'Connection': {
        const a = connectionAnchor(rule, zone, box, conns, nodes)
        if (a) {
          center = a
        } else {
          resolved = false
        }
        break
      }
      case 'Sid': {
        const arg = rule.args?.[0]
        const hit =
          arg == null
            ? undefined
            : pts.find((q) => q !== p && (q.item.name === String(arg) || q.item.sid === String(arg)))
        if (hit) {
          center = hit.point
        } else {
          resolved = false
        }
        break
      }
      case 'Road':
      default:
        resolved = false
        break
    }
    rings.push({ ruleType: rule.type, center, rMin: band.rMin, rMax: band.rMax, resolved })
  }
  return rings
}

function ruleDesc(rule: McRule): string {
  const lo = rule.targetMin ?? rule.targetMax
  const hi = rule.targetMax ?? rule.targetMin
  const args = rule.args && rule.args.length > 0 ? ` [${rule.args.join(', ')}]` : ''
  const dist =
    lo !== undefined || hi !== undefined
      ? ` r ${lo ?? 0}–${hi ?? lo ?? 0}`
      : rule.target !== undefined
        ? ` r ${rule.target}`
        : ''
  return `${rule.type}${args}${dist}`
}

/**
 * Все точки + кольца mandatoryContent варианта в flow-координатах.
 * `groups` — корневые группы шаблона; `nodes` — карта «имя зоны → узел».
 * Зоны без узла и несуществующие ссылки на группы пропускаются.
 */
export function buildMandatoryContent(
  variant: Pick<Variant, 'zones' | 'connections'>,
  groups: MandatoryContentGroup[],
  nodes: Map<string, ResolvedNode>,
): McPoint[] {
  const groupBy = new Map<string, MandatoryContentGroup>()
  for (const g of groups) groupBy.set(g.name, g)

  // Слаботипизированный файл: zones/connections могут отсутствовать — слой просто пуст.
  const conns = variant.connections ?? []
  const out: McPoint[] = []
  for (const zone of variant.zones ?? []) {
    const box = nodes.get(zone.name)
    if (!box) continue
    const zoneR = zoneMcRadius(box)
    const items: FlatItem[] = []
    for (const gname of zone.mandatoryContent ?? []) {
      const g = groupBy.get(gname)
      if (!g) continue
      for (const [i, item] of g.content.entries()) items.push({ group: g, item, index: i })
    }
    if (items.length === 0) continue

    const pts: McPoint[] = []
    for (const [k, f] of items.entries()) {
      const placed = placePoint(f.item, zone, box, zoneR, k, items.length, conns, nodes)
      pts.push({
        zoneName: zone.name,
        groupName: f.group.name,
        index: f.index,
        item: f.item,
        label: f.item.name ?? f.item.sid,
        point: placed.point,
        axis: placed.axis,
        rings: [],
        rulesDesc: (f.item.rules ?? []).map(ruleDesc),
      })
    }

    // Проход 2: если первое правило — Sid и цель размещена, переставляем точку к ней.
    for (const p of pts) {
      const first = p.item.rules?.[0]
      if (first?.type !== 'Sid') continue
      const arg = first.args?.[0]
      const t =
        arg == null
          ? undefined
          : pts.find((q) => q !== p && (q.item.name === String(arg) || q.item.sid === String(arg)))
      if (!t) continue
      p.point = addDir(t.point, norm(sub(p.point, t.point)), (ruleDistance(first) ?? 0.5) * zoneR)
      p.axis = t.point
    }

    for (const p of pts) {
      p.rings = buildRings(p, zone, box, zoneR, pts, conns, nodes)
    }
    out.push(...pts)
  }
  return out
}