import { useMemo } from 'react'
import { useStore } from '@xyflow/react'
import { useEditorStore } from '../store/editorStore'
import type { RoadSurface, Zone } from '../types/rmg'
import {
  buildRoadRoutes,
  zoneNodeSize,
  type Point,
  type ResolvedNode,
  type RoadAnchor,
  type RoadRoute,
} from '../utils/roads'
import { PLAYER_COLORS } from '../utils/zoneStyle'

/** Цвета маршрутов в режиме «Дороги». */
const ROAD_STYLE: Record<RoadSurface, { stroke: string; width: number; dash?: string }> = {
  Stone: { stroke: '#d8c9a0', width: 2.6 },
  Dirt: { stroke: '#a08a62', width: 2.2, dash: '6 5' },
}

/** Дорога без указанного покрытия (`type` отсутствует) — встречается в штатных шаблонах (226 из 2291 дорог, ~10%; в 13 из 60 шаблонов, в осн. Jebus-семейство; бывают и вне спавн-зон). Рисуется нейтральным стилем. */
const DEFAULT_ROAD_STYLE: { stroke: string; width: number; dash?: string } = {
  stroke: '#b3a280',
  width: 2.4,
}

const HALO_COLOR = '#10151d'
const CONN_RING = '#8fa8d9'
const CONN_FILL = '#1c222c'
const CROSSROADS_COLOR = '#e0b34b'
const MO_COLOR = '#cfd6e4'
const MC_OUTLINE = '#7ec4a8'

/** Маркер конца дороги (постоянный экранный размер, не зависит от зума). */
function EndMarker({ anchor, zone, at }: { anchor: RoadAnchor; zone: Zone; at: Point }) {
  switch (anchor.kind) {
    case 'MainObject': {
      const mo = anchor.moIndex !== undefined ? zone.mainObjects?.[anchor.moIndex] : undefined
      const color = mo?.type === 'Spawn' && mo.spawn ? (PLAYER_COLORS[mo.spawn] ?? MO_COLOR) : MO_COLOR
      return (
        <rect
          x={at.x - 3.2}
          y={at.y - 3.2}
          width={6.4}
          height={6.4}
          fill={color}
          stroke={HALO_COLOR}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )
    }
    case 'Connection':
      return (
        <circle
          cx={at.x}
          cy={at.y}
          r={3.6}
          fill={CONN_FILL}
          stroke={CONN_RING}
          strokeWidth={1.6}
          vectorEffect="non-scaling-stroke"
        />
      )
    case 'Crossroads':
      return (
        <rect
          x={at.x - 3.4}
          y={at.y - 3.4}
          width={6.8}
          height={6.8}
          fill={CROSSROADS_COLOR}
          stroke={HALO_COLOR}
          strokeWidth={1}
          transform={`rotate(45 ${at.x} ${at.y})`}
          vectorEffect="non-scaling-stroke"
        />
      )
    case 'MandatoryContent':
    default:
      return (
        <circle
          cx={at.x}
          cy={at.y}
          r={3.2}
          fill="none"
          stroke={MC_OUTLINE}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      )
  }
}

/**
 * Слой маршрутов zone.roads[] поверх узлов на канве.
 * Отрисовывается только в режиме «Дороги»; pointer-events: none — не мешает
 * перетаскиванию узлов и связей.
 */
export function RoadLayer() {
  const variant = useEditorStore((s) => s.template.variants[s.activeVariant])
  const nodeLookup = useStore((s) => s.nodeLookup)
  const transform = useStore((s) => s.transform)

  const nodes = useMemo<Map<string, ResolvedNode>>(() => {
    const map = new Map<string, ResolvedNode>()
    if (!variant) return map
    for (const z of variant.zones ?? []) {
      const n = nodeLookup.get(z.name)
      if (!n) continue
      const { width, height } = zoneNodeSize(z)
      map.set(z.name, { center: { x: n.position.x, y: n.position.y }, width, height })
    }
    return map
  }, [variant, nodeLookup])

  const routes = useMemo<RoadRoute[]>(
    () => (variant ? buildRoadRoutes(variant, nodes) : []),
    [variant, nodes],
  )

  if (routes.length === 0) return null

  const [tx, ty, zoom] = transform
  const s = (p: Point) => `${p.x * zoom + tx},${p.y * zoom + ty}`
  const at = (p: Point) => ({ x: p.x * zoom + tx, y: p.y * zoom + ty })
  const zoneBy = (r: RoadRoute) => variant!.zones.find((z) => z.name === r.zoneName)

  return (
    <svg
      className="road-layer"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 4,
      }}
      aria-hidden="true"
    >
      {routes.map((r) => {
        const zone = zoneBy(r)
        if (!zone) return null
        const st = r.surface ? ROAD_STYLE[r.surface] : DEFAULT_ROAD_STYLE
        const d = r.points.map(s).join(' ')
        return (
          <g key={`${r.zoneName}-${r.index}`}>
            <polyline
              points={d}
              fill="none"
              stroke={HALO_COLOR}
              strokeOpacity={0.35}
              strokeWidth={st.width + 3}
              strokeDasharray={st.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={d}
              fill="none"
              stroke={st.stroke}
              strokeWidth={st.width}
              strokeDasharray={st.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <EndMarker anchor={r.from} zone={zone} at={at(r.from.point)} />
            <EndMarker anchor={r.to} zone={zone} at={at(r.to.point)} />
          </g>
        )
      })}
    </svg>
  )
}