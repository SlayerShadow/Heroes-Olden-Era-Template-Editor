import { describe, expect, it } from 'vitest'
import type { Connection, Variant, Zone } from '../types/rmg'
import {
  borderPoint,
  buildRoadRoutes,
  connId,
  zoneNodeSize,
  type ResolvedNode,
} from './roads'

function zone(name: string, size = 1, roads?: Zone['roads']): Zone {
  return {
    name,
    size,
    layout: `layout_${name}`,
    mainObjects: [{ type: 'Spawn', spawn: 'Player1', placement: 'Center' }],
    zoneBiome: { type: 'MatchMainObject', args: ['0'] },
    contentBiome: { type: 'MatchMainObject', args: ['0'] },
    metaObjectsBiome: { type: 'MatchMainObject', args: ['0'] },
    roads,
  }
}

function znode(x: number, y: number, size = 1): ResolvedNode {
  const { width, height } = zoneNodeSize({ size })
  return { center: { x, y }, width, height }
}

function mkVariant(zones: Zone[], connections: Connection[] = []): Variant {
  return { zones, connections }
}

describe('zoneNodeSize', () => {
  it('синхронизирован с ZoneNode: clamp по размеру зоны', () => {
    expect(zoneNodeSize({ size: 1 })).toEqual({ width: 150, height: 130 })
    expect(zoneNodeSize({ size: 0.4 })).toEqual({ width: 84, height: 73 })
    expect(zoneNodeSize({ size: 2 })).toEqual({ width: 240, height: 209 })
  })
})

describe('borderPoint', () => {
  const c = { x: 100, y: 100 }

  it('луч до горизонтали упирается в правую грань', () => {
    expect(borderPoint(c, 100, 80, { x: 300, y: 100 })).toEqual({ x: 150, y: 100 })
  })

  it('луч до вертикали упирается в верхнюю грань', () => {
    expect(borderPoint(c, 100, 80, { x: 100, y: 20 })).toEqual({ x: 100, y: 60 })
  })

  it('диагональ — в грань, достигнутую первой', () => {
    expect(borderPoint(c, 100, 80, { x: 300, y: 300 })).toEqual({ x: 140, y: 140 })
  })

  it('вырожденное направление — правый нижний угол', () => {
    expect(borderPoint(c, 100, 80, c)).toEqual({ x: 150, y: 140 })
  })
})

describe('connId', () => {
  it('канонический id связи', () => {
    expect(connId({ from: 'A', to: 'B' })).toBe('A-B')
    expect(connId({ name: 'portal', from: 'A', to: 'C' })).toBe('portal')
  })
})

