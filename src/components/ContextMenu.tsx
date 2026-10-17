import { useEffect, useRef } from 'react'

/** Пункт контекстного меню (ПКМ по канве / зоне / связи). */
export interface ContextMenuItem {
  label: string
  onSelect: () => void
  /** Опасное действие (удаление) — подсвечивается красным. */
  danger?: boolean
}

/** Состояние открытого меню: экранные координаты клика и пункты. null — меню закрыто. */
export interface ContextMenuState {
  x: number
  y: number
  items: ContextMenuItem[]
}

const MENU_W = 200
const ITEM_H = 32

/**
 * Контекстное меню в точке курсора (position: fixed). Закрывается после выбора
 * пункта, по Escape, по нажатию вне меню и при изменении размера окна.
 * Меню не выходит за правый/нижний край окна.
 */
export function ContextMenu({
  state,
  onClose,
}: {
  state: ContextMenuState | null
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!state) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onResize = () => onClose()
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [state, onClose])

  if (!state) return null
  const x = Math.max(4, Math.min(state.x, window.innerWidth - MENU_W - 8))
  const y = Math.max(4, Math.min(state.y, window.innerHeight - state.items.length * ITEM_H - 12))
  return (
    <div ref={ref} className="ctx-menu" style={{ left: x, top: y }} role="menu">
      {state.items.map((item, i) => (
        <button
          key={`${i}-${item.label}`}
          type="button"
          role="menuitem"
          className={`ctx-menu__item${item.danger ? ' ctx-menu__item--danger' : ''}`}
          onClick={() => {
            onClose()
            item.onSelect()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
