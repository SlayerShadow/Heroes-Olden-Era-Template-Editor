import { describe, expect, it } from 'vitest'
import type { Zone } from '../types/rmg'
import { isConnectorZone, nodeColorFor, playerColorFor, zoneBudget } from './zoneStyle'

/**
 * Регрессия «минимальный файл роняет React-дерево»: parseTemplate проверяет только
 * name/variants, поэтому в store может попасть зона без `mainObjects` (в типе Zone
 * поле обязательное, но парсер типы не enforce'ит). Все чтения зоны в zoneStyle
 * обязаны это переносить — иначе TypeError в рендере (TemplateTree/ZoneNode) и
 * белый экран (ErrorBoundary в проекте нет).
 */

const bareZone = (patch: Partial<Zone> = {}): Zone =>
  ({ name: 'Z', size: 1, ...patch }) as unknown as Zone

describe('zoneStyle: зона без mainObjects (слаботипизированные данные)', () => {
  it('isConnectorZone: без mainObjects и без бюджета — коннектор; с бюджетом — нет', () => {
    expect(isConnectorZone(bareZone())).toBe(true)
    expect(isConnectorZone(bareZone({ guardedContentValue: 1000 }))).toBe(false)
  })

  it('playerColorFor: undefined без краша', () => {
    expect(playerColorFor(bareZone())).toBeUndefined()
  })

  it('nodeColorFor: цвет коннектора без краша', () => {
    expect(nodeColorFor(bareZone())).toBe('#2c323e')
  })

  it('zoneBudget: 0 без краша', () => {
    expect(zoneBudget(bareZone())).toBe(0)
  })

  it('имя Connector* — коннектор даже без mainObjects', () => {
    expect(isConnectorZone(bareZone({ name: 'Connector 1' }))).toBe(true)
  })
})

describe('zoneStyle: с mainObjects поведение прежнее', () => {
  const withSpawn = bareZone({
    mainObjects: [{ type: 'Spawn', spawn: 'Player2', placement: 'Center' }],
  })

  it('Spawn даёт цвет игрока и снимает флаг коннектора', () => {
    expect(playerColorFor(withSpawn)).toBe('#4f7fd9')
    expect(nodeColorFor(withSpawn)).toBe('#4f7fd9')
    expect(isConnectorZone(withSpawn)).toBe(false)
  })
})
