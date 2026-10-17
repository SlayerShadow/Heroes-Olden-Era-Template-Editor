import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../store/editorStore'
import type { RmgTemplate, Zone } from '../types/rmg'
import { Inspector } from './Inspector'

/**
 * Компонентный тест шапки инспектора (vitest-проект `ui`, jsdom).
 * Кнопки дублирования зоны/связи в `inspector__head` вызывают те же actions
 * store, что и контекстное меню канвы. Строки ассертятся настоящие (ru-локаль)
 * — заодно ловим потерянные ключи `inspector.duplicate*Title`.
 */

const st = () => useEditorStore.getState()

function makeZone(name: string): Zone {
  return {
    name,
    size: 0.5,
    layout: 'zone_layout_empty',
    mainObjects: [],
    zoneBiome: { type: 'FromList', args: [] },
    contentBiome: { type: 'FromList', args: [] },
    metaObjectsBiome: { type: 'FromList', args: [] },
    roads: [],
  }
}

function makeTemplate(): RmgTemplate {
  return {
    name: 'Inspector Head',
    gameMode: 'Classic',
    sizeX: 64,
    sizeZ: 64,
    variants: [
      {
        zones: [makeZone('A'), makeZone('B')],
        connections: [
          { name: 'c1', from: 'A', to: 'B', connectionType: 'Direct', road: true, guardValue: 1000 },
          // Безымянная связь: эффективный id — 'A-B' (фолбэк connId в Inspector).
          { from: 'A', to: 'B', connectionType: 'Direct', road: false },
        ],
      },
    ],
    zoneLayouts: [{ name: 'zone_layout_empty' }],
    valueOverrides: [],
    gameRules: {},
    globalBans: {},
    contentPools: [],
    contentLists: [],
  }
}

beforeEach(() => {
  st().loadTemplate(makeTemplate(), 'inspector.rmg.json', null)
})

describe('Inspector: кнопки дублирования в шапке', () => {
  it('выбрана связь — кнопка «Дублировать связь»; клик создаёт копию и выделяет её', () => {
    st().select('connection', 'c1')
    render(<Inspector />)
    const dup = screen.getByRole('button', { name: 'Дублировать связь' })
    expect(dup).toHaveAttribute('title', 'Дублировать связь')
    fireEvent.click(dup)
    expect(st().template.variants[0].connections.map((c) => c.name)).toEqual(['c1', 'c1-1', undefined])
    expect(st().selection).toEqual({ kind: 'connection', id: 'c1-1' })
    // Копия вставлена сразу за оригиналом.
    expect(st().template.variants[0].connections[1]).toMatchObject({ from: 'A', to: 'B', road: true, guardValue: 1000 })
  })

  it('безымянная связь дублируется по эффективному id «A-B»', () => {
    st().select('connection', 'A-B')
    render(<Inspector />)
    fireEvent.click(screen.getByRole('button', { name: 'Дублировать связь' }))
    expect(st().template.variants[0].connections.map((c) => c.name)).toEqual(['c1', undefined, 'A-B-1'])
    expect(st().selection).toEqual({ kind: 'connection', id: 'A-B-1' })
  })

  it('выбрана зона — видна только кнопка дублирования зоны, кнопки связи нет', () => {
    st().select('zone', 'A')
    render(<Inspector />)
    expect(screen.getByRole('button', { name: 'Дублировать зону (копия без связей)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Дублировать связь' })).toBeNull()
  })
})
