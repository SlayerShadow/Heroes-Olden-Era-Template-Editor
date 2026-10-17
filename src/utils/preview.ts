import type { Connection, RmgTemplate, Zone } from '../types/rmg'
import type { ZoneEdgeSide } from '../types/rf'
import { buildGraph, type Point } from './graph'
import { nodeFillForView } from './viewModes'
import { playerColorFor, strokeFor } from './zoneStyle'

export const PREVIEW_SIZE = 700

export interface PreviewNode {
  zone: Zone
  cx: number
  cy: number
  w: number
  h: number
  fill: string
}

export interface PreviewEdge {
  conn: Connection
  x1: number
  y1: number
  x2: number
  y2: number
  /** SVG-path кубической кривой (та же формула, что на канве) — для ctx.stroke(Path2D). */
  path: string
  color: string
  width: number
  dash?: string
  hasRoad: boolean
}

export interface PreviewLayout {
  nodes: PreviewNode[]
  edges: PreviewEdge[]
  scale: number
}

const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v))

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/**
 * Кубическая кривая Безье — зеркало `getBezierPath` из `@xyflow/system` (curvature 0.25):
 * той же функцией канва (`ZoneEdge.tsx`) строит связи. Формула скопирована чистой
 * арифметикой намеренно — preview.ts остаётся без зависимостей, а геометрия линий
 * совпадает с канвой бит-в-бит (контрольные точки перпендикулярны стороне узла).
 * Паритет защищён unit-тестом `preview.test.ts`.
 */
const CURVATURE = 0.25

function controlOffset(distance: number): number {
  return distance >= 0 ? 0.5 * distance : CURVATURE * 25 * Math.sqrt(-distance)
}

function controlPoint(side: ZoneEdgeSide, x1: number, y1: number, x2: number, y2: number): Point {
  switch (side) {
    case 'l':
      return { x: x1 - controlOffset(x1 - x2), y: y1 }
    case 'r':
      return { x: x1 + controlOffset(x2 - x1), y: y1 }
    case 'b':
      return { x: x1, y: y1 + controlOffset(y2 - y1) }
    default:
      return { x: x1, y: y1 - controlOffset(y1 - y2) }
  }
}

/** SVG-path `M… C…` — совместим с Path2D и с <path> канвы. */
export function bezierBetween(
  from: Point,
  fromSide: ZoneEdgeSide,
  to: Point,
  toSide: ZoneEdgeSide,
): string {
  const c1 = controlPoint(fromSide, from.x, from.y, to.x, to.y)
  const c2 = controlPoint(toSide, to.x, to.y, from.x, from.y)
  return `M${from.x},${from.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${to.x},${to.y}`
}