describe('buildRoadRoutes', () => {
  it('маршрут MainObject → Connection: верхняя грань → грань в сторону соседа', () => {
    const nodes = new Map([
      ['A', znode(0, 0)],
      ['B', znode(400, 0)],
    ])
    const zones = [
      zone('A', 1, [
        {
          type: 'Stone',
          from: { type: 'MainObject', args: ['0'] },
          to: { type: 'Connection', args: ['A-B'] },
        },
      ]),
      zone('B'),
    ]
    const conns: Connection[] = [{ from: 'A', to: 'B', connectionType: 'Direct', road: true }]

    const routes = buildRoadRoutes(mkVariant(zones, conns), nodes)
    expect(routes).toHaveLength(1)

    const r = routes[0]
    expect(r.zoneName).toBe('A')
    expect(r.surface).toBe('Stone')
    expect(r.from.kind).toBe('MainObject')
    expect(r.to.kind).toBe('Connection')
    expect(r.from.point).toEqual({ x: 0, y: -65 }) // верхняя грань, центр
    expect(r.to.point).toEqual({ x: 75, y: 0 }) // правая грань (зона B справа)

    // ломаная начинается/заканчивается якорями и не заходит внутрь прямоугольника
    expect(r.points[0]).toEqual(r.from.point)
    expect(r.points[r.points.length - 1]).toEqual(r.to.point)
    for (const p of r.points.slice(1, -1)) {
      expect(p.x <= -75 || p.x >= 75 || p.y <= -65 || p.y >= 65).toBe(true)
    }

    expect(r.from.arg).toBe('0')
    expect(r.to.arg).toBe('A-B')
  })

  it('Dirt — сохраняется поверхность и пунктирная раскладка', () => {
    const nodes = new Map([['A', znode(0, 0)]])
    const zo = zone('A', 1, [
      {
        type: 'Dirt',
        from: { type: 'MainObject', args: ['0'] },
        to: { type: 'Crossroads', args: [] },
      },
    ])
    const routes = buildRoadRoutes(mkVariant([zo]), nodes)
    expect(routes[0].surface).toBe('Dirt')
  })

  it('Crossroads — якорь в центре узла', () => {
    const nodes = new Map([['A', znode(0, 0)]])
    const zo = zone('A', 1, [
      {
        type: 'Stone',
        from: { type: 'MainObject', args: ['0'] },
        to: { type: 'Crossroads', args: [] },
      },
    ])
    const routes = buildRoadRoutes(mkVariant([zo]), nodes)
    expect(routes[0].to.kind).toBe('Crossroads')
    expect(routes[0].to.point).toEqual({ x: 0, y: 0 })
  })

  it('MandatoryContent — якорь на нижней грани', () => {
    const nodes = new Map([['A', znode(0, 0)]])
    const zo = zone('A', 1, [
      {
        type: 'Stone',
        from: { type: 'MainObject', args: ['0'] },
        to: { type: 'MandatoryContent', args: ['group_spawn'] },
      },
    ])
    const routes = buildRoadRoutes(mkVariant([zo]), nodes)
    expect(routes[0].to.kind).toBe('MandatoryContent')
    expect(routes[0].to.point).toEqual({ x: 0, y: 65 })
  })

  it('несуществующая связь — маршрут строится, якорь к фолбэку (центр карты)', () => {
    const nodes = new Map([['A', znode(0, 0)]])
    const zo = zone('A', 1, [
      {
        type: 'Stone',
        from: { type: 'MainObject', args: ['0'] },
        to: { type: 'Connection', args: ['NOPE'] },
      },
    ])
    const routes = buildRoadRoutes(mkVariant([zo]), nodes)
    expect(routes).toHaveLength(1)
    expect(routes[0].to.kind).toBe('Connection')
    expect(routes[0].to.arg).toBe('NOPE')
    expect(routes[0].to.point).toEqual({ x: 75, y: 65 }) // диагональ вниз-вправо
  })

  it('несколько главных объектов распределяются по верхней грани', () => {
    const nodes = new Map([['A', znode(0, 0)]])
    const zo = zone('A', 1)
    zo.mainObjects.push({ type: 'City', placement: 'Center' })
    zo.roads = [
      { type: 'Stone', from: { type: 'MainObject', args: ['0'] }, to: { type: 'Crossroads', args: [] } },
      { type: 'Stone', from: { type: 'MainObject', args: ['1'] }, to: { type: 'Crossroads', args: [] } },
    ]
    const routes = buildRoadRoutes(mkVariant([zo]), nodes)
    expect(routes).toHaveLength(2)
    const x0 = routes[0].from.point.x
    const x1 = routes[1].from.point.x
    expect(x0).toBeLessThan(x1)
    expect(routes[0].from.point.y).toBe(-65)
    expect(routes[1].from.point.y).toBe(-65)
  })

  it('зона без узла на карте пропускается', () => {
    const nodes = new Map([['A', znode(0, 0)]])
    const zones = [
      zone('A', 1, [
        { type: 'Stone', from: { type: 'MainObject', args: ['0'] }, to: { type: 'Crossroads', args: [] } },
      ]),
      zone('C', 1, [
        { type: 'Dirt', from: { type: 'MainObject', args: ['0'] }, to: { type: 'Crossroads', args: [] } },
      ]),
    ]
    const routes = buildRoadRoutes(mkVariant(zones), nodes)
    expect(routes).toHaveLength(1)
    expect(routes[0].zoneName).toBe('A')
  })
})