import type { Variant } from '../types/rmg'
import type { ZoneEdgeModel, ZoneEdgeSide, ZoneNodeModel } from '../types/rf'

export interface Point {
  x: number
  y: number
}

export interface GraphResult {
  nodes: ZoneNodeModel[]
  edges: ZoneEdgeModel[]
}

function circleLayout(i: number, n: number): Point {
  const angle = (i / Math.max(1, n)) * Math.PI * 2
  return { x: 620 + Math.cos(angle) * 480, y: 420 + Math.sin(angle) * 360 }
}

/**
 * Дополняет позиции до покрытия ВСЕХ зон варианта: зона без сохранённой точки
 * получает тот же фолбэк (кольцо), которым канва показывает её на экране.
 * Store (и sidecar, пишущийся из него) благодаря этому всегда описывает ровно
 * ту картину, которую видел пользователь, а не только перетащенные узлы.
 */
export function completePositions(
  variant: Variant | undefined,
  positions: Record<string, Point>,
): Record<string, Point> {
  const out = { ...positions }
  // Слаботипизированный файл: zones может отсутствовать — пустая раскладка, не краш.
  const zones = variant?.zones ?? []
  zones.forEach((zone, i) => {
    if (!out[zone.name]) out[zone.name] = circleLayout(i, zones.length)
  })
  return out
}

/** Стороны выбираются по доминирующей оси: линия выходит к цели кратчайшим путём. */
function sidesFor(from: Point | undefined, to: Point | undefined): { source: ZoneEdgeSide; target: ZoneEdgeSide } {
  const dx = from && to ? to.x - from.x : 1
  const dy = from && to ? to.y - from.y : 0
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { source: 'r', target: 'l' } : { source: 'l', target: 'r' }
  }
  return dy >= 0 ? { source: 'b', target: 't' } : { source: 't', target: 'b' }
}

interface SlotEndpoint {
  edge: number
  key: 'sourceSlot' | 'targetSlot'
  /** Координата партнёра вдоль оси стороны (для l/r — y, для t/b — x). */
  along: number
  /** Координата партнёра поперёк (вторичный ключ сортировки). */
  across: number
  order: number
}

export function buildGraph(
  variant: Variant | undefined,
  positions: Record<string, Point> = {},
): GraphResult {
  const pos = completePositions(variant, positions)
  const nodes: ZoneNodeModel[] = (variant?.zones ?? []).map((zone) => ({
    id: zone.name,
    type: 'zone',
    position: pos[zone.name],
    data: { zone },
  }))
  const posById = new Map(nodes.map((n) => [n.id, n.position]))

  const seen = new Set<string>()
  const edges: ZoneEdgeModel[] = (variant?.connections ?? []).map((conn, i) => {
    const base = conn.name ?? `${conn.from}-${conn.to}`
    const id = seen.has(base) ? `${base}-${i}` : base
    seen.add(id)

    const sides = sidesFor(posById.get(conn.from), posById.get(conn.to))
    return {
      id,
      type: 'zone-edge',
      source: conn.from,
      target: conn.to,
      sourceHandle: `src-${sides.source}`,
      targetHandle: `tgt-${sides.target}`,
      data: {
        connection: conn,
        sourceSide: sides.source,
        targetSide: sides.target,
        sourceSlot: 0.5,
        targetSlot: 0.5,
      },
    }
  })

  // Слоты якорей: все концы связей одной стороны узла равномерно распределяются
  // вдоль неё, порядок — по позиции партнёра (минимум пересечений). Так 5 параллельных
  // связей (официальный Jebus Cross) — это 5 отдельных линий, каждая на своей точке стороны.
  const groups = new Map<string, SlotEndpoint[]>()
  const push = (nodeId: string, side: ZoneEdgeSide, edge: number, key: SlotEndpoint['key'], mate: Point | undefined): void => {
    const gk = `${nodeId}:${side}`
    const g = groups.get(gk)
    const along = side === 't' || side === 'b' ? mate?.x ?? 0 : mate?.y ?? 0
    const across = side === 't' || side === 'b' ? mate?.y ?? 0 : mate?.x ?? 0
    const ep = { edge, key, along, across, order: edge }
    if (g) g.push(ep)
    else groups.set(gk, [ep])
  }
  edges.forEach((e, i) => {
    const sSide = e.data?.sourceSide ?? 'r'
    const tSide = e.data?.targetSide ?? 'l'
    push(e.source, sSide, i, 'sourceSlot', posById.get(e.target))
    push(e.target, tSide, i, 'targetSlot', posById.get(e.source))
  })
  for (const g of groups.values()) {
    g.sort((p, q) => p.along - q.along || p.across - q.across || p.order - q.order)
    g.forEach((ep, k) => {
      const data = edges[ep.edge].data
      if (data) data[ep.key] = (k + 1) / (g.length + 1)
    })
  }

  return { nodes, edges }
}