export function previewLayout(
  template: RmgTemplate,
  positions: Record<string, Point>[] | null | undefined,
  variantIndex: number,
  size = PREVIEW_SIZE,
): PreviewLayout | null {
  const variants = Array.isArray(template.variants) ? template.variants : []
  if (variants.length === 0) return null
  const vi = Number.isInteger(variantIndex) && variantIndex >= 0 && variantIndex < variants.length ? variantIndex : 0
  const variant = variants[vi]
  if (!variant || !Array.isArray(variant.zones) || variant.zones.length === 0) return null

  const pslot = positions?.[vi]
  const graph = buildGraph(variant, pslot ?? {})
  if (graph.nodes.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of graph.nodes) {
    minX = Math.min(minX, n.position.x)
    maxX = Math.max(maxX, n.position.x)
    minY = Math.min(minY, n.position.y)
    maxY = Math.max(maxY, n.position.y)
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null

  const pad = Math.round(size * 0.04)
  const avail = Math.max(10, size - pad * 2)
  const extentX = Math.max(1, maxX - minX)
  const extentY = Math.max(1, maxY - minY)
  const scale = Math.min(avail / (extentX * 1.15), avail / (extentY * 1.08))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const tx = size / 2 - cx * scale
  const ty = size / 2 - cy * scale

  const nodeW = clamp(30, 118 * scale, 200)
  const nodeH = nodeW / 1.15
  const zones = variant.zones

  const nodes: PreviewNode[] = graph.nodes.map((n) => {
    const zone = n.data.zone
    const fill = nodeFillForView(zone, 'overview', 'zone', zones, 'total', 'abs').background
    return {
      zone,
      cx: n.position.x * scale + tx,
      cy: n.position.y * scale + ty,
      w: nodeW,
      h: nodeH,
      fill,
    }
  })

  const nodeById = new Map(nodes.map((n) => [n.zone.name, n]))
  const edges: PreviewEdge[] = []

  // Якорь связи — точка на границе стороны узла, слот вдоль всей стороны
  // (правила канвы: ZoneEdge.tsx + buildGraph). Параллельные связи становятся
  // отдельными линиями; безье выходит из стороны перпендикулярно, поэтому веер
  // линий из одной стороны не сливается и не «срезает» узел.
  const anchor = (n: PreviewNode, side: ZoneEdgeSide, slot: number): Point => {
    const along = slot - 0.5
    switch (side) {
      case 'r':
        return { x: n.cx + n.w / 2, y: n.cy + along * n.h }
      case 'l':
        return { x: n.cx - n.w / 2, y: n.cy + along * n.h }
      case 'b':
        return { x: n.cx + along * n.w, y: n.cy + n.h / 2 }
      default:
        return { x: n.cx + along * n.w, y: n.cy - n.h / 2 }
    }
  }

  for (const e of graph.edges) {
    const conn = e.data?.connection
    const src = nodeById.get(e.source)
    const tgt = nodeById.get(e.target)
    if (!conn || !src || !tgt) continue
    const sSide = e.data?.sourceSide ?? 'r'
    const tSide = e.data?.targetSide ?? 'l'
    const a = anchor(src, sSide, e.data?.sourceSlot ?? 0.5)
    const b = anchor(tgt, tSide, e.data?.targetSlot ?? 0.5)
    const stroke = strokeFor(conn)
    edges.push({
      conn,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      path: bezierBetween(a, sSide, b, tSide),
      color: stroke.color,
      width: stroke.width,
      dash: stroke.dash,
      hasRoad: conn.road === true,
    })
  }

  return { nodes, edges, scale }
}

export function renderPreviewCanvas(
  template: RmgTemplate,
  positions: Record<string, Point>[] | null | undefined,
  variantIndex: number,
  size = PREVIEW_SIZE,
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const layout = previewLayout(template, positions, variantIndex, size)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const grad = ctx.createLinearGradient(0, 0, 0, size)
  grad.addColorStop(0, '#171d2a')
  grad.addColorStop(1, '#0d1119')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = 'rgba(255,255,255,0.045)'
  const gridStep = 40
  for (let x = gridStep / 2; x < size; x += gridStep) {
    for (let y = gridStep / 2; y < size; y += gridStep) {
      ctx.fillRect(x, y, 1.2, 1.2)
    }
  }

  if (!layout) return canvas

  const k = clamp(0.6, layout.scale, 1.15)

  // Кривые — те же безье, что на канве (ZoneEdge): strokeLinecap round,
  // дорожный пунктир «1 7» поверх линии связи.
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const e of layout.edges) {
    const curve = new Path2D(e.path)
    ctx.strokeStyle = e.color
    ctx.lineWidth = clamp(0.8, e.width * k, 4.5)
    ctx.setLineDash(e.dash ? e.dash.split(' ').map(Number) : [])
    ctx.stroke(curve)

    if (e.hasRoad) {
      ctx.setLineDash([1, 7])
      ctx.strokeStyle = 'rgba(244,244,244,0.85)'
      ctx.lineWidth = Math.max(0.7, 1 * k)
      ctx.stroke(curve)
    }
  }
  ctx.setLineDash([])

  for (const n of layout.nodes) {
    const x = n.cx - n.w / 2
    const y = n.cy - n.h / 2
    const r = Math.max(4, n.w * 0.12)
    roundRect(ctx, x, y, n.w, n.h, r)
    ctx.fillStyle = n.fill
    ctx.fill()
    const isPlayer = Boolean(playerColorFor(n.zone))
    ctx.strokeStyle = isPlayer ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.42)'
    ctx.lineWidth = isPlayer ? 1.8 : 1.2
    ctx.stroke()

    // Подпись зоны — строго по центру узла: числовых пилюль бюджета в превью нет.
    const showName = n.w >= 44
    if (!showName) continue

    const fs = clamp(9, n.w / 7.5, 17)
    ctx.font = `700 ${fs}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0,0,0,0.72)'
    ctx.lineWidth = Math.max(1.5, fs / 3.4)
    ctx.lineJoin = 'round'

    const label = truncate(ctx, n.zone.name, n.w - 6)
    ctx.strokeText(label, n.cx, n.cy)
    ctx.fillStyle = '#fff'
    ctx.fillText(label, n.cx, n.cy)
  }

  return canvas
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let out = text
  while (out.length > 1 && ctx.measureText(out + '…').width > maxW) {
    out = out.slice(0, -1)
  }
  return out + '…'
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png')
  })
}

/** Рендерит PNG-превью активного варианта (то же, что в PreviewDialog) — для автозаписи при сохранении. null — рендерить нечего. */
export async function renderTemplatePngBlob(
  template: RmgTemplate,
  positions: Record<string, Point>[] | null | undefined,
  variantIndex: number,
  size = PREVIEW_SIZE,
): Promise<Blob | null> {
  const canvas = renderPreviewCanvas(template, positions, variantIndex, size)
  if (!canvas) return null
  return canvasToPngBlob(canvas)
}

export function variantPreviewLabel(template: RmgTemplate, variantIndex: number): string {
  const count = (template.variants ?? []).length
  const vi = Number.isInteger(variantIndex) && variantIndex >= 0 && variantIndex < count ? variantIndex : 0
  return `V${vi + 1}${count > 1 ? ` / ${count}` : ''}`
}