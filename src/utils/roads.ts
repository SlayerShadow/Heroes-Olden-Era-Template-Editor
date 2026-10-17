import type { Connection, RoadEndpoint, RoadSurface, Variant, Zone } from '../types/rmg'

/**
 * Геометрия маршрутов zone.roads[] для канвы (режим «Дороги»).
 * Все функции чистые и не зависят от React — покрыты unit-тестами.
 */

export interface Point {
  x: number
  y: number
}

/** Узел зоны на канве: центр (flow-координаты) и размеры. */
export interface ResolvedNode {
  center: Point
  width: number
  height: number
}

/** Минимальный/максимальный размер узла зоны — синхронно с ZoneNode.tsx. */
export const ZONE_MIN_WIDTH = 84
export const ZONE_MAX_WIDTH = 240

const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v))

/** Размеры узла зоны на канве (единый источник для ZoneNode и слоя дорог). */
export function zoneNodeSize(zone: Pick<Zone, 'size'>): { width: number; height: number } {
  const width = Math.round(clamp(ZONE_MIN_WIDTH, 150 * zone.size, ZONE_MAX_WIDTH))
  return { width, height: Math.round(width / 1.15) }
}

/** Канонический id связи — совпадает с graph.ts, renameZone.ts и RoadsEditor. */
export function connId(c: Pick<Connection, 'name' | 'from' | 'to'>): string {
  return c.name ?? `${c.from}-${c.to}`
}

/**
 * Точка на границе прямоугольника узла по лучу из центра в сторону `toward`.
 * При направлении точно в центр — правый нижний угол (нейтральный фолбэк).
 */
export function borderPoint(center: Point, width: number, height: number, toward: Point): Point {
  const dx = toward.x - center.x
  const dy = toward.y - center.y
  const hw = width / 2
  const hh = height / 2
  if (dx === 0 && dy === 0) return { x: center.x + hw, y: center.y + hh }
  const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity
  const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity
  const t = Math.min(tx, ty)
  return { x: center.x + dx * t, y: center.y + dy * t }
}

/** Точка крепления одного конца дороги на канве. */
export interface RoadAnchor {
  kind: RoadEndpoint['type']
  /** Точка на канве (flow-координаты). */
  point: Point
  /** Аргумент конца (args[0]): индекс объекта / id связи / имя контента. */
  arg?: string
  /** Индекс главного объекта для kind='MainObject' (спавн → цвет маркера). */
  moIndex?: number
}

function moIndex(end: RoadEndpoint): number | undefined {
  const v = Number(end.args?.[0])
  return Number.isFinite(v) ? v : undefined
}

/** Главный объект — верхняя грань узла, распределение по ширине (не впритык к краям). */
function mainObjectAnchor(end: RoadEndpoint, zone: Zone, box: ResolvedNode): RoadAnchor {
  const count = zone.mainObjects?.length ?? 0
  const i = moIndex(end)
  if (count > 0 && i !== undefined && i >= count) {
    // ссылка на несуществующий объект — «прижимаем» к последнему
    const f = count <= 1 ? 0.5 : 0.15 + (0.7 * (count - 1)) / (count - 1)
    return {
      kind: 'MainObject',
      point: { x: box.center.x + (f - 0.5) * box.width, y: box.center.y - box.height / 2 },
      arg: end.args?.[0],
    }
  }
  const f = count <= 1 ? 0.5 : 0.15 + (0.7 * (i ?? 0)) / (count - 1)
  return {
    kind: 'MainObject',
    point: { x: box.center.x + (f - 0.5) * box.width, y: box.center.y - box.height / 2 },
    arg: end.args?.[0],
    moIndex: i,
  }
}

/** Центроид всех узлов карты — фолбэк-направление, если связь не найдена. */
function mapCentroid(nodes: Map<string, ResolvedNode>): Point {
  let sx = 0
  let sy = 0
  let n = 0
  for (const node of nodes.values()) {
    sx += node.center.x
    sy += node.center.y
    n += 1
  }
  if (n === 0) return { x: 1, y: 1 }
  return { x: sx / n, y: sy / n }
}

/** Связь зоны — точка на грани узла в сторону зоны-соседа (или центроид карты). */
function connectionAnchor(
  end: RoadEndpoint,
  zone: Zone,
  box: ResolvedNode,
  conns: Connection[],
  nodes: Map<string, ResolvedNode>,
): RoadAnchor {
  const id = end.args?.[0]
  const conn = conns.find((c) => connId(c) === id)
  let toward: Point
  if (conn) {
    const other = zone.name === conn.from ? conn.to : zone.name === conn.to ? conn.from : undefined
    const otherNode = other !== undefined ? nodes.get(other) : undefined
    toward = otherNode?.center ?? mapCentroid(nodes)
  } else {
    // связь не найдена (удалена/переименована) — направляем к центру карты
    toward = mapCentroid(nodes)
  }
  return {
    kind: 'Connection',
    point: borderPoint(box.center, box.width, box.height, toward),
    arg: end.args?.[0],
  }
}

