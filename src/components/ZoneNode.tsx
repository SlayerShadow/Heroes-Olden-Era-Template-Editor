import { Castle, Flag, Landmark, Swords } from 'lucide-react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../store/editorStore'
import type { ZoneNodeModel } from '../types/rf'
import type { BiomeSelectorType, MainObject, MandatoryContentGroup, Zone } from '../types/rmg'
import type { BiomeLayer } from '../types/viewMode'
import { PLAYER_COLORS, formatNum, isConnectorZone, zoneBudget } from '../utils/zoneStyle'
import { biomeColor, biomeSelectorOf, metricValue, nodeFillForView, resolveBiome } from '../utils/viewModes'
import { zoneNodeSize } from '../utils/roads'

const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * Стабильные пустые массивы для plain-селекторов store: свежий `[]` на каждый вызов
 * getSnapshot (поле отсутствует в слаботипизированном файле) раскручивает бесконечный
 * цикл ре-рендеров React («Maximum update depth exceeded»).
 */
const NO_ZONES: Zone[] = []
const NO_GROUPS: MandatoryContentGroup[] = []

function objectIcon(mo: MainObject, key: number): React.ReactElement | null {
  switch (mo.type) {
    case 'Spawn':
      return <Flag key={`s${key}`} size={13} color={PLAYER_COLORS[mo.spawn ?? ''] ?? '#fff'} strokeWidth={2.4} />
    case 'City':
      return <Castle key={`c${key}`} size={13} color="#fff" strokeWidth={2.2} />
    case 'AbandonedOutpost':
      return <Landmark key={`o${key}`} size={13} color="#fff" strokeWidth={2.2} />
    case 'GladiatorArena':
      return <Swords key={`g${key}`} size={13} color="#fff" strokeWidth={2.2} />
    default:
      return null
  }
}

const LAYER_LABEL: Record<BiomeLayer, string> = {
  zone: 'zone',
  content: 'cont',
  meta: 'meta',
}

/**
 * Строка-источник биома на узле: откуда взялось разрешённое имя.
 * Для `fixed` возвращает null — само имя уже выведено рядом со свотчем
 * (иначе на узле было бы имя биома дважды).
 */
export function BiomeLine({ zone, layer, zones }: { zone: ZoneNodeModel['data']['zone']; layer: BiomeLayer; zones: ZoneNodeModel['data']['zone'][] }) {
  const { t } = useTranslation()
  const r = resolveBiome(zone, zones, layer)
  if (r.kind === 'match-zone') return <span>← {r.sourceZone}</span>
  if (r.kind === 'match-object') return <span>MO #{r.sourceObject}{r.sourceZone ? ` ← ${r.sourceZone}` : ''}</span>
  if (r.kind === 'different-from') return <span>≠ {r.sourceZone}</span>
  if (r.kind === 'multi') return <span>{t('zoneNode.multi')}</span>
  if (r.kind === 'any') return <span>{t('zoneNode.any')}</span>
  if (r.kind === 'unknown') return <span>?</span>
  return null
}

