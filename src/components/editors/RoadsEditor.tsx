import { Plus } from 'lucide-react'
import type {
  MainObject,
  Road,
  RoadEndpoint,
  RoadEndpointType,
  RoadSurface,
  Zone,
} from '../../types/rmg'
import { useTranslation } from 'react-i18next'
import { Select } from './fields'

const ROAD_SURFACES: RoadSurface[] = ['Stone', 'Dirt']
const ENDPOINT_TYPES: RoadEndpointType[] = ['MainObject', 'Connection', 'Crossroads', 'MandatoryContent']

function RoadEndpointEditor({
  label,
  end,
  mainObjects,
  connIds,
  mcItemNames,
  onChange,
}: {
  label: string
  end: RoadEndpoint
  mainObjects: MainObject[]
  connIds: string[]
  mcItemNames: string[]
  onChange: (end: RoadEndpoint) => void
}) {
  const { t } = useTranslation()
  const args = end.args ?? []
  const setType = (type: string) => onChange({ type: type as RoadEndpointType, args: [] })
  const setArg = (arg: string) => onChange({ ...end, args: arg ? [arg] : [] })

  return (
    <div className="full">
      <span className="ef__label">{t('roads.endSuffix', { label })}</span>
      <div className="mc-rule road-end">
        <Select
          label={t('roads.typeLabel')}
          allowBlank={false}
          value={end.type}
          onChange={setType}
          options={ENDPOINT_TYPES.map((ty) => ({ value: ty, label: `${t(`roads.endpoints.${ty}`)} · ${ty}` }))}
        />
        {end.type === 'MainObject' && (
          <Select
            label={t('roads.mainObjectLabel')}
            blankLabel="—"
            hint={t('roads.mainObjectHint')}
            value={args[0] ?? ''}
            onChange={setArg}
            options={mainObjects.map((mo, i) => ({
              value: String(i),
              label: `${mo.type} [${i}]${mo.type === 'Spawn' && mo.spawn ? ` · ${mo.spawn}` : ''}`,
            }))}
          />
        )}
        {end.type === 'Connection' && (
          <Select
            label={t('roads.connectionLabel')}
            blankLabel="—"
            hint={t('roads.connectionHint')}
            value={args[0] ?? ''}
            onChange={setArg}
            options={connIds.map((c) => ({ value: c }))}
          />
        )}
        {end.type === 'MandatoryContent' && (
          <Select
            label={t('roads.contentLabel')}
            blankLabel="—"
            hint={t('roads.contentHint')}
            value={args[0] ?? ''}
            onChange={setArg}
            options={mcItemNames.map((n) => ({ value: n }))}
          />
        )}
        {end.type === 'Crossroads' && (
          <div className="hint full road-end__hint">{t('roads.crossroadsHint')}</div>
        )}
      </div>
    </div>
  )
}

export function RoadsEditor({
  roads,
  mainObjects,
  connIds,
  mcItemNames,
  onPatch,
}: {
  roads: Road[]
  mainObjects: MainObject[]
  connIds: string[]
  mcItemNames: string[]
  onPatch: (p: Partial<Zone>) => void
}) {
  const { t } = useTranslation()
  // Описание концов дороги — переводы roadEnd.* (геометрия из roads.ts подписей не возвращает).
  const describeEnd = (end: RoadEndpoint): string => {
    const arg = end.args?.[0] ?? '?'
    switch (end.type) {
      case 'MainObject':
        return t('roadEnd.mainObject', { arg })
      case 'Connection':
        return t('roadEnd.connection', { arg })
      case 'MandatoryContent':
        return t('roadEnd.mandatoryContent', { arg })
      default:
        return end.type
    }
  }
  const list = roads
  const set = (next: Road[]) => onPatch({ roads: next.length ? next : undefined })

  const add = () => {
    const to: RoadEndpoint = connIds.length
      ? { type: 'Connection', args: [connIds[0]] }
      : { type: 'Crossroads', args: [] }
    const road: Road = {
      type: 'Stone',
      from: { type: 'MainObject', args: mainObjects.length ? ['0'] : [] },
      to,
    }
    set([...list, road])
  }

  const patchRoad = (i: number, p: Partial<Road>) =>
    set(list.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const patchEnd = (i: number, which: 'from' | 'to', end: RoadEndpoint) =>
    patchRoad(i, { [which]: end })

  return (
    <div className="full">
      {list.length === 0 && <div className="hint">{t('roads.empty')}</div>}
      {list.map((r, i) => (
        <details className="mo road-item" key={i}>
          <summary>
            <span className="road-item__surface">{r.type ?? '—'}</span>
            <span className="mo__hint" title={`${describeEnd(r.from)} → ${describeEnd(r.to)}`}>
              {describeEnd(r.from)} → {describeEnd(r.to)}
            </span>
            <button
              type="button"
              className="mo__del"
              onClick={(e) => {
                // preventDefault — иначе клик по кнопке внутри <summary> переключит <details>
                e.preventDefault()
                set(list.filter((_, j) => j !== i))
              }}
              title={t('roads.deleteTitle')}
              aria-label={t('roads.deleteTitle')}
            >
              ✕
            </button>
          </summary>
          <div className="mo__grid">
            <Select
              label={t('roads.surfaceLabel')}
              blankLabel={t('roads.surfaceBlank')}
              hint={t('roads.surfaceHint')}
              value={r.type}
              onChange={(v) =>
                set(
                  list.map((rr, j) => {
                    if (j !== i) return rr
                    if (!v) {
                      const next = { ...rr }
                      delete next.type
                      return next
                    }
                    return { ...rr, type: v as RoadSurface }
                  }),
                )
              }
              options={ROAD_SURFACES.map((s) => ({ value: s, label: `${t(`roads.surfaces.${s}`)} · ${s}` }))}
            />
            <div className="hint full">{t('roads.endsHint')}</div>
            <RoadEndpointEditor
              label={t('roads.from')}
              end={r.from}
              mainObjects={mainObjects}
              connIds={connIds}
              mcItemNames={mcItemNames}
              onChange={(end) => patchEnd(i, 'from', end)}
            />
            <RoadEndpointEditor
              label={t('roads.to')}
              end={r.to}
              mainObjects={mainObjects}
              connIds={connIds}
              mcItemNames={mcItemNames}
              onChange={(end) => patchEnd(i, 'to', end)}
            />
          </div>
        </details>
      ))}
      <button type="button" className="btn" onClick={add}>
        <Plus size={12} /> {t('roads.add')}
      </button>
    </div>
  )
}