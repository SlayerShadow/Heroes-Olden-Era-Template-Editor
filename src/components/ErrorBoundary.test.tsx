import { render, screen } from '@testing-library/react'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

/**
 * Компонентный тест экрана краша рендера (vitest-проект `ui`, jsdom).
 * Регресс «белого экрана»: без boundary любая ошибка рендера размонтировала
 * всё дерево; с ней показывается карточка с диагностикой и кнопкой перезагрузки.
 * Строки ассертятся настоящие из ru-локали (error.*) — заодно ловим потерянные ключи.
 */

function Bomb({ boom }: { boom: boolean }) {
  if (boom) throw new Error('render boom')
  return <div>живое дерево</div>
}

// React логирует пойманную ошибку через console.error — глушим, чтобы не засорять вывод.
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
afterAll(() => consoleError.mockRestore())

describe('ErrorBoundary', () => {
  it('без ошибки пропускает children', () => {
    render(
      <ErrorBoundary>
        <Bomb boom={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('живое дерево')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('ошибка рендера — карточка с диагностикой вместо белого экрана', () => {
    render(
      <ErrorBoundary>
        <Bomb boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Редактор упал при отрисовке')).toBeInTheDocument()
    // Текст и стек ошибки видны — их можно скопировать в отчёт.
    expect(screen.getByText(/render boom/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Перезагрузить страницу' }),
    ).toBeInTheDocument()
  })
})
