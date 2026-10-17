import { describe, expect, it } from 'vitest'
import { getBezierPath, Position } from '@xyflow/system'
import type { Connection, RmgTemplate, Variant, Zone } from '../types/rmg'
import type { ZoneEdgeSide } from '../types/rf'
import type { Point } from './graph'
import { bezierBetween, previewLayout, renderPreviewCanvas } from './preview'

const zone = (name: string): Zone => ({ name, size: 1, mainObjects: [] }) as unknown as Zone

const conn = (from: string, to: string, extra: Partial<Connection> = {}): Connection => ({
  from,
  to,
  connectionType: 'Default',
  ...extra,
})

const template = (zones: Zone[], connections: Connection[]): RmgTemplate =>
  ({ name: 'T', variants: [{ zones, connections } as unknown as Variant] }) as unknown as RmgTemplate

const SIDE_TO_POSITION: Record<ZoneEdgeSide, Position> = {
  l: Position.Left,
  r: Position.Right,
  t: Position.Top,
  b: Position.Bottom,
}

describe('bezierBetween — зеркало getBezierPath (формула канвы)', () => {
  const cases: Array<{ a: Point; sa: ZoneEdgeSide; b: Point; sb: ZoneEdgeSide; name: string }> = [
    { a: { x: 100, y: 50 }, sa: 'r', b: { x: 300, y: 150 }, sb: 'l', name: 'r→l вперёд' },
    { a: { x: 300, y: 50 }, sa: 'r', b: { x: 100, y: 150 }, sb: 'l', name: 'r→l назад (S-кривая)' },
    { a: { x: 0, y: 0 }, sa: 'b', b: { x: 40, y: 260 }, sb: 't', name: 'b→t вниз' },
    { a: { x: 50, y: 300 }, sa: 't', b: { x: 260, y: 40 }, sb: 'b', name: 't→b вверх' },
    { a: { x: 10, y: 10 }, sa: 'l', b: { x: 200, y: 80 }, sb: 'r', name: 'l→r оба развёрнуты' },
    { a: { x: 0, y: 0 }, sa: 'r', b: { x: 0, y: 200 }, sb: 'r', name: 'r→r петля сбоку' },
  ]

  for (const c of cases) {
    it(`бит-в-бит совпадает с канвой: ${c.name}`, () => {
      const expected = getBezierPath({
        sourceX: c.a.x,
        sourceY: c.a.y,
        sourcePosition: SIDE_TO_POSITION[c.sa],
        targetX: c.b.x,
        targetY: c.b.y,
        targetPosition: SIDE_TO_POSITION[c.sb],
      })
      const got = bezierBetween(c.a, c.sa, c.b, c.sb)
      expect(got).toBe(expected[0])
    })
  }
})

describe('previewLayout — геометрия связей', () => {
  const A: Point = { x: 0, y: 0 }
  const B: Point = { x: 400, y: -150 }
  const C: Point = { x: 400, y: 0 }
  const D: Point = { x: 400, y: 150 }

  it('веер из одной стороны: якоря на границе узла, линии не сливаются', () => {
    const tpl = template(
      [zone('A'), zone('B'), zone('C'), zone('D')],
      [conn('A', 'B'), conn('A', 'C'), conn('A', 'D')],
    )
    const layout = previewLayout(tpl, [{ A, B, C, D }], 0)
    expect(layout).not.toBeNull()
    const nodeA = layout!.nodes.find((n) => n.zone.name === 'A')!
    const edges = layout!.edges
    expect(edges).toHaveLength(3)
    for (const e of edges) {
      // якорь ровно на правой границе узла (без зазора — как ручка канвы)
      expect(e.x1).toBeCloseTo(nodeA.cx + nodeA.w / 2, 9)
      expect(e.path.startsWith(`M${e.x1},${e.y1} C`)).toBe(true)
    }
    const [eAB, eAC, eAD] = edges
    // три разные точки стороны — линии не сливаются в одну
    expect(new Set([eAB.y1, eAC.y1, eAD.y1]).size).toBe(3)
    // порядок слотов — по высоте партнёра: верхний к B, средний к C, нижний к D
    expect(eAB.y1).toBeLessThan(eAC.y1)
    expect(eAC.y1).toBeLessThan(eAD.y1)
  })

  it('симметричная горизонталь: одиночный слот в центре стороны', () => {
    const tpl = template([zone('A'), zone('B')], [conn('A', 'B')])
    const layout = previewLayout(tpl, [{ A: { x: 0, y: 0 }, B: { x: 400, y: 0 } }], 0)!
    const e = layout.edges[0]
    const nodeA = layout.nodes.find((n) => n.zone.name === 'A')!
    const nodeB = layout.nodes.find((n) => n.zone.name === 'B')!
    expect(e.x1).toBeCloseTo(nodeA.cx + nodeA.w / 2, 9)
    expect(e.y1).toBeCloseTo(nodeA.cy, 9)
    expect(e.x2).toBeCloseTo(nodeB.cx - nodeB.w / 2, 9)
    expect(e.path).toContain(' C')
  })

  it('стиль связи переносится в PreviewEdge (road/dash/цвет)', () => {
    const tpl = template(
      [zone('A'), zone('B')],
      [conn('A', 'B', { road: true, connectionType: 'Portal', guardValue: 3000 })],
    )
    const layout = previewLayout(tpl, [{ A: { x: 0, y: 0 }, B: { x: 400, y: 0 } }], 0)!
    const e = layout.edges[0]
    expect(e.hasRoad).toBe(true)
    expect(e.dash).toBe('7 5')
    expect(e.color).toBe('#62a8f2')
    expect(e.conn.guardValue).toBe(3000)
  })

  it('размеры узлов одинаковые для всех зон (читаемость мелкой картинки)', () => {
    const tpl = template([zone('A'), zone('B'), zone('C')], [conn('A', 'B'), conn('A', 'C')])
    const layout = previewLayout(tpl, [{ A: { x: 0, y: 0 }, B: { x: 300, y: 0 }, C: { x: 0, y: 300 } }], 0)!
    expect(new Set(layout.nodes.map((n) => `${n.w}×${n.h}`)).size).toBe(1)
  })
})

describe('renderPreviewCanvas', () => {
  it('в node-окружении возвращает null (нет document) — модуль остаётся импортируемым', () => {
    expect(renderPreviewCanvas(template([zone('A')], []), null, 0)).toBeNull()
  })
})
