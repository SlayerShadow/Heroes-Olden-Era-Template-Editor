import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../../store/editorStore'
import type { RmgTemplate } from '../../types/rmg'
import { VariantPanel } from './VariantPanel'

/**
 * Компонентный тест VariantPanel (vitest-проект `ui`, jsdom).
 *
 * Проверяет, что select «Режим укладки» показывает локализованные имена
 * закрытого enum OrientationMode в формате «Русское имя · оригинальный ключ»
 * (ключи variant.modes.*, настоящие строки ru-локали) и что выбор значения
 * записывается в store через patchActiveVariant (сырой ключ в .rmg.json
 * не меняется — локализация только на виду).
 */

const TEMPLATE: RmgTemplate = {
  name: 'Test',
  gameMode: 'Classic',
  variants: [
    {
      zones: [],
      connections: [],
      orientation: { mode: 'BoundingCircle' },
    },
  ],
}

beforeEach(() => {
  useEditorStore.setState({ template: TEMPLATE, activeVariant: 0 })
})

const modeSelect = () => screen.getByLabelText('Режим укладки') as HTMLSelectElement
const optionTexts = () => Array.from(modeSelect().options).map((o) => o.textContent)

describe('VariantPanel: режим укладки', () => {
  beforeEach(() => {
    render(<VariantPanel />)
  })

  it('опции — русские имена с оригинальным ключом через « · »', () => {
    expect(optionTexts()).toEqual([
      '—',
      'Минимальный ограничивающий квадрат · MinimalBoundingSquare',
      'Ограничивающая окружность · BoundingCircle',
    ])
  })

  it('текущее значение показывается локализованно', () => {
    const select = modeSelect()
    expect(select.value).toBe('BoundingCircle')
    expect(select.selectedOptions[0]?.textContent).toBe(
      'Ограничивающая окружность · BoundingCircle',
    )
  })

  it('выбор другого режима записывает сырой ключ в store', () => {
    fireEvent.change(modeSelect(), { target: { value: 'MinimalBoundingSquare' } })
    const next = useEditorStore.getState().template.variants[0]
    expect(next?.orientation?.mode).toBe('MinimalBoundingSquare')
  })

  it('выбор «—» убирает ключ mode (undefined), а не пишет пустую строку', () => {
    fireEvent.change(modeSelect(), { target: { value: '' } })
    const orientation = useEditorStore.getState().template.variants[0]?.orientation
    expect(orientation?.mode).toBeUndefined()
    // ключ с undefined выпадает при сериализации — mode: "" в файл не попадёт
    expect(JSON.stringify(orientation)).not.toContain('"mode"')
  })
})
