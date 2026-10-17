import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Select, type SelectOption } from './fields'

/**
 * Компонентный тест Select (vitest-проект `ui`, jsdom).
 *
 * Контракт allowBlank: по умолчанию рендерится blank-опция «—» (опциональные
 * поля можно «сбросить»), при allowBlank={false} — не рендерится вовсе
 * (обязательные поля: записать '' через UI нельзя). Регрессия против дефекта,
 * когда выбор «—» писал mode: "" в .rmg.json вместо удаления ключа, а выбор
 * «—» у обязательных полей тихо портил их пустой строкой.
 */

const OPTIONS: SelectOption[] = [
  { value: 'Direct' },
  { value: 'Portal', label: 'Портал · Portal' },
]

describe('fields: Select', () => {
  it('по умолчанию рендерит blank-опцию «—» первой', () => {
    render(<Select label="Тип" value="Direct" onChange={() => {}} options={OPTIONS} />)
    const select = screen.getByLabelText('Тип') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'Direct', 'Portal'])
    expect(select.options[0]?.textContent).toBe('—')
  })

  it('blankLabel переопределяет подпись blank-опции', () => {
    render(
      <Select label="Тип" value="" onChange={() => {}} options={OPTIONS} blankLabel="не задано" />,
    )
    const select = screen.getByLabelText('Тип') as HTMLSelectElement
    expect(select.options[0]?.textContent).toBe('не задано')
    expect(select.value).toBe('')
  })

  it('allowBlank={false} — blank-опции нет, остальные на месте', () => {
    render(
      <Select label="Тип" value="Direct" onChange={() => {}} options={OPTIONS} allowBlank={false} />,
    )
    const select = screen.getByLabelText('Тип') as HTMLSelectElement
    const values = Array.from(select.options).map((o) => o.value)
    expect(values).toEqual(['Direct', 'Portal'])
    expect(values).not.toContain('')
  })

  it('onChange получает значение выбранной опции (в т.ч. "" у blank)', () => {
    const onChange = vi.fn()
    render(<Select label="Тип" value="Direct" onChange={onChange} options={OPTIONS} />)
    fireEvent.change(screen.getByLabelText('Тип'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith('')
    fireEvent.change(screen.getByLabelText('Тип'), { target: { value: 'Portal' } })
    expect(onChange).toHaveBeenLastCalledWith('Portal')
  })
})
