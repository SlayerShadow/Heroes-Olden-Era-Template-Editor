import type { Connection, Zone } from '../types/rmg'
import type { BiomeLayer, BiomeName, BiomeResolve, BudgetMetric, BudgetTarget, ViewMode } from '../types/viewMode'
import { guardGroupColor, isConnectorZone, playerColorFor, strokeFor, wealthColor, zoneBudget } from './zoneStyle'

export const BIOME_NAMES: BiomeName[] = ['Grass', 'Sand', 'Snow', 'Dirt', 'Deathland', 'Autumn', 'Lava']

export const BIOME_COLORS: Record<BiomeName, string> = {
  Grass: '#3f7d3a',
  Sand: '#c2a05a',
  Snow: '#9fb6c9',
  Dirt: '#7a6246',
  Deathland: '#5d3b5e',
  Autumn: '#c06a34',
  Lava: '#a33a30',
}

export function biomeColor(name: BiomeName | 'any' | 'unknown'): string {
  if (name === 'any') return '#3a4354'
  if (name === 'unknown') return '#22293a'
  return BIOME_COLORS[name]
}

export function isBiomeName(s: string): boolean {
  return (BIOME_NAMES as string[]).includes(s)
}

/** Слои биома: id для UI/состояния + техническое имя поля зоны в `.rmg.json` (для подсказок). */
export const BIOME_LAYERS: readonly { id: BiomeLayer; field: string }[] = [
  { id: 'zone', field: 'zoneBiome' },
  { id: 'content', field: 'contentBiome' },
  { id: 'meta', field: 'metaObjectsBiome' },
]

function differentFromZones(args: string[]): string[] {
  const out: string[] = []
  for (const a of args) {
    const m = /^differentFrom:\s*(?:0\s+)?(.+)$/.exec(a)
    if (m) out.push(m[1])
  }
  return out
}

const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v))

export function biomeSelectorOf(zone: Zone, layer: BiomeLayer): Zone['zoneBiome'] | undefined {
  if (layer === 'zone') return zone.zoneBiome
  if (layer === 'content') return zone.contentBiome
  return zone.metaObjectsBiome
}

export function resolveBiome(
  zone: Zone,
  zones: Zone[],
  layer: BiomeLayer,
  visited: Set<string> = new Set(),
): BiomeResolve {
  if (visited.has(zone.name)) return { biome: 'unknown', kind: 'unknown' }
  visited.add(zone.name)

  const selector = biomeSelectorOf(zone, layer)
  if (!selector) return { biome: 'unknown', kind: 'unknown' }

  const args = Array.isArray(selector.args) ? selector.args : []

  if (selector.type === 'FromList') {
    // FromList — список РАЗРЕШЁнных биомов: фиксированный биом
    // показываем только при единственном имени; несколько имён — состояние
    // «список» (multi), узел не красится в цвет одного из них.
    const names = args.filter(isBiomeName) as BiomeName[]
    const diff = differentFromZones(args)
    if (names.length === 1) return { biome: names[0], kind: 'fixed' }
    if (names.length > 1) return { biome: 'unknown', kind: 'multi' }
    if (diff.length > 0) {
      const src = zones.find((z) => z.name === diff[0])
      const inner = src ? resolveBiome(src, zones, layer, visited) : undefined
      return {
        biome: inner?.biome ?? 'unknown',
        kind: 'different-from',
        sourceZone: diff[0],
      }
    }
    if (args.length > 1) return { biome: 'unknown', kind: 'multi' }
    return { biome: 'any', kind: 'any' }
  }

  if (selector.type === 'MatchZone') {
    const target = args[0]
    const src = zones.find((z) => z.name === target)
    return {
      biome: src ? resolveBiome(src, zones, layer, visited).biome : 'unknown',
      kind: 'match-zone',
      sourceZone: target,
    }
  }

  // MatchMainObject: args[0] = индекс, args[1] = зона-источник (опционально)
  const target = args[1]
  const src = target ? zones.find((z) => z.name === target) : undefined
  return {
    biome: src ? resolveBiome(src, zones, layer, visited).biome : 'unknown',
    kind: 'match-object',
    sourceZone: target,
    sourceObject: args[0],
  }
}

