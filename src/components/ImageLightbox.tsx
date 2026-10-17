/**
 * Лайтбокс — изображение на всё окно поверх остального интерфейса.
 *
 * Клик в любом месте слоя (в том числе по самой картинке) или крестик
 * закрывают просмотр. Закрытие не мгновенное: владелец сбрасывает `image`
 * в null, компонент помечает слой `is-closing` и снимается с монтирования
 * только по таймеру FADE_MS — затемнение фона плавно гаснет (fade), а не
 * обрывается резким скачком. Таймер выбран вместо события `animationend`:
 * CSS-анимации не проигрываются в jsdom и отключаются при
 * `prefers-reduced-motion`, а зависший затемнённый слой блокировал бы весь UI.
 *
 * Esc обрабатывает владелец (ManualDialog): один слушатель там решает, какой
 * слой гасить первым — картинку или сам мануал.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

export type LightboxImage = {
  /** URL изображения (в мануале — результат `manualImageSrc`) */
  src: string
  /** Подпись под изображением (alt картинки из markdown) */
  alt: string
}

/** Длительность fade-эффекта, мс — должна совпадать с CSS `.lightbox` (0.16s). */
const FADE_MS = 160

export function ImageLightbox({ image, onClose }: { image: LightboxImage | null; onClose: () => void }) {
  const { t } = useTranslation()
  // Последний показанный кадр: нужен, чтобы дорисовать фазу закрытия (fade).
  // Корректировка во время рендера (а не в эффекте) — рекомендованный React
  // способ хранить значение из предыдущих пропов.
  const [shown, setShown] = useState<LightboxImage | null>(image)
  if (image !== null && image !== shown) setShown(image)
  const closing = image === null && shown !== null

  // Фаза закрытия: слой живёт ещё FADE_MS, пока CSS гасит затемнение фона
  useEffect(() => {
    if (!closing) return
    const id = window.setTimeout(() => setShown(null), FADE_MS)
    return () => window.clearTimeout(id)
  }, [closing])

  if (shown === null) return null

  return createPortal(
    <div
      className={`lightbox${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('manual.lightboxTitle')}
      onClick={onClose}
    >
      <img className="lightbox__img" src={shown.src} alt={shown.alt} />
      {shown.alt !== '' && <div className="lightbox__caption">{shown.alt}</div>}
      <button
        type="button"
        className="icon-btn lightbox__close"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label={t('manual.lightboxClose')}
        title={t('manual.lightboxCloseTitle')}
      >
        <X size={15} />
      </button>
    </div>,
    document.body,
  )
}
