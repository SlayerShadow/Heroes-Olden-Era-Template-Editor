import { describe, expect, it } from 'vitest'
import type { Connection, Variant, Zone } from '../types/rmg'
import type { ZoneEdgeModel, ZoneNodeModel } from '../types/rf'
import { buildGraph, completePositions, mergeEdges, mergeNodes } from './graph'

const zone = (name: string): Zone => ({ name, size: 1 }) as unknown as Zone

const conn = (from: string, to: string, extra: Partial<Connection> = {}): Connection => ({
  from,
  to,
  connectionType: 'Default',
  ...extra,
})

const variant = (zones: string[], connections: Connection[]): Variant =>
  ({
    zones: zones.map(zone),
    connections,
  }) as unknown as Variant

const POS = { A: { x: 0, y: 0 }, B: { x: 400, y: 0 }, C: { x: 0, y: 300 }, D: { x: 400, y: -100 }, E: { x: 400, y: 100 } }

describe('buildGraph', () => {
  it('прямая связь (цель правее): выход справа, вход слева', () => {
    const { edges } = buildGraph(variant(['A', 'B'], [conn('A', 'B')]), POS)
    expect(edges).toHaveLength(1)
    expect(edges[0].sourceHandle).toBe('src-r')
    expect(edges[0].targetHandle).toBe('tgt-l')
    expect(edges[0].data?.sourceSide).toBe('r')
    expect(edges[0].data?.targetSide).toBe('l')
  })

  it('обратная связь (цель левее): выход слева, вход справа — без петель-разворотов', () => {
    const { edges } = buildGraph(variant(['A', 'B'], [conn('B', 'A')]), POS)
    expect(edges[0].sourceHandle).toBe('src-l')
    expect(edges[0].targetHandle).toBe('tgt-r')
  })

  it('вертикаль доминирует (|dy| > |dx|): выход снизу/сверху', () => {
    const { edges } = buildGraph(variant(['A', 'C'], [conn('A', 'C')]), POS)
    expect(edges[0].sourceHandle).toBe('src-b')
    expect(edges[0].targetHandle).toBe('tgt-t')
  })

  it('диагональ (|dx| > |dy|): горизонтальные стороны', () => {
    const { edges } = buildGraph(variant(['A', 'E'], [conn('A', 'E')]), POS)
    expect(edges[0].sourceHandle).toBe('src-r')
    expect(edges[0].targetHandle).toBe('tgt-l')
  })

  it('параллельные связи одной пары: разные слоты вдоль стороны, все в (0;1)', () => {
    const conns = [conn('A', 'B'), conn('A', 'B'), conn('A', 'B'), conn('A', 'B'), conn('A', 'B')]
    const { edges } = buildGraph(variant(['A', 'B'], conns), POS)
    const slots = edges.map((e) => e.data?.sourceSlot)
    expect(new Set(slots).size).toBe(5)
    for (const s of slots) {
      expect(s).toBeGreaterThan(0)
      expect(s).toBeLessThan(1)
    }
    // детерминированный порядок: слоты растут по порядку связей (партнёры совпадают)
    expect(slots).toEqual([1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6])
    // слоты приёмника распределены так же
    expect(edges.map((e) => e.data?.targetSlot)).toEqual([1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6])
  })

  it('одиночная связь на стороне: слот 0.5 (центр стороны)', () => {
    const { edges } = buildGraph(variant(['A', 'B'], [conn('A', 'B')]), POS)
    expect(edges[0].data?.sourceSlot).toBe(0.5)
    expect(edges[0].data?.targetSlot).toBe(0.5)
  })

  it('слоты стороны сортируются по позиции партнёра (меньше пересечений)', () => {
    // A→D (партнёр выше) и A→E (ниже): обе на правой стороне A; D должна получить верхний слот.
    const { edges } = buildGraph(variant(['A', 'D', 'E'], [conn('A', 'E'), conn('A', 'D')]), POS)
    const eED = edges[0]
    const eAD = edges[1]
    expect(eAD.data?.sourceSlot ?? 1).toBeLessThan(eED.data?.sourceSlot ?? 1)
  })

  it('id рёбер уникальны даже при одинаковых парах', () => {
    const { edges } = buildGraph(variant(['A', 'B'], [conn('A', 'B'), conn('A', 'B')]), POS)
    const ids = edges.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('без явных позиций стороны/слоты всё равно выставляются (circleLayout-фолбэк)', () => {
    const { edges } = buildGraph(variant(['A', 'B'], [conn('A', 'B')]))
    expect(['src-r', 'src-l', 'src-t', 'src-b']).toContain(edges[0].sourceHandle)
    expect(['tgt-l', 'tgt-r', 'tgt-t', 'tgt-b']).toContain(edges[0].targetHandle)
    expect(edges[0].data?.sourceSlot).toBeGreaterThan(0)
    expect(edges[0].data?.sourceSlot).toBeLessThan(1)
  })
})

describe('completePositions', () => {
  it('сохранённые точки не трогает, недостающие зоны дополняет кольцевым фолбэком', () => {
    const out = completePositions(variant(['A', 'B', 'C'], []), { B: { x: 10, y: 20 } })
    expect(out.B).toEqual({ x: 10, y: 20 })
    // кольцо n=3: i=0 → угол 0 → (1100, 420); i=2 → угол 4π/3
    expect(out.A).toEqual({ x: 1100, y: 420 })
    expect(out.C.x).toBeCloseTo(380, 6)
    expect(out.C.y).toBeCloseTo(420 + Math.sin((4 * Math.PI) / 3) * 360, 6)
  })

  it('не мутирует входной объект', () => {
    const src = { A: { x: 1, y: 2 } }
    const out = completePositions(variant(['A', 'B'], []), src)
    expect(src).toEqual({ A: { x: 1, y: 2 } })
    expect(out.B).toBeDefined()
  })

  it('variant undefined — копия входа', () => {
    const src = { A: { x: 1, y: 2 } }
    expect(completePositions(undefined, src)).toEqual(src)
  })

  it('buildGraph показывает узлы ровно там, где их видит completePositions', () => {
    const v = variant(['A', 'B', 'C'], [])
    const filled = completePositions(v, { A: { x: 7, y: 8 } })
    const { nodes } = buildGraph(v, { A: { x: 7, y: 8 } })
    for (const n of nodes) expect(n.position).toEqual(filled[n.id])
  })
})

describe('mergeNodes/mergeEdges (стабильная идентичность между перестроениями графа)', () => {
  const nodeModel = (z: Zone, x: number, y: number, extra: Partial<ZoneNodeModel> = {}): ZoneNodeModel => ({
    id: z.name,
    type: 'zone',
    position: { x, y },
    data: { zone: z },
    ...extra,
  })

  const edgeModel = (c: Connection, extra: Partial<ZoneEdgeModel> = {}): ZoneEdgeModel => ({
    id: c.name ?? `${c.from}-${c.to}`,
    type: 'zone-edge',
    source: c.from,
    target: c.to,
    sourceHandle: 'src-r',
    targetHandle: 'tgt-l',
    data: { connection: c, sourceSide: 'r', targetSide: 'l', sourceSlot: 0.5, targetSlot: 0.5 },
    ...extra,
  })

  it('неизменённый узел — старый объект и старый массив (даже при свежих обёртках next)', () => {
    const zA = zone('A')
    const prev = [nodeModel(zA, 10, 20, { measured: { width: 100, height: 60 } })]
    const next = [nodeModel(zA, 10, 20)] // новые объекты-обёртки, та же zone и позиция
    expect(mergeNodes(prev, next)).toBe(prev)
  })

  it('изменённая зона — новый объект: графовые поля из next, measured/selected/dragging из prev', () => {
    const zA = zone('A')
    const zA2 = { ...zA, size: 2 } as unknown as Zone
    const prev = [
      nodeModel(zA, 10, 20, {
        measured: { width: 100, height: 60 },
        selected: true,
        dragging: true,
      }),
    ]
    const next = [nodeModel(zA2, 30, 40)]
    const out = mergeNodes(prev, next)
    expect(out).not.toBe(prev)
    expect(out[0]).not.toBe(prev[0])
    expect(out[0].data?.zone).toBe(zA2)
    expect(out[0].position).toEqual({ x: 30, y: 40 })
    expect(out[0].measured).toEqual({ width: 100, height: 60 })
    expect(out[0].selected).toBe(true)
    expect(out[0].dragging).toBe(true)
  })

  it('переезд узла (позиция из next) тоже сохраняет measured', () => {
    const zA = zone('A')
    const prev = [nodeModel(zA, 10, 20, { measured: { width: 80, height: 40 } })]
    const out = mergeNodes(prev, [nodeModel(zA, 55, 77)])
    expect(out[0].position).toEqual({ x: 55, y: 77 })
    expect(out[0].measured).toEqual({ width: 80, height: 40 })
  })

  it('добавленные узлы проходят как есть, удалённые исчезают, общие сохраняют идентичность', () => {
    const zA = zone('A')
    const zB = zone('B')
    const zC = zone('C')
    const prev = [nodeModel(zA, 0, 0), nodeModel(zB, 1, 1)]
    const next = [nodeModel(zA, 0, 0), nodeModel(zC, 2, 2)]
    const out = mergeNodes(prev, next)
    expect(out.map((n) => n.id)).toEqual(['A', 'C'])
    expect(out[0]).toBe(prev[0])
    expect(out[1]).toBe(next[1])
  })

  it('пустой prev — next как есть', () => {
    const next = [nodeModel(zone('A'), 0, 0)]
    expect(mergeNodes([], next)).toBe(next)
    expect(mergeEdges([], [])).toEqual([])
  })

  it('неизменённое ребро сохраняет идентичность; изменённое — selected из prev, data из next', () => {
    const c = conn('A', 'B')
    const prevE = edgeModel(c, { selected: true })
    // та же connection (идентичность) и те же слоты — даже при свежей обёртке ребра
    expect(mergeEdges([prevE], [edgeModel(c)])[0]).toBe(prevE)
    // новая connection (правка в store) — объект пересоздан, RF-поле selected выжило
    const c2 = { ...c } as unknown as Connection
    const out = mergeEdges([prevE], [edgeModel(c2)])
    expect(out[0]).not.toBe(prevE)
    expect(out[0].data?.connection).toBe(c2)
    expect(out[0].selected).toBe(true)
  })

  it('ребро со сменившимися handle/слотами пересоздаётся', () => {
    const c = conn('A', 'B')
    const prevE = edgeModel(c)
    const out = mergeEdges([prevE], [edgeModel(c, { sourceHandle: 'src-b', targetHandle: 'tgt-t' })])
    expect(out[0]).not.toBe(prevE)
    expect(out[0].sourceHandle).toBe('src-b')
    expect(out[0].targetHandle).toBe('tgt-t')
  })

  it('повторный buildGraph по тем же данным: merge возвращает prev целиком (коммит не трогает канву)', () => {
    const v = variant(['A', 'B'], [conn('A', 'B')])
    const first = buildGraph(v, POS)
    const prevNodes = mergeNodes([], first.nodes)
    const prevEdges = mergeEdges([], first.edges)
    const second = buildGraph(v, POS) // полностью свежие объекты
    expect(second.nodes[0]).not.toBe(first.nodes[0])
    expect(second.edges[0]).not.toBe(first.edges[0])
    expect(mergeNodes(prevNodes, second.nodes)).toBe(prevNodes)
    expect(mergeEdges(prevEdges, second.edges)).toBe(prevEdges)
  })
})

describe('слаботипизированный вариант (файл без zones/connections)', () => {
  it('buildGraph: пустой граф без краша (в т.ч. variant undefined)', () => {
    expect(buildGraph({} as unknown as Variant)).toEqual({ nodes: [], edges: [] })
    expect(buildGraph(undefined)).toEqual({ nodes: [], edges: [] })
  })

  it('completePositions: без zones — копия входа; с zones — кольцевой фолбэк', () => {
    expect(completePositions({} as unknown as Variant, { Z: { x: 1, y: 2 } })).toEqual({ Z: { x: 1, y: 2 } })
    const weak = { zones: [zone('A')] } as unknown as Variant
    expect(completePositions(weak, {})).toEqual({ A: { x: 1100, y: 420 } })
  })

  it('зоны есть, connections нет: узлы строятся, рёбер нет', () => {
    const weak = { zones: [zone('A'), zone('B')] } as unknown as Variant
    const { nodes, edges } = buildGraph(weak)
    expect(nodes.map((n) => n.id)).toEqual(['A', 'B'])
    expect(edges).toHaveLength(0)
  })
})