export function metricValue(zone: Zone, metric: BudgetMetric, target: BudgetTarget): number {
  const pick = (abs?: number, perArea?: number): number =>
    (target === 'perArea' ? perArea : abs) ?? (target === 'perArea' ? abs : perArea) ?? 0
  switch (metric) {
    case 'guarded':
      return pick(zone.guardedContentValue, zone.guardedContentValuePerArea)
    case 'unguarded':
      return pick(zone.unguardedContentValue, zone.unguardedContentValuePerArea)
    case 'resources':
      return pick(zone.resourcesValue, zone.resourcesValuePerArea)
    case 'total':
    default:
      return metricValue(zone, 'guarded', target) + metricValue(zone, 'unguarded', target) + metricValue(zone, 'resources', target)
  }
}

const TARGET_MAX = (metric: BudgetMetric): number =>
  metric === 'resources' ? 2_500_000 : metric === 'unguarded' ? 400_000 : 8_000_000

export function budgetTone(zone: Zone, metric: BudgetMetric, target: BudgetTarget): number {
  const v = metricValue(zone, metric, target)
  return clamp(0, v / TARGET_MAX(metric), 1)
}

export function guardTone(zone: Zone): number {
  if (typeof zone.guardMultiplier === 'number') return clamp(0, zone.guardMultiplier / 5, 1)
  if (typeof zone.guardCutoffValue === 'number') return clamp(0, zone.guardCutoffValue / 5000, 1)
  return 0.5
}

export interface NodeFill {
  background: string
  accent?: string
  tone: number
}

export function nodeFillForView(zone: Zone, view: ViewMode, biomeLayer: BiomeLayer, zones: Zone[], metric: BudgetMetric, target: BudgetTarget): NodeFill {
  switch (view) {
    case 'biome': {
      const r = resolveBiome(zone, zones, biomeLayer)
      return { background: biomeColor(r.biome), accent: r.kind, tone: 0 }
    }
    case 'guard': {
      const t = guardTone(zone)
      const hue = Math.round(8 + t * 128)
      const sat = Math.round(42 + t * 26)
      const lig = Math.round(34 + t * 18)
      return { background: `hsl(${hue} ${sat}% ${lig}%)`, tone: t }
    }
    case 'budget': {
      const t = budgetTone(zone, metric, target)
      const base = wealthColor(metricValue(zone, metric, target))
      return { background: base, tone: t }
    }
    case 'road': {
      return { background: isConnectorZone(zone) ? '#242b38' : '#28313f', tone: 0 }
    }
    case 'mandatory': {
      return { background: isConnectorZone(zone) ? '#242b38' : '#28313f', tone: 0 }
    }
    case 'overview':
    default: {
      const player = playerColorFor(zone)
      if (player) return { background: player, tone: 1 }
      if (isConnectorZone(zone)) return { background: '#242b38', tone: 0 }
      return { background: wealthColor(zoneBudget(zone)), tone: 1 }
    }
  }
}

export interface EdgeStyle {
  stroke: string
  width: number
  dash?: string
  opacity?: number
}

const MUTED: EdgeStyle = { stroke: '#566073', width: 1.4, opacity: 0.55 }

export function edgeStyleForView(conn: Connection, view: ViewMode): EdgeStyle {
  if (view === 'overview') {
    const s = strokeFor(conn)
    return { stroke: s.color, width: s.width, dash: s.dash }
  }
  if (view === 'guard') {
    const gv = conn.guardValue ?? 0
    if (conn.guardMatchGroup) {
      return { stroke: guardGroupColor(conn.guardMatchGroup), width: 3.2 }
    }
    const width = clamp(1.2, 2 + Math.log2(1 + Math.abs(gv)) / 4, 5)
    const stroke = gv < 0 ? '#ff8f8f' : gv === 0 ? '#7d8798' : `hsl(${Math.round(30 + clamp(0, gv / 30000, 1) * 90)} 55% 55%)`
    return { stroke, width }
  }
  if (view === 'road') {
    if (conn.road === false) return { stroke: '#6a6f7c', width: 1.6, dash: '3 7' }
    if (conn.road === true) return { stroke: '#e8e6df', width: 2.4 }
    return { stroke: '#454e60', width: 1.4, dash: '2 4', opacity: 0.8 }
  }
  return MUTED
}