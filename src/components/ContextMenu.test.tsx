import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ContextMenu, type ContextMenuState } from './ContextMenu'

function makeState(items: ContextMenuState['items']): ContextMenuState {
  return { x: 120, y: 80, items }
}

describe('ContextMenu', () => {
  it('ничего не рисует при state=null', () => {
    const { container } = render(<ContextMenu state={null} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('рисует пункты; клик по пункту вызывает onSelect и закрывает меню', () => {
    const onCreate = vi.fn()
    const onDelete = vi.fn()
    const onClose = vi.fn()
    render(
      <ContextMenu
        state={makeState([
          { label: 'Создать зону', onSelect: onCreate },
          { label: 'Удалить зону', onSelect: onDelete, danger: true },
        ])}
        onClose={onClose}
      />,
    )
    const create = screen.getByRole('menuitem', { name: 'Создать зону' })
    const del = screen.getByRole('menuitem', { name: 'Удалить зону' })
    expect(del.className).toContain('ctx-menu__item--danger')
    fireEvent.click(create)
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onDelete).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('нажатие внутри меню не закрывает; нажатие вне и Escape закрывают', () => {
    const onClose = vi.fn()
    const { container } = render(
      <ContextMenu state={makeState([{ label: 'Пункт', onSelect: vi.fn() }])} onClose={onClose} />,
    )
    const item = container.querySelector('.ctx-menu__item')
    expect(item).not.toBeNull()
    fireEvent.mouseDown(item as Element)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
    onClose.mockClear()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