/** Перекрёсток зоны — центр узла (точка схода дорог). */
function crossroadsAnchor(end: RoadEndpoint, box: ResolvedNode): RoadAnchor {
  return {
    kind: 'Crossroads',
    point: { x: box.center.x, y: box.center.y },
    arg: end.args?.[0],
  }
}

/** Элемент обязательного контента — нижняя грань узла, по центру. */
function mandatoryContentAnchor(end: RoadEndpoint, box: ResolvedNode): RoadAnchor {
  return {
    kind: 'MandatoryContent',
    point: { x: box.center.x, y: box.center.y + box.height / 2 },
    arg: end.args?.[0],
  }
}

function resolveAnchor(
  end: RoadEndpoint,
  zone: Zone,
  box: ResolvedNode,
  conns: Connection[],
  nodes: Map<string, ResolvedNode>,
): RoadAnchor {
  switch (end.type) {
    case 'MainObject':
      return mainObjectAnchor(end, zone, box)
    case 'Connection':
      return connectionAnchor(end, zone, box, conns, nodes)
    case 'MandatoryContent':
      return mandatoryContentAnchor(end, box)
    case 'Crossroads':
    default:
      return crossroadsAnchor(end, box)
  }
}

/** Отступ ломаной от узла наружу (flow-единицы). */
export const ROAD_PAD = 12

function outward(point: Point, box: ResolvedNode): Point {
  const dx = point.x - box.center.x
  const dy = point.y - box.center.y
  const horiz = Math.abs(dx) * box.height >= Math.abs(dy) * box.width
  if (horiz) return { x: point.x + Math.sign(dx || 1) * ROAD_PAD, y: point.y }
  return { x: point.x, y: point.y + Math.sign(dy || 1) * ROAD_PAD }
}

function insideBox(p: Point, box: ResolvedNode): boolean {
  const minX = box.center.x - box.width / 2
  const maxX = box.center.x + box.width / 2
  const minY = box.center.y - box.height / 2
  const maxY = box.center.y + box.height / 2
  return p.x > minX && p.x < maxX && p.y > minY && p.y < maxY
}

function dedupe(pts: Point[]): Point[] {
  const out: Point[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p)
  }
  return out
}

/**
 * Ортогональная ломаная между двумя концами дороги одной зоны.
 * Ломаная выходит наружу от граней (ROAD_PAD) и огибает прямоугольник узла,
 * не пересекая его внутренность; «перекрёсток» (центр) остаётся внутреней точкой.
 */
function routePoints(a: RoadAnchor, b: RoadAnchor, box: ResolvedNode): Point[] {
  const sa = a.kind !== 'Crossroads' ? outward(a.point, box) : undefined
  const sb = b.kind !== 'Crossroads' ? outward(b.point, box) : undefined
  const pts: Point[] = [a.point]
  if (sa) pts.push(sa)
  if (sa && sb) {
    const h = { x: sb.x, y: sa.y }
    const v = { x: sa.x, y: sb.y }
    // элбоу предпочитаем вне прямоугольника узла
    pts.push(insideBox(h, box) && !insideBox(v, box) ? v : h)
  }
  if (sb) pts.push(sb)
  pts.push(b.point)
  return dedupe(pts)
}

export interface RoadRoute {
  /** Имя зоны, которой принадлежит дорога. */
  zoneName: string
  /** Индекс в zone.roads. */
  index: number
  surface?: RoadSurface
  from: RoadAnchor
  to: RoadAnchor
  /** Ломаная маршрута от from.point до to.point (flow-координаты). */
  points: Point[]
}

/**
 * Все маршруты дорог варианта в flow-координатах.
 * `nodes` — карта «имя зоны → узел» (центр + размеры); зоны без узла пропускаются.
 */
export function buildRoadRoutes(
  variant: Pick<Variant, 'zones' | 'connections'>,
  nodes: Map<string, ResolvedNode>,
): RoadRoute[] {
  // Слаботипизированный файл: zones/connections могут отсутствовать — слой просто пуст.
  const conns = variant.connections ?? []
  const routes: RoadRoute[] = []
  for (const zone of variant.zones ?? []) {
    const box = nodes.get(zone.name)
    if (!box) continue
    for (const [i, road] of (zone.roads ?? []).entries()) {
      const from = resolveAnchor(road.from, zone, box, conns, nodes)
      const to = resolveAnchor(road.to, zone, box, conns, nodes)
      routes.push({
        zoneName: zone.name,
        index: i,
        surface: road.type,
        from,
        to,
        points: routePoints(from, to, box),
      })
    }
  }
  return routes
}