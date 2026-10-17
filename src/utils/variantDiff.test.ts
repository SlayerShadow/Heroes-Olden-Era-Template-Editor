import { describe, expect, it } from 'vitest'
import type { Connection, Road, Variant, Zone } from '../types/rmg'
import { findEntityDiff, variantDiff } from './variantDiff'

function zone(name: string, patch: Partial<Zone> = {}): Zone {
  return {
    name,
    size: 1,
    layout: `layout_${name}`,
    mainObjects: [{ type: 'Spawn', spawn: 'Player1', placement: 'Center' }],
    zoneBiome: { type: 'FromList', args: ['biome_grass'] },
    contentBiome: { type: 'FromList', args: [] },
    metaObjectsBiome: { type: 'FromList', args: [] },
    roads: [],
    ...patch,
  }
}

function conn(from: string, to: string, patch: Partial<Connection> = {}): Connection {
  return { from, to, connectionType: 'Direct', guardValue: 8000, road: true, ...patch }
}

function mk(zones: Zone[], connections: Connection[] = [], rest: Partial<Variant> = {}): Variant {
  return { zones, connections, ...rest }
}

describe('variantDiff — идентичность', () => {
  it('идентичные варианты → пустой дифф, identical=true', () => {
    const a = mk([zone('X'), zone('Y')], [conn('X', 'Y')], {
      orientation: { mode: 'BoundingCircle', baseAngleMin: 0 },
      border: { cornerRadius: 0.5, waterWidth: 2 },
    })
    const b = mk([zone('X'), zone('Y')], [conn('X', 'Y')], {
      orientation: { mode: 'BoundingCircle', baseAngleMin: 0 },
      border: { cornerRadius: 0.5, waterWidth: 2 },
    })
    const d = variantDiff(a, b)
    expect(d.identical).toBe(true)
    expect(d.rootFields).toEqual([])
    expect(d.zones).toEqual([])
    expect(d.connections).toEqual([])
  })

  it('порядок ключей объекта не влияет (устойчивое сравнение)', () => {
    const a = mk([zone('X', { encounterHolesSettings: { affectedEncounters: 0.5, twoHoleEncounters: 0.2 } })])
    const b = mk([zone('X', { encounterHolesSettings: { twoHoleEncounters: 0.2, affectedEncounters: 0.5 } })])
    expect(variantDiff(a, b).identical).toBe(true)
  })
})

describe('variantDiff — зоны', () => {
  it('добавленная зона: status=added, idA=null', () => {
    const d = variantDiff(mk([zone('X')]), mk([zone('X'), zone('Y')]))
    expect(d.zones).toHaveLength(1)
    expect(d.zones[0]).toMatchObject({ kind: 'zone', label: 'Y', status: 'added', idA: null, fields: [] })
  })

  it('удалённая зона: status=removed, idA — имя', () => {
    const d = variantDiff(mk([zone('X'), zone('Y')]), mk([zone('X')]))
    expect(d.zones).toHaveLength(1)
    expect(d.zones[0]).toMatchObject({ kind: 'zone', label: 'Y', status: 'removed', idA: 'Y', fields: [] })
  })

  it('скалярное поле: значения old → new строками', () => {
    const d = variantDiff(mk([zone('X', { size: 1 })]), mk([zone('X', { size: 1.5 })]))
    const e = d.zones[0]
    expect(e.status).toBe('changed')
    expect(e.fields).toEqual([{ field: 'size', kind: 'scalar', oldValue: '1', newValue: '1.5' }])
  })

  it('появление/исчезновение скалярного поля: undefined-значение', () => {
    const d = variantDiff(mk([zone('X')]), mk([zone('X', { guardMultiplier: 2 })]))
    expect(d.zones[0].fields).toEqual([
      { field: 'guardMultiplier', kind: 'scalar', oldValue: undefined, newValue: '2' },
    ])
    const back = variantDiff(mk([zone('X', { guardMultiplier: 2 })]), mk([zone('X')]))
    expect(back.zones[0].fields).toEqual([
      { field: 'guardMultiplier', kind: 'scalar', oldValue: '2', newValue: undefined },
    ])
  })

  it('сложное поле (roads): факт изменения + счётчик', () => {
    const road: Road = { from: { type: 'Crossroads', args: [] }, to: { type: 'MainObject', args: ['0'] } }
    const d = variantDiff(
      mk([zone('X', { roads: [] })]),
      mk([zone('X', { roads: [road, road] })]),
    )
    expect(d.zones[0].fields).toEqual([
      { field: 'roads', kind: 'complex', oldCount: 0, newCount: 2 },
    ])
  })

  it('сложное поле-объект (биом): факт без счётчика', () => {
    const d = variantDiff(
      mk([zone('X', { zoneBiome: { type: 'FromList', args: ['biome_grass'] } })]),
      mk([zone('X', { zoneBiome: { type: 'FromList', args: ['biome_sand'] } })]),
    )
    expect(d.zones[0].fields).toEqual([
      { field: 'zoneBiome', kind: 'complex', oldCount: undefined, newCount: undefined },
    ])
  })

  it('name зоны — ключ: не попадает в дифф полей', () => {
    const a = mk([zone('X', { size: 1 })])
    const b = mk([zone('X', { size: 2 }), zone('Z')])
    const d = variantDiff(a, b)
    expect(d.zones.map((z) => [z.label, z.status])).toEqual([
      ['X', 'changed'],
      ['Z', 'added'],
    ])
    expect(d.zones[0].fields.every((f) => f.field !== 'name')).toBe(true)
  })
})

