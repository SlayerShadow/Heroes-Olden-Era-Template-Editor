import { Ban, DoorOpen } from 'lucide-react'
import { BaseEdge, EdgeLabelRenderer, Position, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../store/editorStore'
import type { ZoneEdgeModel } from '../types/rf'
import type { Connection, Zone } from '../types/rmg'
import { formatNum } from '../utils/zoneStyle'
import { edgeStyleForView } from '../utils/viewModes'
import { zoneNodeSize } from '../utils/roads'

/**
 * Стабильные пустые массивы для plain-селекторов store: свежий `[]` на каждый вызов
 * getSnapshot раскручивает бесконечный цикл ре-рендеров (см. ZoneNode).
 */
const NO_ZONES: Zone[] = []
const NO_CONNECTIONS: Connection[] = []

/** Угол стрелки «начало связи» (маркер from): сторона выхода из зоны-источника → градусы SVG rotate. */
const FROM_MARK_ANGLE: Record<Position, number> = {
  [Position.Right]: 0,
  [Position.Bottom]: 90,
  [Position.Left]: 180,
  [Position.Top]: -90,
}

export function ZoneEdge(props: EdgeProps<ZoneEdgeModel>) {
  const { t } = useTranslation()
  const { id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data } = props
  const connection = data?.connection
  const viewMode = useEditorStore((s) => s.viewMode)
  const zones = useEditorStore((s) => s.template.variants[s.activeVariant]?.zones ?? NO_ZONES)
  const connections = useEditorStore((s) => s.template.variants[s.activeVariant]?.connections ?? NO_CONNECTIONS)
  const storeSelected = useEditorStore(
    (s) =>
      s.selection.kind === 'connection' &&
      !!connection &&
      s.selection.id === (connection.name ?? `${connection.from}-${connection.to}`),
  )
  const isSelected = selected || storeSelected
  // Якорь — слот вдоль стороны узла (buildGraph): параллельные связи не сливаются
  // и всегда касаются узла, а не «висят» в стороне от него.
  let sx = sourceX
  let sy = sourceY
  let tx = targetX
  let ty = targetY
  const srcZone = zones.find((z) => z.name === source)
  const tgtZone = zones.find((z) => z.name === target)
  if (srcZone) {
    const slot = (data?.sourceSlot ?? 0.5) - 0.5
    const size = zoneNodeSize(srcZone)
    if (sourcePosition === Position.Left || sourcePosition === Position.Right) sy += slot * size.height
    else sx += slot * size.width
  }
  if (tgtZone) {
    const slot = (data?.targetSlot ?? 0.5) - 0.5
    const size = zoneNodeSize(tgtZone)
    if (targetPosition === Position.Left || targetPosition === Position.Right) ty += slot * size.height
    else tx += slot * size.width
  }
  const [path, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition,
    targetX: tx,
    targetY: ty,
    targetPosition,
  })

  if (!connection) {
    return <BaseEdge id={id} path={path} />
  }

  const stroke = edgeStyleForView(connection, viewMode)
  const guardValue = connection.guardValue ?? 0
  const negative = guardValue < 0
  // Параллельный пучок (та же пара зон): одинаковые значения охраны сводятся в один
  // бейдж «×N значение» на средней линии, остальные разносятся вдоль пучка, чтобы не сливаться.
  const pairKey = (c: { from: string; to: string }): string =>
    c.from < c.to ? `${c.from}|${c.to}` : `${c.to}|${c.from}`
  const siblings = connections.filter((c) => pairKey(c) === pairKey(connection))
  const sibIdx = siblings.indexOf(connection)
  const sibCount = siblings.length
  const sibGv = siblings.map((c) => c.guardValue ?? 0)
  const bundleSame = sibCount > 1 && sibGv.every((v) => v === sibGv[0]) && sibGv[0] !== 0
  const hideInBundle = bundleSame && viewMode !== 'road' && sibIdx !== Math.floor((sibCount - 1) / 2)
  const stagger = (sibIdx - (sibCount - 1) / 2) * 18
  const badgeY = labelY + (bundleSame && viewMode !== 'road' ? 0 : stagger)
  const portal = connection.connectionType === 'Portal'
  const proximity = connection.connectionType === 'Proximity'
  const hasRoad = connection.road === true
  const blockedRoad = connection.road === false
  const showRoadOverlay = (viewMode === 'overview' || viewMode === 'road') && hasRoad
  const showLabel = viewMode === 'overview' || viewMode === 'guard' || viewMode === 'road'
  // Без охраны и без особых отметок бейдж не показываем (HotA: значение только при охране)
  const badgeEmpty = viewMode !== 'road' && guardValue === 0 && !portal && !proximity && !blockedRoad

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: stroke.stroke,
          strokeWidth: stroke.width,
          strokeDasharray: stroke.dash,
          strokeLinecap: 'round',
          opacity: stroke.opacity ?? (isSelected ? 1 : 0.88),
        }}
      />
      {showRoadOverlay && (
        <BaseEdge
          id={`${id}-road`}
          path={path}
          style={{
            stroke: '#f4f4f4',
            strokeWidth: 1,
            strokeDasharray: '1 7',
            strokeLinecap: 'round',
            opacity: 0.85,
          }}
        />
      )}
      {/* Выделение: штриховой «рельс» поверх базовой линии + маркеры концов from/to.
          Рисуется в любом режиме канвы (в т.ч. без бейджа — «Бюджеты»/«Биомы»/
          «Контент»); стили — graph.css (.edge-select), стрелка from направлена
          наружу из зоны-источника (сторона sourcePosition). */}
      {isSelected && (
        <g className="edge-select" aria-hidden="true">
          <path className="edge-select__casing" d={path} />
          <path className="edge-select__rail" d={path} />
          <path className="edge-select__stripe" d={path} />
          <polygon
            className="edge-select__mark edge-select__mark--from"
            points="0,-5.5 11,0 0,5.5"
            transform={`translate(${sx} ${sy}) rotate(${FROM_MARK_ANGLE[sourcePosition]})`}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            className="edge-select__mark edge-select__mark--to"
            cx={tx}
            cy={ty}
            r={5}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
      {showLabel && !hideInBundle && !badgeEmpty && (
        <EdgeLabelRenderer>
          <div
            className={`edge-badge${negative ? ' is-neg' : ''}${isSelected ? ' is-selected' : ''}${viewMode === 'road' ? ' is-road' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${badgeY}px)` }}
          >
            {viewMode === 'road' ? (
              <>
                {blockedRoad && <Ban size={11} className="edge-badge__ban" />}
                <span>{blockedRoad ? t('edge.noRoad') : hasRoad ? t('edge.road') : '—'}</span>
              </>
            ) : (
              <>
                {portal && <DoorOpen size={12} />}
                {negative && <span className="edge-badge__warn">?</span>}
                <span>
                  {bundleSame
                    ? `×${sibCount} ${formatNum(guardValue)}`
                    : guardValue !== 0
                      ? formatNum(guardValue)
                      : null}
                </span>
                {proximity && <span className="edge-badge__length">≈{connection.length ?? '?'}</span>}
                {blockedRoad && <Ban size={11} className="edge-badge__ban" />}
              </>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}