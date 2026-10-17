import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TriangleAlert } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  /** Подпись-подсказка под сообщением (например, про Ctrl+Z); пустая — не рендерится. */
  hint?: string
  /** true — акцентная (опасная) кнопка подтверждения. */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Универсальная блокирующая модалка-подтверждение (замена window.confirm).
 * Escape и клик по подложке — отмена; автофокус на «Отмене» — защита от Enter.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  hint,
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div className="pb-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="cd" role="dialog" aria-modal="true" aria-label={title}>
        <div className="cd__body">
          <span className="cd__title">
            <TriangleAlert size={14} /> {title}
          </span>
          <p className="cd__message">{message}</p>
          {hint ? <p className="cd__hint">{hint}</p> : null}
        </div>
        <footer className="pv__foot">
          <span className="pv__status" />
          <span className="pv__actions">
            <button type="button" className="btn" ref={cancelRef} onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="button" className={`btn${danger ? ' btn--danger' : ' btn--primary'}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
