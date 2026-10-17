import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { CircleAlert, Info } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'

/**
 * Стек персистентных уведомлений (замена window.alert): ничего не исчезает
 * само, закрытие — кликом по тосту. Рендерится порталом поверх всего UI.
 */
export function Toasts() {
  const { t } = useTranslation()
  const toasts = useEditorStore((s) => s.toasts)
  const dismissToast = useEditorStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return createPortal(
    <div className="toasts" role="region" aria-label={t('toasts.region')}>
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`toast toast--${toast.kind}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          title={t('toasts.dismiss')}
          aria-label={t('toasts.dismiss')}
          onClick={() => dismissToast(toast.id)}
        >
          {toast.kind === 'error' ? <CircleAlert size={14} /> : <Info size={14} />}
          <span className="toast__text">{toast.text}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