/* ------------------------------------------------------------------------- */
/* Слияние графов: стабильная идентичность узлов/рёбер между перестроениями   */
/* ------------------------------------------------------------------------- */

/**
 * Слить свежий граф с предыдущим состоянием канвы, сохраняя идентичность
 * объектов и служебные поля React Flow.
 *
 * Зачем: React Flow (adoptUserNodes, checkEquality) сравнивает входящие узлы
 * ПО ИДЕНТИЧНОСТИ объектов. Новый объект без `measured` — даже с теми же id и
 * данными — приводит к пересборке internal-узла: `measured` и `handleBounds`
 * сбрасываются, узел получает visibility:hidden до повторного обмера
 * ResizeObserver'ом (доставляется только в кадре отрисовки; в headless-гонках обмер
 * может не прийти вовсе — узлы залипают скрытыми, рёбра не рисуются). Кроме
 * того wholesale-замена сбрасывает RF-выделение (`selected`) и гоняет
 * переобмер/перерисовку всей канвы на каждый коммит шаблона.
 *
 * Правила:
 * - узел не изменился (тот же объект zone, та же позиция) → возвращается СТАРЫЙ
 *   объект (React Flow переиспользует internal целиком: ноль пересборки);
 * - узел изменился → новый объект с графовыми полями из next, но со служебными
 *   полями RF из prev (`measured`/`selected`/`dragging`/…): узел остаётся
 *   видимым, handleBounds сохраняются (parseHandles переносит их, когда
 *   measured присутствует);
 * - новый узел → как есть (свежий DOM-элемент обмеряется при монтаже);
 * - если всё сохранило идентичность и состав — возвращается сам массив prev
 *   (React setState bail-out: коммиты, не затрагивающие граф, канву не трогают).
 */
export function mergeNodes(prev: ZoneNodeModel[], next: ZoneNodeModel[]): ZoneNodeModel[] {
  if (prev.length === 0) return next
  const byId = new Map(prev.map((n) => [n.id, n]))
  const out = next.map((n) => {
    const old = byId.get(n.id)
    return old ? mergeNode(old, n) : n
  })
  const same = out.length === prev.length && out.every((n, i) => n === prev[i])
  return same ? prev : out
}

function mergeNode(old: ZoneNodeModel, next: ZoneNodeModel): ZoneNodeModel {
  if (
    old.type === next.type &&
    old.data?.zone === next.data?.zone &&
    old.position.x === next.position.x &&
    old.position.y === next.position.y
  ) {
    return old
  }
  const merged: ZoneNodeModel = { ...next }
  // Служебные поля React Flow (пишутся applyNodeChanges в state канвы) — переносим.
  if (old.measured) merged.measured = old.measured
  if (old.width !== undefined) merged.width = old.width
  if (old.height !== undefined) merged.height = old.height
  if (old.selected !== undefined) merged.selected = old.selected
  if (old.dragging !== undefined) merged.dragging = old.dragging
  return merged
}

/**
 * Рёбра: то же правило идентичности (см. mergeNodes). Служебные поля RF на рёбрах —
 * `selected`/`zIndex`; `measured` у рёбер нет, но стабильная идентичность избавляет
 * EdgeWrapper от перерисовки и пересчёта путей на каждый коммит.
 */
export function mergeEdges(prev: ZoneEdgeModel[], next: ZoneEdgeModel[]): ZoneEdgeModel[] {
  if (prev.length === 0) return next
  const byId = new Map(prev.map((e) => [e.id, e]))
  const out = next.map((e) => {
    const old = byId.get(e.id)
    return old ? mergeEdge(old, e) : e
  })
  const same = out.length === prev.length && out.every((e, i) => e === prev[i])
  return same ? prev : out
}

function mergeEdge(old: ZoneEdgeModel, next: ZoneEdgeModel): ZoneEdgeModel {
  const od = old.data
  const nd = next.data
  if (
    old.type === next.type &&
    old.source === next.source &&
    old.target === next.target &&
    old.sourceHandle === next.sourceHandle &&
    old.targetHandle === next.targetHandle &&
    od?.connection === nd?.connection &&
    od?.sourceSide === nd?.sourceSide &&
    od?.targetSide === nd?.targetSide &&
    od?.sourceSlot === nd?.sourceSlot &&
    od?.targetSlot === nd?.targetSlot
  ) {
    return old
  }
  // next не содержит selected/zIndex — служебные поля RF из old выживают.
  return { ...old, ...next }
}
