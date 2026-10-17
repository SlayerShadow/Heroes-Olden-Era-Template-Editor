import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ComboInput, type ComboSuggestion } from './fields'

/**
 * Компонентный тест ComboInput (vitest-проект `ui`, jsdom).
 *
 * ComboInput заменяет нативный <datalist>: открытие (focus/клик/ArrowDown)
 * показывает ПОЛНЫЙ список даже при непустом поле (нативный popup в этом
 * случае список скрывает), фильтрация включается только пока пользователь
 * печатает; список рендерится в portal на document.body (не зависит от
 * overflow:hidden у предков).
 * Строки ассертятся из настоящей ru-локали (setup поднимает i18n).
 */

const SUGGESTIONS: ComboSuggestion[] = [
  { value: 'remote_foothold', label: 'Опорный пункт' },
  { value: 'mine_gold', label: 'Золотая шахта' },
  { value: 'watchtower' },
]

function Harness({
  suggestions = SUGGESTIONS,
  initial = '',
  onSelect,
  onCommit,
}: {
  suggestions?: ComboSuggestion[]
  initial?: string
  onSelect?: (v: string) => void
  onCommit?: (v: string) => void
} = {}) {
  const [text, setText] = useState(initial)
  return (
    <ComboInput
      text={text}
      onText={setText}
      onSelect={onSelect}
      onCommit={onCommit}
      suggestions={suggestions}
      ariaLabel="тест-поле"
    />
  )
}

const input = () => screen.getByRole('combobox')
const options = () => Array.from(document.body.querySelectorAll<HTMLElement>('.combo__opt'))
const popup = () => document.body.querySelector('.combo__pop')

describe('ComboInput', () => {
  it('открытие по фокусу: полный список даже при непустом значении поля', () => {
    render(<Harness initial="remote_foothold" />)
    fireEvent.focus(input())
    expect(popup()).not.toBeNull()
    expect(options().map((o) => o.querySelector('.combo__opt-value')?.textContent)).toEqual([
      'remote_foothold',
      'mine_gold',
      'watchtower',
    ])
    // читаемое имя — основная подпись опции, title = «имя · ключ»
    expect(options()[0].querySelector('.combo__opt-label')?.textContent).toBe('Опорный пункт')
    expect(options()[0].getAttribute('title')).toBe('Опорный пункт · remote_foothold')
    // у опции без label подпись не дублирует значение
    expect(options()[2].querySelector('.combo__opt-label')).toBeNull()
  })

  it('набор текста фильтрует по подстроке value и label без учёта регистра', () => {
    render(<Harness />)
    fireEvent.focus(input())
    fireEvent.change(input(), { target: { value: 'опор' } })
    expect(options().map((o) => o.querySelector('.combo__opt-value')?.textContent)).toEqual(['remote_foothold'])
    fireEvent.change(input(), { target: { value: 'MINE' } })
    expect(options().map((o) => o.querySelector('.combo__opt-value')?.textContent)).toEqual(['mine_gold'])
  })

  it('нет совпадений: подсказка из ru-локали', () => {
    render(<Harness />)
    fireEvent.focus(input())
    fireEvent.change(input(), { target: { value: 'zzz' } })
    expect(options()).toHaveLength(0)
    expect(document.body.querySelector('.combo__empty')?.textContent).toBe('Нет совпадений')
  })

  it('клик по опции: onSelect и закрытие списка', () => {
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    fireEvent.focus(input())
    fireEvent.click(options()[1])
    expect(onSelect).toHaveBeenCalledWith('mine_gold')
    expect(popup()).toBeNull()
  })

  it('без onSelect выбор опции пишет текст в поле и коммитит', () => {
    const onCommit = vi.fn()
    render(<Harness onCommit={onCommit} />)
    fireEvent.focus(input())
    fireEvent.click(options()[0])
    expect((input() as HTMLInputElement).value).toBe('remote_foothold')
    expect(onCommit).toHaveBeenCalledWith('remote_foothold')
  })

  it('клавиатура: ArrowDown двигает активную опцию, Enter выбирает её, Escape закрывает без выбора', () => {
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    fireEvent.focus(input())
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    expect(options()[1].classList.contains('combo__opt--active')).toBe(true)
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('mine_gold')

    fireEvent.focus(input())
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(popup()).toBeNull()
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('mousedown вне поля и инпута закрывает список', () => {
    render(<Harness />)
    fireEvent.focus(input())
    expect(popup()).not.toBeNull()
    fireEvent.mouseDown(document.body)
    expect(popup()).toBeNull()
  })
})
