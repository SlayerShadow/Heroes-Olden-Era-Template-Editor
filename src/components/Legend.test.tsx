import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../store/editorStore'
import { Legend } from './Legend'

/**
 * Компонентный тест легенды в режиме «Биомы» (vitest-проект `ui`, jsdom).
 * Контракт локализации: имена биомов и слоёв — русские строки локали (`biomes.*`),
 * технические имена полей формата (zoneBiome, …) остаются только в подсказке
 * (title) и в данных. Строки ассертятся настоящие (ru-локаль).
 */

const st = () => useEditorStore.getState()

beforeEach(() => {
  st().setViewMode('biome')
  st().setBiomeLayer('zone')
})

describe('Legend: режим «Биомы»', () => {
  it('образцы биомов и активный слой — по-русски, имя поля только в title', () => {
    render(<Legend />)
    for (const label of ['Трава', 'Песок', 'Снег', 'Земля', 'Мёртвые земли', 'Осень', 'Лава']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    const head = screen.getByText('Активный слой: поверхность')
    expect(head).toHaveAttribute('title', 'zoneBiome')
    // Сырое имя поля не видно текстом в легенде — только в подсказке.
    expect(screen.queryByText('zoneBiome')).toBeNull()
  })

  it('переключение слоя меняет подпись и поле в подсказке', () => {
    render(<Legend />)
    act(() => st().setBiomeLayer('meta'))
    const head = screen.getByText('Активный слой: декорации')
    expect(head).toHaveAttribute('title', 'metaObjectsBiome')
  })
})
