import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@xyflow/react'
import { useEditorStore } from '../store/editorStore'
import { buildMandatoryContent, type McPoint, type McRing } from '../utils/mandatory'
import type { Point, ResolvedNode } from '../utils/roads'
import { zoneNodeSize } from '../utils/roads'

/** Цвета колец по типу правила (совпадают с легендой режима). */
const MC_RULE_COLORS: Record<string, string> = {
  Road: '#a8c68c',
  MainObject: '#62a8f2',
  Crossroads: '#e0b34b',
  Sid: '#b08ad9',
  Connection: '#5cc4a4',
}

const DOT_NEUTRAL = '#c9d4e8'
const DOT_HALO = '#0f141b'
const BAND_ALPHA = 0.16

function ruleColor(t: string): string {
  return MC_RULE_COLORS[t] ?? '#8e96a6'
}

function truncate(s: string, n = 14): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}

/** Кольцевая полоса (SVG-path, flow-координаты). */
function ringPath(c: Point, rMin: number, rMax: number): string {
  const arc = (cx: number, cy: number, r: number) =>
    `M ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} Z`
  const outer = arc(c.x, c.y, rMax)
  if (rMin <= 0) return outer
  return `${outer} ${arc(c.x, c.y, rMin)}`
}

function RingGlyph({ ring }: { ring: McRing }) {
  const color = ruleColor(ring.ruleType)
  const dash = ring.resolved ? undefined : '5 5'
  return (
    <g className="mc-ring">
      <path
        d={ringPath(ring.center, ring.rMin, ring.rMax)}
        fill={color}
        fillOpacity={ring.resolved ? BAND_ALPHA : BAND_ALPHA * 0.5}
        fillRule="evenodd"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={ring.center.x}
        cy={ring.center.y}
        r={ring.rMax}
        fill="none"
        stroke={color}
        strokeOpacity={ring.resolved ? 0.85 : 0.4}
        strokeWidth={1.2}
        strokeDasharray={dash}
        vectorEffect="non-scaling-stroke"
      />
      {ring.rMin > 0 && (
        <circle
          cx={ring.center.x}
          cy={ring.center.y}
          r={ring.rMin}
          fill="none"
          stroke={color}
          strokeOpacity={ring.resolved ? 0.5 : 0.25}
          strokeWidth={1}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  )
}

/**
 * Слой обязательного контента (режим «Контент»): точки элементов
 * mandatoryContent зоны + кольца их правил размещения (targetMin/Max
 * вокруг цели). pointer-events: none — только точки/подписи доступны
 * для тултипа.
 */
export function MandatoryLayer() {
  const { t } = useTranslation()
  const template = useEditorStore((s) => s.template)
  const activeVariant = useEditorStore((s) => s.activeVariant)
  const nodeLookup = useStore((s) => s.nodeLookup)
  const transform = useStore((s) => s.transform)

  const variant = template.variants[activeVariant]
  const groups = useMemo(() => template.mandatoryContent ?? [], [template])

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

  const points = useMemo<McPoint[]>(
    () => (variant ? buildMandatoryContent(variant, groups, nodes) : []),
    [variant, groups, nodes],
  )

  if (!variant || points.length === 0) return null

  const [tx, ty, zoom] = transform
  const at = (p: Point) => ({ x: p.x * zoom + tx, y: p.y * zoom + ty })

  const pointKey = (p: McPoint) => `${p.zoneName}::${p.groupName}::${p.index}`
  const ringKey = (p: McPoint, i: number) => `${pointKey(p)}::r${i}`

  return (
    <svg
      className="mc-layer"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 4,
      }}
    >
      {/* Кольца и линии-связки в flow-координатах (масштабируются с зумом). */}
      <g transform={`translate(${tx} ${ty}) scale(${zoom})`}>
        {points.map((p) =>
          p.rings.map((ring, i) => <RingGlyph key={ringKey(p, i)} ring={ring} />),
        )}
        {points.map((p) => {
          const anchor = p.rings[0]?.center ?? p.axis
          if (!anchor) return null
          const color = p.rings[0] ? ruleColor(p.rings[0].ruleType) : '#8e96a6'
          return (
            <line
              key={`${pointKey(p)}::line`}
              x1={p.point.x}
              y1={p.point.y}
              x2={anchor.x}
              y2={anchor.y}
              stroke={color}
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </g>

      {/* Точки и подписи — постоянный экранный размер. */}
      {points.map((p) => {
        const pt = at(p.point)
        const dot = ruleColor(p.rings[0]?.ruleType ?? '')
        const color = p.rings[0] ? dot : DOT_NEUTRAL
        const isMine = p.item.isMine
        const label = p.label ?? t('mcPoint.elementFallback', { n: p.index })
        const tooltip = [
          label,
          p.item.sid ? `sid ${p.item.sid}` : null,
          t('mcPoint.groupPart', { name: p.groupName }),
          p.rulesDesc.length ? p.rulesDesc.join('; ') : null,
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <g key={pointKey(p)} className="mc-point" pointerEvents="auto">
            <title>{tooltip}</title>
            {isMine && (
              <rect
                x={pt.x - 3.4}
                y={pt.y - 3.4}
                width={6.8}
                height={6.8}
                fill={DOT_HALO}
                stroke={color}
                strokeWidth={1.2}
                rx={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <circle
              className="mc-dot"
              cx={pt.x}
              cy={pt.y}
              r={3.1}
              fill={DOT_HALO}
              stroke={color}
              strokeWidth={1.6}
              vectorEffect="non-scaling-stroke"
            />
            <text
              className="mc-label"
              x={pt.x}
              y={pt.y + 11}
              textAnchor="middle"
              fontSize={9.5}
              fill="#dfe6f2"
              stroke={DOT_HALO}
              strokeWidth={3}
              paintOrder="stroke"
              style={{ pointerEvents: 'auto', cursor: 'help' }}
            >
              {truncate(label)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}