import { describe, expect, it } from 'vitest'
import type { Connection, MandatoryContentGroup, Variant, Zone } from '../types/rmg'
import { buildMandatoryContent, zoneMcRadius } from './mandatory'
import { zoneNodeSize, type ResolvedNode } from './roads'

function zone(name: string, size = 1, mandatoryContent?: string[]): Zone {
  return {
    name,
    size,
    layout: `layout_${name}`,
    mainObjects: [{ type: 'Spawn', spawn: 'Player1', placement: 'Center' }],
    zoneBiome: { type: 'FromList', args: [] },
    contentBiome: { type: 'FromList', args: [] },
    metaObjectsBiome: { type: 'FromList', args: [] },
    roads: [],
    mandatoryContent,
  }
}

function znode(x: number, y: number, size = 1): ResolvedNode {
  const { width, height } = zoneNodeSize({ size })
  return { center: { x, y }, width, height }
}

function group(name: string, content: MandatoryContentGroup['content']): MandatoryContentGroup {
  return { name, content }
}

function mkVariant(zones: Zone[], connections: Connection[] = []): Variant {
  return { zones, connections }
}

describe('zoneMcRadius', () => {
  it('радиус зоны — половина меньшей стороны', () => {
    expect(zoneMcRadius(znode(0, 0, 1))).toBe(65)
    expect(zoneMcRadius({ center: { x: 0, y: 0 }, width: 84, height: 73 })).toBe(36.5)
  })
})