describe('variantDiff — связи', () => {
  it('ключ неупорядочен: a→b и b→a — одна сущность changed', () => {
    const d = variantDiff(mk([], [conn('A', 'B')]), mk([], [conn('B', 'A')]))
    expect(d.connections).toHaveLength(1)
    const e = d.connections[0]
    expect(e.status).toBe('changed')
    // разворот направления виден как changed-поля from/to
    expect(e.fields).toEqual([
      { field: 'from', kind: 'scalar', oldValue: 'A', newValue: 'B' },
      { field: 'to', kind: 'scalar', oldValue: 'B', newValue: 'A' },
    ])
  })

  it('id связи — name ?? from-to (формат findConnection)', () => {
    const d = variantDiff(
      mk([], [conn('A', 'B', { guardValue: 100 })]),
      mk([], [conn('A', 'B', { guardValue: 200 })]),
    )
    expect(d.connections[0].idA).toBe('A-B')
    const named = variantDiff(
      mk([], [conn('A', 'B', { name: 'main-road', guardValue: 100 })]),
      mk([], [conn('A', 'B', { name: 'main-road', guardValue: 200 })]),
    )
    expect(named.connections[0].idA).toBe('main-road')
    expect(named.connections[0].fields).toEqual([
      { field: 'guardValue', kind: 'scalar', oldValue: '100', newValue: '200' },
    ])
  })

  it('смена name при той же паре — changed-поле, не added+removed', () => {
    const d = variantDiff(mk([], [conn('A', 'B', { name: 'old' })]), mk([], [conn('A', 'B', { name: 'new' })]))
    expect(d.connections).toHaveLength(1)
    expect(d.connections[0].status).toBe('changed')
    expect(d.connections[0].idA).toBe('old')
    expect(d.connections[0].fields).toEqual([
      { field: 'name', kind: 'scalar', oldValue: 'old', newValue: 'new' },
    ])
  })

  it('added/removed связи: label — `from → to`', () => {
    const d = variantDiff(mk([], [conn('A', 'B')]), mk([], [conn('A', 'C')]))
    expect(d.connections.map((c) => [c.label, c.status, c.idA])).toEqual([
      ['A → B', 'removed', 'A-B'],
      ['A → C', 'added', null],
    ])
  })

  it('mcRules (portalPlacementRules) — complex со счётчиком', () => {
    const d = variantDiff(
      mk([], [conn('A', 'B', { connectionType: 'Portal', portalPlacementRulesFrom: [] })]),
      mk([], [conn('A', 'B', { connectionType: 'Portal', portalPlacementRulesFrom: [{ type: 'Crossroads' }] })]),
    )
    expect(d.connections[0].fields).toContainEqual({
      field: 'portalPlacementRulesFrom',
      kind: 'complex',
      oldCount: 0,
      newCount: 1,
    })
  })
})

describe('variantDiff — корневые поля варианта', () => {
  it('orientation: плоский полевой дифф со значениями', () => {
    const d = variantDiff(
      mk([], [], { orientation: { mode: 'BoundingCircle', baseAngleMin: 0, baseAngleMax: 90 } }),
      mk([], [], { orientation: { mode: 'BoundingCircle', baseAngleMin: 45, baseAngleMax: 90 } }),
    )
    expect(d.rootFields).toEqual([
      { field: 'orientation.baseAngleMin', kind: 'scalar', oldValue: '0', newValue: '45' },
    ])
  })

  it('border появился только в B: все поля old=undefined', () => {
    const d = variantDiff(mk([]), mk([], [], { border: { cornerRadius: 0.5, waterWidth: 0 } }))
    expect(d.rootFields).toEqual([
      { field: 'border.cornerRadius', kind: 'scalar', oldValue: undefined, newValue: '0.5' },
      { field: 'border.waterWidth', kind: 'scalar', oldValue: undefined, newValue: '0' },
    ])
  })

  it('шум границы (массив) — complex со счётчиком', () => {
    const d = variantDiff(
      mk([], [], { border: { obstaclesNoise: [] } }),
      mk([], [], { border: { obstaclesNoise: [{ amp: 1 }, { amp: 2 }] } }),
    )
    expect(d.rootFields).toEqual([
      { field: 'border.obstaclesNoise', kind: 'complex', oldCount: 0, newCount: 2 },
    ])
  })
})

describe('findEntityDiff', () => {
  it('находит changed-сущность по idA', () => {
    const d = variantDiff(mk([zone('X', { size: 1 }), zone('Y')]), mk([zone('X', { size: 2 })]))
    expect(findEntityDiff(d, 'zone', 'X')?.status).toBe('changed')
    expect(findEntityDiff(d, 'zone', 'Y')?.status).toBe('removed')
    expect(findEntityDiff(d, 'zone', 'Z')).toBeUndefined()
    expect(findEntityDiff(d, 'connection', 'X-Y')).toBeUndefined()
  })
})
