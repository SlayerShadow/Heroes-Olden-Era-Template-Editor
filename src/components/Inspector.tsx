import { useCallback, useMemo } from 'react'
import { Copy, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../store/editorStore'
import type { Connection, Zone } from '../types/rmg'
import { validateConnDraft, validateZoneDraft } from '../utils/jsonEdit'
import { findEntityDiff, variantDiff } from '../utils/variantDiff'
import { fieldsDetail, fieldsSummary } from './compareText'
import { ConnEditor } from './editors/ConnEditor'
import { JsonEditor } from './editors/JsonEditor'
import { ZoneEditor } from './editors/ZoneEditor'
import { ContentLimitsPanel, MandatoryContentPanel } from './editors/RootPanels'
import { RootPanel } from './editors/RootPanel'
import { VariantPanel } from './editors/VariantPanel'

export function Inspector() {
  const { t } = useTranslation()
  const selection = useEditorStore((s) => s.selection)
  const findZone = useEditorStore((s) => s.findZone)
  const findConnection = useEditorStore((s) => s.findConnection)
  const select = useEditorStore((s) => s.select)
  const tab = useEditorStore((s) => s.inspectorTab)
  const setTab = useEditorStore((s) => s.setInspectorTab)
  const loadSeq = useEditorStore((s) => s.loadSeq)
  const removeZone = useEditorStore((s) => s.removeZone)
  const duplicateZone = useEditorStore((s) => s.duplicateZone)
  const removeConnection = useEditorStore((s) => s.removeConnection)
  const duplicateConnection = useEditorStore((s) => s.duplicateConnection)
  const replaceZone = useEditorStore((s) => s.replaceZone)
  const replaceConnection = useEditorStore((s) => s.replaceConnection)
  const variant = useEditorStore((s) => s.template.variants[s.activeVariant])
  const variants = useEditorStore((s) => s.template.variants)
  const activeVariant = useEditorStore((s) => s.activeVariant)
  const compareWith = useEditorStore((s) => s.compareWith)

  const zone = selection.kind === 'zone' && selection.id ? findZone(selection.id) : undefined
  const conn =
    selection.kind === 'connection' && selection.id ? findConnection(selection.id) : undefined
  const title = zone ? zone.name : conn?.name ?? `${conn?.from}–${conn?.to}`
  const hasSelection = Boolean(zone || conn)

  const onDelete = () => {
    if (selection.kind === 'zone' && zone) removeZone(zone.name)
    else if (selection.kind === 'connection' && conn) removeConnection(conn.name ?? `${conn.from}-${conn.to}`)
  }

  // Имена других зон варианта — блокировать переименование в занятое имя.
  const zoneTakenNames = useMemo(
    () => (zone ? (variant?.zones ?? []).filter((z) => z.name !== zone.name).map((z) => z.name) : []),
    [variant, zone],
  )
  const validateZoneJson = useCallback(
    (parsed: unknown) => validateZoneDraft(parsed, zoneTakenNames),
    [zoneTakenNames],
  )
  const validateConnJson = useCallback((parsed: unknown) => validateConnDraft(parsed), [])
  const zoneName = zone?.name
  const applyZoneJson = useCallback(
    (parsed: unknown) => replaceZone(zoneName as string, parsed as Zone),
    [replaceZone, zoneName],
  )
  const connId = conn ? (conn.name ?? `${conn.from}-${conn.to}`) : undefined
  const applyConnJson = useCallback(
    (parsed: unknown) => replaceConnection(connId as string, parsed as Connection),
    [replaceConnection, connId],
  )

  // Бейдж сравнения: отличия выбранной сущности от варианта B (read-only).
  const diffBadge = useMemo((): { text: string; detail: string; missing: boolean } | null => {
    if (compareWith === null || compareWith === activeVariant || !hasSelection) return null
    const a = variants[activeVariant]
    const b = variants[compareWith]
    if (!a || !b) return null
    const id = selection.kind === 'zone' ? zone?.name : connId
    if (!id) return null
    const d = findEntityDiff(
      variantDiff(a, b),
      selection.kind === 'zone' ? 'zone' : 'connection',
      id,
    )
    if (!d || d.status === 'added') return null
    if (d.status === 'removed') {
      return { text: t('compare.inspectorMissing', { index: compareWith + 1 }), detail: '', missing: true }
    }
    return {
      text: t('compare.inspectorBadge', { index: compareWith + 1, fields: fieldsSummary(d.fields, t) }),
      detail: fieldsDetail(d.fields, t),
      missing: false,
    }
  }, [compareWith, activeVariant, variants, hasSelection, selection.kind, zone, connId, t])

  return (
    <div className="inspector">
      <div className="inspector__tabs">
        <button type="button" className={`inspector__tab${tab === 'inspector' ? ' is-on' : ''}`} onClick={() => setTab('inspector')}>
          {t('inspector.tabInspector')}
        </button>
        <button type="button" className={`inspector__tab${tab === 'content' ? ' is-on' : ''}`} onClick={() => setTab('content')}>
          {t('inspector.tabContent')}
        </button>
        <button type="button" className={`inspector__tab${tab === 'limits' ? ' is-on' : ''}`} onClick={() => setTab('limits')}>
          {t('inspector.tabLimits')}
        </button>
        <button type="button" className={`inspector__tab${tab === 'root' ? ' is-on' : ''}`} onClick={() => setTab('root')}>
          {t('inspector.tabRoot')}
        </button>
        <button type="button" className={`inspector__tab${tab === 'variant' ? ' is-on' : ''}`} onClick={() => setTab('variant')}>
          {t('inspector.tabVariant')}
        </button>
      </div>

      {tab === 'root' && <RootPanel key={loadSeq} />}
      {tab === 'variant' && <VariantPanel />}
      {tab === 'content' && <MandatoryContentPanel />}
      {tab === 'limits' && <ContentLimitsPanel />}
      {tab === 'inspector' &&
        (hasSelection ? (
          <>
            <div className="inspector__head">
              <span className="inspector__kind">{selection.kind === 'zone' ? t('inspector.kindZone') : t('inspector.kindConnection')}</span>
              <span className="inspector__title">{title}</span>
              {diffBadge && (
                <span
                  className={`inspector__diff${diffBadge.missing ? ' inspector__diff--missing' : ''}`}
                  title={diffBadge.detail || undefined}
                >
                  {diffBadge.text}
                </span>
              )}
              {zone && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => duplicateZone(zone.name)}
                  title={t('inspector.duplicateZoneTitle')}
                  aria-label={t('inspector.duplicateZoneTitle')}
                >
                  <Copy size={14} />
                </button>
              )}
              {conn && connId && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => duplicateConnection(connId)}
                  title={t('inspector.duplicateConnectionTitle')}
                  aria-label={t('inspector.duplicateConnectionTitle')}
                >
                  <Copy size={14} />
                </button>
              )}
              <button
                type="button"
                className="icon-btn"
                onClick={onDelete}
                title={selection.kind === 'zone' ? t('inspector.deleteZoneTitle') : t('inspector.deleteConnectionTitle')}
              >
                <Trash2 size={14} />
              </button>
              <button type="button" className="icon-btn" onClick={() => select(null, null)} aria-label={t('inspector.closeAria')}>
                <X size={14} />
              </button>
            </div>
            {zone && <ZoneEditor zone={zone} key={`z-${zone.name}`} />}
            {conn && <ConnEditor conn={conn} key={`c-${conn.name ?? `${conn.from}-${conn.to}`}`} />}
            <details className="inspector__raw">
              <summary>{t('inspector.rawJson')}</summary>
              {zone && (
                <JsonEditor
                  draftKey={`zone:${zone.name}`}
                  value={zone}
                  validate={validateZoneJson}
                  onApply={applyZoneJson}
                  rows={16}
                />
              )}
              {!zone && conn && (
                <JsonEditor
                  draftKey={`conn:${connId}`}
                  value={conn}
                  validate={validateConnJson}
                  onApply={applyConnJson}
                  rows={12}
                />
              )}
            </details>
          </>
        ) : (
          <div className="inspector inspector--empty">
            {t('inspector.empty')}
          </div>
        ))}
    </div>
  )
}