export function ZoneNode({ id, data }: NodeProps<ZoneNodeModel>) {
  const { t } = useTranslation()
  const isSelected = useEditorStore((s) => s.selection.kind === 'zone' && s.selection.id === id)
  const zone = data.zone
  const viewMode = useEditorStore((s) => s.viewMode)
  const biomeLayer = useEditorStore((s) => s.biomeLayer)
  const budgetMetric = useEditorStore((s) => s.budgetMetric)
  const budgetTarget = useEditorStore((s) => s.budgetTarget)
  const zones = useEditorStore((s) => s.template.variants[s.activeVariant]?.zones ?? NO_ZONES)
  const groups = useEditorStore((s) => s.template.mandatoryContent ?? NO_GROUPS)

  const { width, height } = zoneNodeSize(zone)
  const isConn = isConnectorZone(zone)
  const spawn = zone.mainObjects?.find((m) => m.type === 'Spawn')
  const player = spawn?.spawn?.replace('Player', 'P')
  const playerColor = spawn?.spawn ? PLAYER_COLORS[spawn.spawn] : undefined
  const fill = nodeFillForView(zone, viewMode, biomeLayer, zones, budgetMetric, budgetTarget)
  const showIcons = viewMode === 'overview' || viewMode === 'road'

  const modeLine = (() => {
    switch (viewMode) {
      case 'budget': {
        const all = metricValue(zone, budgetMetric, budgetTarget)
        const guarded = metricValue(zone, 'guarded', budgetTarget)
        const unguarded = metricValue(zone, 'unguarded', budgetTarget)
        const resources = metricValue(zone, 'resources', budgetTarget)
        return (
          <>
            <span className="zone-node__budget" title={`${t(`graph.metrics.${budgetMetric}.title`)} · ${t(`graph.target.${budgetTarget}`)}`}>{formatNum(all)}</span>
            <span className="zone-node__stats">
              <span className="zone-node__mini" title={t('graph.metrics.guarded.title')}>G{formatNum(guarded)}</span>
              <span className="zone-node__mini" title={t('graph.metrics.unguarded.title')}>U{formatNum(unguarded)}</span>
              <span className="zone-node__mini" title={t('graph.metrics.resources.title')}>R{formatNum(resources)}</span>
            </span>
          </>
        )
      }
      case 'guard':
        return (
          <>
            <span className="zone-node__stats">
              {typeof zone.guardMultiplier === 'number' && (
                <span className="zone-node__guard" title={t('zoneNode.guardMultiplierTitle')}>
                  <Swords size={11} strokeWidth={2.4} />{zone.guardMultiplier}
                </span>
              )}
              {typeof zone.guardWeeklyIncrement === 'number' && (
                <span className="zone-node__weekly" title={t('zoneNode.guardWeeklyTitle')}>
                  +{Math.round(zone.guardWeeklyIncrement * 100)}%/
                </span>
              )}
            </span>
            <span className="zone-node__stats">
              {typeof zone.guardCutoffValue === 'number' && (
                <span className="zone-node__mini" title={t('zoneNode.guardCutoffTitle')}>{t('zoneNode.upTo', { value: formatNum(zone.guardCutoffValue) })}</span>
              )}
              {typeof zone.guardRandomization === 'number' && (
                <span className="zone-node__mini" title={t('zoneNode.guardRandomTitle')}>rnd {Math.round(zone.guardRandomization * 100)}%</span>
              )}
              {typeof zone.diplomacyModifier === 'number' && (
                <span className="zone-node__mini" title={t('zoneNode.diplomacyTitle')}>{t('zoneNode.diplomacy', { value: zone.diplomacyModifier })}</span>
              )}
            </span>
          </>
        )
      case 'biome': {
        const r = resolveBiome(zone, zones, biomeLayer)
        const sel = biomeSelectorOf(zone, biomeLayer)
        const bioColor = biomeColor(r.biome)
        return (
          <>
            <span className="zone-node__stats">
              <i className="zone-node__swatch" style={{ background: bioColor }} />
              {r.biome !== 'any' && r.biome !== 'unknown' && <span>{t(`biomes.${r.biome}`)}</span>}
              <BiomeLine zone={zone} layer={biomeLayer} zones={zones} />
            </span>
            <span className="zone-node__mini" title={sel ? `${sel.type} · ${(sel.args ?? []).join(', ')}` : t('zoneNode.noSelector')}>
              {LAYER_LABEL[biomeLayer]} · {sel ? t(`zoneNode.selector.${sel.type as BiomeSelectorType}`) : t('zoneNode.none')}
            </span>
          </>
        )
      }
      case 'road':
        return (
          <>
            <span className="zone-node__stats">
              <span className="zone-node__mini" title={t('legend.layoutRow')}>{zone.layout || 'layout?'}</span>
            </span>
            <span className="zone-node__stats">
              {typeof zone.crossroadsPosition === 'number' && (
                <span className="zone-node__mini" title={t('legend.crossroads')}>✕{Math.round(zone.crossroadsPosition * 100)}%</span>
              )}
              <span className="zone-node__budget" title={t('zoneNode.budgetTitle')}>{formatNum(zoneBudget(zone))}</span>
            </span>
          </>
        )
      case 'mandatory': {
        const names = (zone.mandatoryContent ?? []).map(
          (n) => groups.find((g) => g.name === n)?.name ?? `${n}?`,
        )
        const total = (zone.mandatoryContent ?? []).reduce(
          (acc, n) => acc + (groups.find((g) => g.name === n)?.content.length ?? 0),
          0,
        )
        return (
          <>
            <span className="zone-node__stats">
              <span className="zone-node__mini" title={t('zoneNode.mcGroupsTitle')}>
                {names.join(' · ') || '—'}
              </span>
            </span>
            <span className="zone-node__budget" title={t('zoneNode.mcTotalTitle')}>
              {t('zoneNode.mcTotal', { n: total })}
            </span>
          </>
        )
      }
      case 'overview':
      default:
        return (
          <>
            <span className="zone-node__stats">
              {player && (
                <span className="zone-node__player" style={{ color: playerColor }}>
                  {player}
                </span>
              )}
              {typeof zone.guardMultiplier === 'number' && (
                <span className="zone-node__guard" title={t('zoneNode.guardMultiplierTitle')}>
                  <Swords size={11} strokeWidth={2.4} />
                  {zone.guardMultiplier}
                </span>
              )}
              {typeof zone.guardWeeklyIncrement === 'number' && (
                <span className="zone-node__weekly" title={t('zoneNode.guardWeeklyTitle')}>
                  +{Math.round(zone.guardWeeklyIncrement * 100)}%
                </span>
              )}
            </span>
            <span className="zone-node__budget" title={t('zoneNode.budgetTitle')}>
              {formatNum(zoneBudget(zone))}
            </span>
          </>
        )
    }
  })()

  return (
    <div
      className={`zone-node${isSelected ? ' is-selected' : ''}${isConn ? ' is-connector' : ''}`}
      style={{
        width,
        height,
        background: fill.background,
        fontSize: clamp(10, width / 16, 15),
      }}
    >
      {/* На каждой стороне две точки-крепления (source+target) в одной координате;
          в hit-testing «сверху» последний в DOM. Source обязан быть сверху: драг связи
          стартует с схваченной точки, а @xyflow при старте с target-хендла меняет
          source/target местами (isValidHandle) — направление драга стало бы обратным
          from/to. Порядок ниже: на каждой стороне target раньше, source последним. */}
      <Handle id="tgt-r" type="target" position={Position.Right} className="zone-node__handle" />
      <Handle id="src-r" type="source" position={Position.Right} className="zone-node__handle" />
      <Handle id="tgt-l" type="target" position={Position.Left} className="zone-node__handle" />
      <Handle id="src-l" type="source" position={Position.Left} className="zone-node__handle" />
      <Handle id="tgt-t" type="target" position={Position.Top} className="zone-node__handle" />
      <Handle id="src-t" type="source" position={Position.Top} className="zone-node__handle" />
      <Handle id="tgt-b" type="target" position={Position.Bottom} className="zone-node__handle" />
      <Handle id="src-b" type="source" position={Position.Bottom} className="zone-node__handle" />

      <div className="zone-node__top">
        <span className="zone-node__name" title={zone.name}>
          {zone.name}
        </span>
        {showIcons && <span className="zone-node__icons">{(zone.mainObjects ?? []).map((mo, i) => objectIcon(mo, i))}</span>}
      </div>

      <div className="zone-node__mid">
        {isConn && <span className="zone-node__connector">{t('zoneNode.connector')}</span>}
        {viewMode === 'biome' && !isConn && <span className="zone-node__connector">{LAYER_LABEL[biomeLayer]}</span>}
      </div>

      <div className="zone-node__bottom">{modeLine}</div>
    </div>
  )
}