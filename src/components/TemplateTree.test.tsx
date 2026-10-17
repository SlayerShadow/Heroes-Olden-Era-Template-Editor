import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../store/editorStore'
import type { RmgTemplate, Zone } from '../types/rmg'
import { TemplateTree } from './TemplateTree'

/**
 * Компонентный тест контекстного меню дерева шаблона (vitest-проект `ui`, jsdom).
 * ПКМ по строке зоны / связи открывает ContextMenu с пунктами из ru-локали
 * (graph.ctx.*); действия применяются к варианту строки. Строки ассертятся
 * настоящие — заодно ловим потерянные ключи локализации.
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
    name: 'Tree Menu',
    gameMode: 'Classic',
    sizeX: 64,
    sizeZ: 64,
    variants: [
      {
        zones: [makeZone('A'), makeZone('B')],
        connections: [
          { name: 'c1', from: 'A', to: 'B', connectionType: 'Direct', road: true, guardValue: 1000 },
        ],
      },
      { zones: [makeZone('B')], connections: [] },
    ],
    zoneLayouts: [{ name: 'zone_layout_empty' }],
    valueOverrides: [],
    gameRules: {},
    globalBans: {},
    contentPools: [],
    contentLists: [],
  }
}

const zoneRow = (id: string, index = 0): HTMLElement => {
  const rows = document.querySelectorAll(`[data-sel-kind="zone"][data-sel-id="${id}"]`)
  const el = rows[index]
  if (!el) throw new Error(`zone row not found: ${id}#${index}`)
  return el as HTMLElement
}

const connRow = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-sel-kind="connection"][data-sel-id="${id}"]`)
  if (!el) throw new Error(`conn row not found: ${id}`)
  return el as HTMLElement
}

const menuLabels = (): string[] =>
  screen.getAllByRole('menuitem').map((b) => b.textContent ?? '')

beforeEach(() => {
  st().loadTemplate(makeTemplate(), 'tree-menu.rmg.json', null)
})

describe('TemplateTree: контекстное меню', () => {
  it('ПКМ по зоне: пункты «Дублировать зону» / «Удалить зону»; дубль создаёт копию и закрывает меню', () => {
    render(<TemplateTree />)
    fireEvent.contextMenu(zoneRow('A'), { clientX: 40, clientY: 60 })
    expect(menuLabels()).toEqual(['Дублировать зону', 'Удалить зону'])
    fireEvent.click(screen.getByText('Дублировать зону'))
    expect(st().template.variants[0].zones.map((z) => z.name)).toEqual(['A', 'B', 'Zone-1'])
    expect(st().template.variants[0].connections).toHaveLength(1) // связи не копируются
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('ПКМ по зоне: «Удалить зону» удаляет зону и её связи без модалки подтверждения', () => {
    render(<TemplateTree />)
    fireEvent.contextMenu(zoneRow('B'), { clientX: 40, clientY: 60 })
    const del = screen.getByText('Удалить зону')
    expect(del.className).toContain('ctx-menu__item--danger')
    fireEvent.click(del)
    expect(st().template.variants[0].zones.map((z) => z.name)).toEqual(['A'])
    expect(st().template.variants[0].connections).toHaveLength(0)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('ПКМ по связи: пункты «Дублировать связь» / «Удалить связь»; дубль создаёт копию, danger-пункт удаляет', () => {
    render(<TemplateTree />)
    fireEvent.contextMenu(connRow('c1'), { clientX: 40, clientY: 80 })
    expect(menuLabels()).toEqual(['Дублировать связь', 'Удалить связь'])
    fireEvent.click(screen.getByText('Дублировать связь'))
    expect(st().template.variants[0].connections.map((c) => c.name)).toEqual(['c1', 'c1-1'])
    expect(screen.queryByRole('menu')).toBeNull()
    // Удаление копии: danger-пункт остаётся единственным помеченным.
    fireEvent.contextMenu(connRow('c1-1'), { clientX: 40, clientY: 80 })
    const del = screen.getByText('Удалить связь')
    expect(del.className).toContain('ctx-menu__item--danger')
    fireEvent.click(del)
    expect(st().template.variants[0].connections.map((c) => c.name)).toEqual(['c1'])
    expect(st().template.variants[0].zones).toHaveLength(2)
  })

  it('ПКМ по строке неактивного варианта: действие применяется к варианту строки', () => {
    render(<TemplateTree />)
    // Раскрыть ветку V2 шевроном (активный вариант остаётся 0).
    const chevs = document.querySelectorAll('.tree-row__chev')
    fireEvent.click(chevs[1])
    // Строка зоны B варианта 1 — вторая с таким data-sel-id.
    fireEvent.contextMenu(zoneRow('B', 1), { clientX: 40, clientY: 120 })
    fireEvent.click(screen.getByText('Дублировать зону'))
    expect(st().activeVariant).toBe(1)
    expect(st().template.variants[0].zones.map((z) => z.name)).toEqual(['A', 'B'])
    expect(st().template.variants[1].zones.map((z) => z.name)).toEqual(['B', 'Zone-1'])
  })
})

describe('TemplateTree: слаботипизированные данные', () => {
  it('зона без mainObjects (минимальный файл после parseTemplate) рендерится без краша', () => {
    // Регресс белого экрана: isConnectorZone читал zone.mainObjects.length без защиты.
    const tpl = makeTemplate()
    for (const v of tpl.variants) {
      for (const z of v.zones) delete (z as Partial<Zone>).mainObjects
    }
    st().loadTemplate(tpl, 'minimal.rmg.json', null)
    render(<TemplateTree />)
    expect(zoneRow('A')).toBeTruthy()
    expect(zoneRow('B')).toBeTruthy()
    // Раскрыть ветку неактивного варианта — его строки тоже рендерятся без краша.
    const chevs = document.querySelectorAll('.tree-row__chev')
    fireEvent.click(chevs[1])
    expect(zoneRow('B', 1)).toBeTruthy()
  })
})
