import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Zone } from '../types/rmg'
import type { BiomeLayer } from '../types/viewMode'
import { BiomeLine } from './ZoneNode'

/**
 * Компонентный тест строки-источника биома на узле канвы (vitest-проект `ui`, jsdom).
 * Регрессия «имя биома на узле дважды»: для `fixed` строка-источник пуста —
 * само имя выводится рядом со свотчем один раз. Остальные виды показывают
 * источник (зона / объект / differentFrom) или состояние списка.
 */

const LAYER: BiomeLayer = 'zone'

function makeZone(name: string, zoneBiome?: Zone['zoneBiome']): Zone {
  // zoneBiome опционален намеренно: вид «unknown» возникает именно при отсутствующем селекторе.
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

function line(zoneBiome?: Zone['zoneBiome'], zones: Zone[] = []) {
  const zone = makeZone('A', zoneBiome)
  const { container } = render(<BiomeLine zone={zone} layer={LAYER} zones={[zone, ...zones]} />)
  return (container.textContent ?? '').trim()
}

describe('BiomeLine: строка-источник биома', () => {
  it('fixed: строка пуста — имя биома не дублируется', () => {
    expect(line({ type: 'FromList', args: ['Sand'] })).toBe('')
  })

  it('FromList пусто — «любой»; нераспознанная пара — «список»', () => {
    expect(line({ type: 'FromList', args: [] })).toBe('любой')
    expect(line({ type: 'FromList', args: ['foo', 'bar'] })).toBe('список')
  })

  it('несколько имён биомов — «список», а не первое имя', () => {
    expect(line({ type: 'FromList', args: ['Sand', 'Snow'] })).toBe('список')
  })

  it('differentFrom и MatchZone — зона-источник', () => {
    const b = makeZone('B', { type: 'FromList', args: [] })
    expect(line({ type: 'FromList', args: ['differentFrom: B'] }, [b])).toBe('≠ B')
    expect(line({ type: 'MatchZone', args: ['B'] }, [b])).toBe('← B')
  })

  it('MatchMainObject — объект и необязательная зона-источник', () => {
    const b = makeZone('B', { type: 'FromList', args: [] })
    expect(line({ type: 'MatchMainObject', args: ['0'] })).toBe('MO #0')
    expect(line({ type: 'MatchMainObject', args: ['0', 'B'] }, [b])).toBe('MO #0 ← B')
  })

  it('нет селектора — «?»', () => {
    expect(line(undefined)).toBe('?')
  })
})