describe('buildMandatoryContent — точки по правилам', () => {
  it('Crossroads: точка на среднем расстоянии, кольцо вокруг центра зоны', () => {
    const nodes = new Map([['A', znode(0, 0)]])
    const zo = zone('A', 1, ['g1'])
    zo.mainObjects = []
    const vars = mkVariant([zo])
    const pts = buildMandatoryContent(vars, [
      group('g1', [
        { sid: 'mine_gold', name: 'name_mine', isMine: true, rules: [{ type: 'Crossroads', targetMin: 0, targetMax: 0.4, weight: 3 }] },
      ]),
    ], nodes)

    expect(pts).toHaveLength(1)
    const p = pts[0]
    expect(p.zoneName).toBe('A')
    expect(p.label).toBe('name_mine')
    expect(p.point).toEqual({ x: 13, y: 0 }) // (0+0.4)/2 × 65
    expect(p.axis).toEqual({ x: 0, y: 0 })
    expect(p.rings).toHaveLength(1)
    expect(p.rings[0]).toMatchObject({
      ruleType: 'Crossroads',
      center: { x: 0, y: 0 },
      rMin: 0,
      rMax: 26,
      resolved: true,
    })
    expect(p.groupName).toBe('g1')
    expect(p.rulesDesc).toEqual(['Crossroads r 0–0.4'])
  })

  it('MainObject: точка ниже якоря на верхней грани, кольцо вокруг объекта', () => {
    const nodes = new Map([['A', znode(0, 0)]])
    const zo = zone('A', 1, ['g1'])
    const vars = mkVariant([zo])
    const pts = buildMandatoryContent(vars, [
      group('g1', [{ sid: 'watchtower', rules: [{ type: 'MainObject', args: ['0'], targetMin: 0.1, targetMax: 0.5 }] }]),
    ], nodes)

    expect(pts).toHaveLength(1)
    const p = pts[0]
    // среднее 0.3 × 65 = 19.5 от якоря (0,-65) вниз; якорь верхней грани = центр
    expect(p.point).toEqual({ x: 0, y: -45.5 })
    expect(p.rings[0]).toMatchObject({
      ruleType: 'MainObject',
      center: { x: 0, y: -65 },
      rMin: 6.5,
      rMax: 32.5,
      resolved: true,
    })
  })

  it('Connection: точка у грани в сторону соседа, кольцо вокруг якоря связи', () => {
    const nodes = new Map([
      ['A', znode(0, 0)],
      ['B', znode(400, 0)],
    ])
    const zo = zone('A', 1, ['g1'])
    const conns: Connection[] = [{ from: 'A', to: 'B', connectionType: 'Direct', road: true }]
    const pts = buildMandatoryContent(mkVariant([zo], conns), [
      group('g1', [{ sid: 'remote_foothold', name: 'name_foothold', rules: [{ type: 'Connection', args: ['A-B'], targetMin: 0, targetMax: 0.4 }] }]),
    ], nodes)

    expect(pts).toHaveLength(1)
    const p = pts[0]
    // якорь связи на правой грани (75,0); точка на 13 ближе к центру
    expect(p.point).toEqual({ x: 62, y: 0 })
    expect(p.rings[0]).toMatchObject({
      ruleType: 'Connection',
      center: { x: 75, y: 0 },
      rMin: 0,
      rMax: 26,
      resolved: true,
    })
  })

  it('Sid: точка переставляется к найденному объекту, кольцо вокруг него', () => {
    const nodes = new Map([['A', znode(0, 0)]])
    const zo = zone('A', 1, ['g1'])
    zo.mainObjects = []
    const vars = mkVariant([zo])
    const pts = buildMandatoryContent(vars, [
      group('g1', [
        { sid: 'mine_gold', name: 'name_mine', rules: [{ type: 'Crossroads', targetMin: 0, targetMax: 0.4 }] },
        { sid: 'remote_foothold', name: 'name_foothold', rules: [{ type: 'Sid', args: ['name_mine'], targetMin: 0.2, targetMax: 0.5 }] },
      ]),
    ], nodes)

    expect(pts).toHaveLength(2)
    const mine = pts.find((p) => p.label === 'name_mine')!
    const foothold = pts.find((p) => p.label === 'name_foothold')!
    expect(mine.point).toEqual({ x: 13, y: 0 })

    // фолбэк-раскладка для foothold → перестановка к точке мины на дистанции 0.35×65
    const dx = foothold.point.x - mine.point.x
    const dy = foothold.point.y - mine.point.y
    const dist = Math.hypot(dx, dy)
    expect(dist).toBeCloseTo(22.75, 1)
    expect(dist).toBeGreaterThan(0)
    expect(foothold.rings[0]).toMatchObject({
      ruleType: 'Sid',
      center: { x: 13, y: 0 },
      rMin: 13,
      rMax: 32.5,
      resolved: true,
    })
  })

  it('Road: кольцо не резолвится (дорога неизвестна), точка — фолбэк-раскладка', () => {
    const nodes = new Map([['A', znode(0, 0)]])
    const zo = zone('A', 1, ['g1'])
    zo.mainObjects = []
    const pts = buildMandatoryContent(mkVariant([zo]), [
      group('g1', [{ sid: 'pandora_box', rules: [{ type: 'Road', targetMin: 0, targetMax: 0.4, weight: 3 }] }]),
    ], nodes)

    expect(pts).toHaveLength(1)
    const p = pts[0]
    // фолбэк: единственный элемент — вниз от центра на 0.32×130
    expect(p.point.x).toBeCloseTo(0, 6)
    expect(p.point.y).toBe(41.6)
    expect(p.axis).toBeUndefined()
    expect(p.rings[0]).toMatchObject({
      ruleType: 'Road',
      center: { x: 0, y: 0 },
      rMin: 0,
      rMax: 26,
      resolved: false,
    })
  })

  it('правило без расстояния — точки нет кольца, но есть якорь-ось', () => {
    const nodes = new Map([
      ['A', znode(0, 0)],
      ['B', znode(400, 0)],
    ])
    const zo = zone('A', 1, ['g1'])
    const conns: Connection[] = [{ from: 'A', to: 'B', connectionType: 'Direct', road: true }]
    const pts = buildMandatoryContent(mkVariant([zo], conns), [
      group('g1', [{ sid: 'remote_foothold', rules: [{ type: 'Connection', args: ['A-B'] }] }]),
    ], nodes)

    expect(pts).toHaveLength(1)
    const p = pts[0]
    expect(p.rings).toHaveLength(0)
    // расстояние по умолчанию 0.5×65 от якоря (75,0) к центру
    expect(p.point).toEqual({ x: 42.5, y: 0 })
    expect(p.axis).toEqual({ x: 75, y: 0 })
  })

  it('зоны без узла и несуществующие ссылки на группы пропускаются', () => {
    const nodes = new Map([['A', znode(0, 0)]])
    const zo = zone('A', 1, ['g1'])
    const zoneC = zone('C', 1, ['g1']) // узла нет
    const zoneGhost = zone('D', 1, ['ghost']) // группы нет
    const pts = buildMandatoryContent(mkVariant([zo, zoneC, zoneGhost]), [
      group('g1', [{ sid: 'mine_gold', rules: [] }]),
      group('g2', [{ sid: 'market', rules: [] }]), // ни одна зона не ссылается
    ], nodes)

    expect(pts).toHaveLength(1)
    expect(pts[0].zoneName).toBe('A')
  })

  it('элемент без rules — фолбэк-раскладка и label по sid', () => {
    const nodes = new Map([['A', znode(0, 0)]])
    const zo = zone('A', 1, ['g1'])
    zo.mainObjects = []
    const pts = buildMandatoryContent(mkVariant([zo]), [
      group('g1', [{ sid: 'mana_well' }]),
    ], nodes)

    expect(pts).toHaveLength(1)
    expect(pts[0].label).toBe('mana_well')
    expect(pts[0].rings).toHaveLength(0)
  })

  it('элемент без name и sid — label undefined (фолбэк «элемент N» рисует UI)', () => {
    const nodes = new Map([['A', znode(0, 0)]])
    const zo = zone('A', 1, ['g1'])
    const pts = buildMandatoryContent(mkVariant([zo]), [group('g1', [{}])], nodes)
    expect(pts).toHaveLength(1)
    expect(pts[0].label).toBeUndefined()
    expect(pts[0].index).toBe(0)
  })

  it('разные зоны получают собственные экземпляры группы', () => {
    const nodes = new Map([
      ['A', znode(0, 0)],
      ['B', znode(200, 0)],
    ])
    const pts = buildMandatoryContent(mkVariant([zone('A', 1, ['g1']), zone('B', 1, ['g1'])]), [
      group('g1', [{ sid: 'mine_wood', name: 'name_wood', rules: [{ type: 'Crossroads', targetMin: 0, targetMax: 0.4 }] }]),
    ], nodes)

    expect(pts).toHaveLength(2)
    expect(pts[0].point).toEqual({ x: 13, y: 0 })
    expect(pts[1].point).toEqual({ x: 213, y: 0 })
    expect(pts[1].zoneName).toBe('B')
  })
})