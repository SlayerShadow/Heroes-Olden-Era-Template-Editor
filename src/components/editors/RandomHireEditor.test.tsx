import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RandomHireEditor } from './ZoneEditor'

/**
 * Компонентный тест RandomHireEditor (vitest-проект `ui`, jsdom).
 * Таблица «Внешний найм» (random_hire_1..7): независимое включение колонок
 * «Начальный найм» / «Еженедельный прирост» (вкл — массив ровно из 7,
 * выкл — undefined), правка ячеек с коммитом на blur, откат невалидного
 * ввода, предупреждение и нормализация массивов длины ≠ 7 из файла,
 * массовые операции заполнения.
 */

function seven<T>(v: T): T[] {
  return Array.from({ length: 7 }, () => v)
}

const rowInput = (n: number) =>
  screen.getByRole('spinbutton', { name: `Начальный найм — ярус ${n}` })

const rowCheck = (n: number) =>
  screen.getByRole('checkbox', { name: `Еженедельный прирост — ярус ${n}` })

describe('RandomHireEditor', () => {
  it('не задано: колонки выключены, инпуты disabled; включение записывает массив из 7', () => {
    const onInitialChange = vi.fn()
    const onWeeklyChange = vi.fn()
    render(<RandomHireEditor onInitialChange={onInitialChange} onWeeklyChange={onWeeklyChange} />)
    const initialToggle = screen.getByRole('checkbox', { name: 'Начальный найм' })
    const weeklyToggle = screen.getByRole('checkbox', { name: 'Еженедельный прирост' })
    expect(initialToggle).not.toBeChecked()
    expect(weeklyToggle).not.toBeChecked()
    expect(rowInput(1)).toBeDisabled()
    expect(rowCheck(1)).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Применить' })).not.toBeInTheDocument()

    fireEvent.click(initialToggle)
    expect(onInitialChange).toHaveBeenCalledWith(seven(0))
    fireEvent.click(weeklyToggle)
    expect(onWeeklyChange).toHaveBeenCalledWith(seven(false))
  })

  it('выключение колонки удаляет поле (undefined)', () => {
    const onInitialChange = vi.fn()
    const onWeeklyChange = vi.fn()
    render(
      <RandomHireEditor
        initial={seven(3)}
        weekly={seven(true)}
        onInitialChange={onInitialChange}
        onWeeklyChange={onWeeklyChange}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Начальный найм' }))
    expect(onInitialChange).toHaveBeenCalledWith(undefined)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Еженедельный прирост' }))
    expect(onWeeklyChange).toHaveBeenCalledWith(undefined)
  })

  it('правка ячейки: число коммитится на blur, флаг — сразу', () => {
    const onInitialChange = vi.fn()
    const onWeeklyChange = vi.fn()
    render(
      <RandomHireEditor
        initial={seven(2)}
        weekly={seven(false)}
        onInitialChange={onInitialChange}
        onWeeklyChange={onWeeklyChange}
      />,
    )
    fireEvent.change(rowInput(3), { target: { value: '5' } })
    expect(onInitialChange).not.toHaveBeenCalled() // не коммитится до blur
    fireEvent.blur(rowInput(3))
    expect(onInitialChange).toHaveBeenCalledWith([2, 2, 5, 2, 2, 2, 2])

    fireEvent.click(rowCheck(2))
    expect(onWeeklyChange).toHaveBeenCalledWith([false, true, false, false, false, false, false])
  })

  it('невалидное число откатывается на blur без вызова onChange', () => {
    const onInitialChange = vi.fn()
    render(
      <RandomHireEditor
        initial={seven(2)}
        onInitialChange={onInitialChange}
        onWeeklyChange={vi.fn()}
      />,
    )
    fireEvent.change(rowInput(1), { target: { value: '-3' } })
    fireEvent.blur(rowInput(1))
    expect(onInitialChange).not.toHaveBeenCalled()
    expect(rowInput(1)).toHaveValue(2)
  })

  it('массивы длины ≠ 7 из файла: предупреждение + нормализация до 7 при первой правке', () => {
    const onInitialChange = vi.fn()
    const onWeeklyChange = vi.fn()
    render(
      <RandomHireEditor
        initial={[6, 5, 5, 4, 4]}
        weekly={[true, true, true]}
        onInitialChange={onInitialChange}
        onWeeklyChange={onWeeklyChange}
      />,
    )
    expect(screen.getByText(/Начальный найм: в файле массив из 5/)).toBeInTheDocument()
    expect(screen.getByText(/Еженедельный прирост: в файле массив из 3/)).toBeInTheDocument()

    fireEvent.change(rowInput(7), { target: { value: '1' } })
    fireEvent.blur(rowInput(7))
    expect(onInitialChange).toHaveBeenCalledWith([6, 5, 5, 4, 4, 0, 1])

    fireEvent.click(rowCheck(5))
    expect(onWeeklyChange).toHaveBeenCalledWith([true, true, true, false, true, false, false])
  })

  it('массовые операции: заполнить все числом, включить/снять все флаги', () => {
    const onInitialChange = vi.fn()
    const onWeeklyChange = vi.fn()
    render(
      <RandomHireEditor
        initial={seven(2)}
        weekly={seven(false)}
        onInitialChange={onInitialChange}
        onWeeklyChange={onWeeklyChange}
      />,
    )
    const apply = screen.getByRole('button', { name: 'Применить' })
    expect(apply).toBeDisabled() // пустое значение — невалидно
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Заполнить все' }), {
      target: { value: '4' },
    })
    fireEvent.click(apply)
    expect(onInitialChange).toHaveBeenCalledWith(seven(4))

    fireEvent.click(screen.getByRole('button', { name: 'Включить все' }))
    expect(onWeeklyChange).toHaveBeenCalledWith(seven(true))
    fireEvent.click(screen.getByRole('button', { name: 'Снять все' }))
    expect(onWeeklyChange).toHaveBeenCalledWith(seven(false))
  })
})
