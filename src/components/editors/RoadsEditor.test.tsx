import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { MainObject, Road } from '../../types/rmg'
import { RoadsEditor } from './RoadsEditor'

/**
 * Компонентный тест RoadsEditor (vitest-проект `ui`, jsdom).
 *
 * Закрывает два дефекта, найденных при разборе секции «Дороги»:
 * - карточка дороги обязана быть `<details class="mo road-item">`, а не `<div>`
 *   с «сиротским» `<summary>` (иначе тело дороги всегда раскрыто, треугольник
 *   `.mo summary::before` не работает и кнопка удаления тонет в стене селектов);
 * - кнопка «✕» в карточке реально удаляет дорогу и снимает поле `roads`
 *   (`onPatch({ roads: undefined })` — этот контракт ждёт `patchZone` в сторе).
 *
 * Строки ассертятся настоящие — из ru-локали (заодно ловим потерянные ключи).
 */

const MAIN_OBJECTS: MainObject[] = [
  { type: 'City', placement: 'Center' },
  { type: 'Spawn', spawn: 'PlayerHuman', placement: 'Uniform' },
]
const CONN_IDS = ['Center-Spawn-A', 'Center-Spawn-B']

const STONE_ROAD: Road = {
  type: 'Stone',
  from: { type: 'MainObject', args: ['0'] },
  to: { type: 'Connection', args: ['Center-Spawn-A'] },
}
const CROSSROADS_ROAD: Road = {
  type: 'Dirt',
  from: { type: 'MainObject', args: ['1'] },
  to: { type: 'Crossroads', args: [] },
}

/** Карточки дорог (регрессия на `<details>`, а не `<div class="mo">`). */
const cards = (c: HTMLElement) => c.querySelectorAll('details.road-item')

/** Обёртка повторяет подключение в ZoneEditor: onPatch → patch зоны. */
function Harness({ initial = [] }: { initial?: Road[] }) {
  const [roads, setRoads] = useState<Road[]>(initial)
  return (
    <RoadsEditor
      roads={roads}
      mainObjects={MAIN_OBJECTS}
      connIds={CONN_IDS}
      mcItemNames={[]}
      onPatch={(p) => setRoads(p.roads ?? [])}
    />
  )
}

function renderEditor(roads: Road[], onPatch = vi.fn()) {
  const view = render(
    <RoadsEditor
      roads={roads}
      mainObjects={MAIN_OBJECTS}
      connIds={CONN_IDS}
      mcItemNames={[]}
      onPatch={onPatch}
    />,
  )
  return { ...view, onPatch }
}

const delButtons = () => screen.getAllByRole('button', { name: 'Удалить дорогу' })

describe('RoadsEditor', () => {
  it('пустая зона: подсказка и кнопка добавления, карточек нет', () => {
    const { container } = render(<Harness />)
    expect(screen.getByText('У зоны нет дорог — добавьте первую.')).toBeInTheDocument()
    expect(cards(container)).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'дорогу' })).toBeInTheDocument()
  })

  it('кнопка «дорогу» добавляет дорогу с дефолтными концами', () => {
    const { container } = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'дорогу' }))
    expect(cards(container)).toHaveLength(1)
    expect(screen.getByText('Stone', { selector: '.road-item__surface' })).toBeInTheDocument()
    expect(screen.getByText('объект [0] → связь «Center-Spawn-A»')).toBeInTheDocument()
  })

  it('карточка дороги — <details> со сводкой в <summary>', () => {
    const { container } = render(<Harness initial={[STONE_ROAD]} />)
    const card = cards(container)[0]
    expect(card.tagName).toBe('DETAILS')
    expect(card.querySelector('summary')).not.toBeNull()
    // сводка в заголовке: покрытие + концы (один текстовый узел summary-хинта)
    const card1 = card as HTMLElement
    expect(within(card1).getByText('Stone', { selector: '.road-item__surface' })).toBeInTheDocument()
    expect(
      within(card1).getByText('объект [0] → связь «Center-Spawn-A»'),
    ).toBeInTheDocument()
  })

  it('кнопка «✕» удаляет единственную дорогу', () => {
    const { container } = render(<Harness initial={[STONE_ROAD]} />)
    fireEvent.click(delButtons()[0])
    expect(cards(container)).toHaveLength(0)
    expect(screen.getByText('У зоны нет дорог — добавьте первую.')).toBeInTheDocument()
  })

  it('удаление одной дороги из нескольких оставляет остальные', () => {
    const { container } = render(<Harness initial={[STONE_ROAD, CROSSROADS_ROAD]} />)
    expect(cards(container)).toHaveLength(2)
    fireEvent.click(delButtons()[0])
    expect(cards(container)).toHaveLength(1)
    expect(screen.queryByText('объект [0] → связь «Center-Spawn-A»')).toBeNull()
    expect(screen.getByText('объект [1] → Crossroads')).toBeInTheDocument()
  })

  it('удаление последней дороги снимает поле roads (roads: undefined)', () => {
    const { onPatch } = renderEditor([STONE_ROAD])
    fireEvent.click(delButtons()[0])
    expect(onPatch).toHaveBeenCalledWith({ roads: undefined })
  })

  it('смена поверхности обновляет только выбранную дорогу', () => {
    const { container, onPatch } = renderEditor([STONE_ROAD, CROSSROADS_ROAD])
    const surface = within(cards(container)[0] as HTMLElement).getByLabelText('поверхность')
    fireEvent.change(surface, { target: { value: 'Dirt' } })
    expect(onPatch).toHaveBeenLastCalledWith({ roads: [{ ...STONE_ROAD, type: 'Dirt' }, CROSSROADS_ROAD] })
    // пустое значение селекта = «не задано»: type удаляется из объекта
    fireEvent.change(surface, { target: { value: '' } })
    expect(onPatch).toHaveBeenLastCalledWith({
      roads: [{ from: STONE_ROAD.from, to: STONE_ROAD.to }, CROSSROADS_ROAD],
    })
  })

  it('смена типа конца сбрасывает его аргументы', () => {
    const { onPatch } = renderEditor([STONE_ROAD])
    const typeSelect = screen.getAllByLabelText('тип')[1]
    fireEvent.change(typeSelect, { target: { value: 'Crossroads' } })
    expect(onPatch).toHaveBeenLastCalledWith({
      roads: [{ ...STONE_ROAD, to: { type: 'Crossroads', args: [] } }],
    })
  })
})
