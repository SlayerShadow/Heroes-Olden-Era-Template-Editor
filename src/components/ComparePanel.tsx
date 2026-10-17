import { useMemo, type ReactNode } from 'react'
import { GitCompareArrows, Minus, Pencil, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../store/editorStore'
import { variantDiff, type EntityDiff, type EntityDiffStatus, type FieldDiff } from '../utils/variantDiff'
import { fieldDiffText, fieldsDetail, fieldsSummary } from './compareText'

const STATUS_KEY: Record<EntityDiffStatus, string> = {
  added: 'compare.statusAdded',
  removed: 'compare.statusRemoved',
  changed: 'compare.statusChanged',
}

function statusIcon(status: EntityDiffStatus): ReactNode {
  switch (status) {
    case 'added':
      return <Plus size={12} className="issue__icon issue__icon--added" />
    case 'removed':
      return <Minus size={12} className="issue__icon issue__icon--removed" />
    case 'changed':
      return <Pencil size={12} className="issue__icon issue__icon--changed" />
  }
}

/**
 * Вкладка футера «Сравнение»: дифф активного варианта A (база, редактируется)
 * и выбранного варианта B (read-only наблюдатель). Клик по строке changed/removed
 * фокусирует сущность A на канве (тот же механизм, что в ValidatorPanel);
 * строки added некликабельны — в A фокусировать нечего.
 */
export function ComparePanel() {
  const { t } = useTranslation()
  const variants = useEditorStore((s) => s.template.variants)
  const activeVariant = useEditorStore((s) => s.activeVariant)
  const setActiveVariant = useEditorStore((s) => s.setActiveVariant)
  const compareWith = useEditorStore((s) => s.compareWith)
  const setCompareWith = useEditorStore((s) => s.setCompareWith)
  const select = useEditorStore((s) => s.select)

  // compareWith мог остаться от удалённого варианта — сторожим границу.
  const bIndex = compareWith !== null && compareWith < variants.length ? compareWith : null
  const diff = useMemo(
    () => (bIndex === null ? null : variantDiff(variants[activeVariant], variants[bIndex])),
    [variants, activeVariant, bIndex],
  )
  const count = diff ? diff.rootFields.length + diff.zones.length + diff.connections.length : 0

  const variantOptions = variants.map((v, i) => (
    <option key={i} value={i}>
      {t('app.variantOption', { index: i + 1, zones: v.zones?.length ?? 0 })}
    </option>
  ))

  const rootRow = (f: FieldDiff, i: number) => (
    <div key={`root-${i}`} className="issue is-root">
      <GitCompareArrows size={12} className="issue__icon issue__icon--info" />
      <span className="issue__scope">{f.field}</span>
      <span className="issue__msg">{fieldDiffText(f, t)}</span>
      <span className="issue__path" />
    </div>
  )

  const entityRow = (e: EntityDiff, i: number) => {
    const statusText = t(STATUS_KEY[e.status])
    if (e.idA !== null) {
      const idA = e.idA
      return (
        <button
          key={`${e.kind}-${i}`}
          type="button"
          className="issue issue--jumpable"
          title={e.fields.length ? fieldsDetail(e.fields, t) : t('compare.detailsTitle')}
          onClick={() => select(e.kind, idA, true)}
        >
          {statusIcon(e.status)}
          <span className="issue__scope">{e.label}</span>
          <span className="issue__msg">{fieldsSummary(e.fields, t)}</span>
          <span className="issue__path">{statusText}</span>
        </button>
      )
    }
    // added: сущности нет в базовом варианте A — навигация невозможна.
    return (
      <div key={`${e.kind}-${i}`} className="issue is-root" title={t('compare.addedTitle')}>
        {statusIcon(e.status)}
        <span className="issue__scope">{e.label}</span>
        <span className="issue__msg" />
        <span className="issue__path">{statusText}</span>
      </div>
    )
  }

  return (
    <div className="validator">
      <span
        className={`validator__chip validator__chip--info${count ? '' : ' is-muted'}`}
        title={t('compare.chipTitle')}
      >
        <GitCompareArrows size={11} />
        {count}
      </span>
      <details className="validator__details">
        <summary title={t('compare.detailsTitle')}>
          {bIndex === null
            ? t('compare.tab')
            : t('compare.summary', { a: activeVariant + 1, b: bIndex + 1 })}
        </summary>
        <div className="validator__body compare__body">
          <div className="compare__picks">
            <label>
              {t('compare.labelA')}
              <select
                value={activeVariant}
                onChange={(e) => setActiveVariant(Number(e.target.value))}
              >
                {variantOptions}
              </select>
            </label>
            <label>
              {t('compare.labelB')}
              <select
                value={bIndex ?? -1}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setCompareWith(n < 0 ? null : n)
                }}
              >
                <option value={-1}>{t('compare.noneB')}</option>
                {variantOptions}
              </select>
            </label>
          </div>
          {diff === null ? (
            <div className="compare__note">{t('compare.pickB')}</div>
          ) : diff.identical ? (
            <div className="compare__note">{t('compare.identical')}</div>
          ) : (
            <>
              {diff.rootFields.length > 0 && (
                <>
                  <div className="compare__group-title">{t('compare.groupRoot')}</div>
                  {diff.rootFields.map(rootRow)}
                </>
              )}
              {diff.zones.length > 0 && (
                <>
                  <div className="compare__group-title">{t('compare.groupZones')}</div>
                  {diff.zones.map(entityRow)}
                </>
              )}
              {diff.connections.length > 0 && (
                <>
                  <div className="compare__group-title">{t('compare.groupConnections')}</div>
                  {diff.connections.map(entityRow)}
                </>
              )}
            </>
          )}
        </div>
      </details>
    </div>
  )
}
