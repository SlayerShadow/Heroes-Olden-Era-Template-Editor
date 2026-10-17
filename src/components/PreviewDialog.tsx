import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Download, FolderPlus, Image, RefreshCw, X } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import {
  canvasToPngBlob,
  PREVIEW_SIZE,
  renderPreviewCanvas,
  variantPreviewLabel,
} from '../utils/preview'
import { sanitizeFileName, supportsFsAccess, writeBlobFile } from '../utils/fsAccess'

export function PreviewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const template = useEditorStore((s) => s.template)
  const positions = useEditorStore((s) => s.positions)
  const activeVariant = useEditorStore((s) => s.activeVariant)
  const dirHandle = useEditorStore((s) => s.dirHandle)
  const rootName = useEditorStore((s) => s.rootName)

  const [url, setUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const regenerate = () => {
    const canvas = renderPreviewCanvas(template, positions, activeVariant, PREVIEW_SIZE)
    if (!canvas) {
      setUrl(null)
      setBlob(null)
      return
    }
    setUrl(canvas.toDataURL('image/png'))
    canvasToPngBlob(canvas).then((b) => setBlob(b))
  }

  useEffect(() => {
    if (!open) return
    regenerate()
    setStatus(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeVariant, template, positions])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const base = sanitizeFileName(template.name)
  const variant = template.variants[activeVariant]
  const zoneCount = variant?.zones?.length ?? 0
  const connCount = variant?.connections?.length ?? 0
  const canSave = Boolean(dirHandle && blob)

  const saveToFolder = async () => {
    if (!dirHandle || !blob) return
    const fileName = `${base}.png`
    const ok = await writeBlobFile(dirHandle, fileName, blob)
    setStatus(ok ? t('preview.saved', { rootName, fileName }) : t('preview.saveFailed', { fileName }))
  }

  const download = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `${base}.png`
    a.click()
  }

  return createPortal(
    <div
      className="pb-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="pv">
        <header className="pv__head">
          <span className="pv__title">
            <Image size={14} /> {t('preview.title', { label: variantPreviewLabel(template, activeVariant) })}
          </span>
          <span className="pv__count">
            {t('graph.zones', { count: zoneCount })} · {t('graph.connections', { count: connCount })} · {PREVIEW_SIZE}×{PREVIEW_SIZE}
          </span>
          <button
            type="button"
            className="btn"
            onClick={regenerate}
            title={t('preview.regenerateTitle')}
          >
            <RefreshCw size={12} /> {t('preview.refresh')}
          </button>
          <button type="button" className="icon-btn pv__close" onClick={onClose} aria-label={t('preview.close')}>
            <X size={15} />
          </button>
        </header>
        <div className="pv__body">
          {url && blob ? (
            <>
              <img className="pv__img" src={url} alt={t('preview.alt')} />
              <div className="pv__meta">
                <div className="pv__file">
                  <span className="pv__filekey">{t('preview.fileKey')}</span>
                  <span className="pv__fname">{base}.png</span>
                </div>
                <div className="pv__hint">{t('preview.hint')}</div>
              </div>
            </>
          ) : (
            <div className="pb__empty">{t('preview.empty')}</div>
          )}
        </div>
        <footer className="pv__foot">
          {status ? <span className="pv__status">{status}</span> : <span />}
          <span className="pv__actions">
            <button type="button" className="btn" onClick={download} title={t('preview.downloadTitle')}>
              <Download size={12} /> {t('preview.download')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={saveToFolder}
              disabled={!canSave}
              title={
                dirHandle
                  ? t('preview.saveTitle', { file: `${base}.png`, rootName })
                  : t('preview.pickFolderFirst')
              }
            >
              <FolderPlus size={12} /> {supportsFsAccess() ? t('preview.saveToFolder') : t('preview.downloadPng')}
            </button>
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  )
}