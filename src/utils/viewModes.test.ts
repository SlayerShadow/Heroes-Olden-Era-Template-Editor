import { describe, expect, it } from 'vitest'
import type { Zone } from '../types/rmg'
import { resolveBiome } from './viewModes'

/**
 * Чистые тесты резолюции биома для канвы (vitest-проект `unit`, node).
 * Ключевая семантика: FromList — список РАЗРЕШЁнных биомов,
 * поэтому «фиксированный» показывается только при единственном имени;
 * несколько имён — состояние «список» (multi), а не первый биом из списка.
 */

function zone(name: string, zoneBiome?: Zone['zoneBiome']): Zone {
  const z: Partial<Zone> = {
    name,
    size: 0.5,
    layout: 'zone_layout_empty',
    mainObjects: [],
    contentBiome: { type: 'FromList', args: [] },
    metaObjectsBiome: { type: 'FromList', args: [] },
    roads: [],
  }
  if (zoneBiome) z.zoneBiome = zoneBiome
  return z as Zone
}

describe('resolveBiome: FromList — список разрешённых биомов', () => {
  it('единственное имя — фиксированный биом', () => {
    const a = zone('A', { type: 'FromList', args: ['Sand'] })
    expect(resolveBiome(a, [a], 'zone')).toEqual({ biome: 'Sand', kind: 'fixed' })
  })

  it('несколько имён — «список», а не первый биом', () => {
    const a = zone('A', { type: 'FromList', args: ['Sand', 'Snow', 'Grass'] })
    expect(resolveBiome(a, [a], 'zone')).toEqual({ biome: 'unknown', kind: 'multi' })
  })

  it('единственное имя плюс differentFrom — по-прежнему фиксированный', () => {
    const a = zone('A', { type: 'FromList', args: ['Sand', 'differentFrom: B'] })
    const b = zone('B', { type: 'FromList', args: [] })
    expect(resolveBiome(a, [a, b], 'zone')).toEqual({ biome: 'Sand', kind: 'fixed' })
  })

  it('пустой список — «любой»', () => {
    const a = zone('A', { type: 'FromList', args: [] })
    expect(resolveBiome(a, [a], 'zone')).toEqual({ biome: 'any', kind: 'any' })
  })

  it('только differentFrom — биом зоны-источника со строкой-источником', () => {
    const b = zone('B', { type: 'FromList', args: ['Snow'] })
    const d = zone('D', { type: 'FromList', args: ['differentFrom: B'] })
    expect(resolveBiome(d, [d, b], 'zone')).toEqual({ biome: 'Snow', kind: 'different-from', sourceZone: 'B' })
  })

  it('MatchZone и MatchMainObject — биом берётся у источника', () => {
    const b = zone('B', { type: 'FromList', args: ['Lava'] })
    const mz = zone('M', { type: 'MatchZone', args: ['B'] })
    expect(resolveBiome(mz, [mz, b], 'zone')).toMatchObject({ biome: 'Lava', kind: 'match-zone', sourceZone: 'B' })
    const mo = zone('O', { type: 'MatchMainObject', args: ['0', 'B'] })
    expect(resolveBiome(mo, [mo, b], 'zone')).toMatchObject({ biome: 'Lava', kind: 'match-object', sourceObject: '0' })
  })

  it('цикл ссылок — биом не разрешается (unknown под match-zone)', () => {
    const a = zone('A', { type: 'MatchZone', args: ['B'] })
    const b = zone('B', { type: 'MatchZone', args: ['A'] })
    expect(resolveBiome(a, [a, b], 'zone')).toMatchObject({ biome: 'unknown', kind: 'match-zone' })
  })

  it('нет селектора — «?»', () => {
    const a = zone('A')
    expect(resolveBiome(a, [a], 'zone')).toEqual({ biome: 'unknown', kind: 'unknown' })
  })
})
