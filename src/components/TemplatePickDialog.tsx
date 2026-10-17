import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Search, X } from 'lucide-react'
import type { FolderTemplate } from '../utils/fsAccess'
import { gameModeLabel } from '../utils/labels'

interface Props {
  open: boolean
  dirName: string
  templates: FolderTemplate[]
  onPick: (t: FolderTemplate) => void
  onClose: () => void
}

export function TemplatePickDialog({ open, dirName, templates, onPick, onClose }: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const q = search.trim().toLowerCase()
  const filtered = q
    ? templates.filter(
        (t) => t.name.toLowerCase().includes(q) || t.fileName.toLowerCase().includes(q) || t.template.name.toLowerCase().includes(q),
      )
    : templates

  return createPortal(
    <div className="pb-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tp" role="dialog" aria-modal="true" aria-label={t('pick.ariaLabel')}>
        <header className="pb__head">
          <span className="pb__title">
            <FolderOpen size={14} /> {t('pick.title', { dirName })}
          </span>
          <span className="pb__count">
            {filtered.length} / {templates.length}
          </span>
          <input
            className="input pb__search"
            autoFocus
            placeholder={t('pick.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('pick.close')}>
            <X size={15} />
          </button>
        </header>
        <div className="tp__body">
          {filtered.length === 0 ? (
            <div className="pb__empty">
              <Search size={14} /> {t('pick.empty')}
            </div>
          ) : (
            filtered.map((tpl) => (
              <button type="button" key={tpl.fileName} className="tp__row" onClick={() => onPick(tpl)}>
                <span className="tp__name">{tpl.name}</span>
                <span className="tp__meta">
                  {gameModeLabel(tpl.template.gameMode, t)} · {tpl.template.sizeX ?? '?'}×{tpl.template.sizeZ ?? '?'} ·{' '}
                  {t('pick.variantsCount', { count: tpl.template.variants.length })} ·{' '}
                  {t('pick.zonesCount', { count: tpl.template.variants.reduce((n, v) => n + (v.zones?.length ?? 0), 0) })}
                </span>
                <span className="tp__file">{tpl.fileName}</span>
              </button>
            ))
          )}
        </div>
        <footer className="pv__foot">
          <span className="pv__status">{t('pick.hint')}</span>
          <span className="pv__actions">
            <button type="button" className="btn" onClick={onClose}>
              {t('pick.cancel')}
            </button>
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
