import type { Connection, Zone } from '../types/rmg'

export const PLAYER_COLORS: Record<string, string> = {
  Player1: '#d94c4c',
  Player2: '#4f7fd9',
  Player3: '#e0933f',
  Player4: '#4cbb5f',
  Player5: '#3bb8c2',
  Player6: '#9a5ccb',
  Player7: '#9aa0ab',
  Player8: '#c0be3f',
}

const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v))

function trim0(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '?'
  const sign = n < 0 ? '−' : ''
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${sign}${trim0((abs / 1_000_000).toFixed(1))}M`
  if (abs >= 1_000) {
    const v = abs >= 100_000 ? Math.round(abs / 1_000) : trim0((abs / 1_000).toFixed(1))
    return `${sign}${v}k`
  }
  return `${sign}${Math.round(abs)}`
}

export function playerColorFor(zone: Zone): string | undefined {
  // mainObjects может отсутствовать в слаботипизированных файлах, прошедших parseTemplate
  for (const mo of zone.mainObjects ?? []) {
    if (mo.type === 'Spawn' && mo.spawn) return PLAYER_COLORS[mo.spawn]
  }
  return undefined
}

function single(absolute?: number, perArea?: number): number {
  if (absolute && absolute > 0) return absolute
  return perArea ?? 0
}

export function zoneBudget(z: Zone): number {
  return (
    single(z.guardedContentValue, z.guardedContentValuePerArea) +
    single(z.unguardedContentValue, z.unguardedContentValuePerArea) +
    single(z.resourcesValue, z.resourcesValuePerArea)
  )
}

export function isConnectorZone(zone: Zone): boolean {
  if (zone.name.startsWith('Connector')) return true
  return zoneBudget(zone) === 0 && (zone.mainObjects ?? []).length === 0
}

const MAX_BUDGET = 8_000_000

export function wealthColor(total: number): string {
  const t = clamp(0, Math.log2(1 + total) / Math.log2(1 + MAX_BUDGET), 1)
  const hue = Math.round(222 - t * 168)
  const sat = Math.round(30 + t * 50)
  const lig = Math.round(34 + t * 24)
  return `hsl(${hue} ${sat}% ${lig}%)`
}

export function nodeColorFor(zone: Zone): string {
  const player = playerColorFor(zone)
  if (player) return player
  if (isConnectorZone(zone)) return '#2c323e'
  return wealthColor(zoneBudget(zone))
}

const STROKES: Record<Connection['connectionType'], { color: string; width: number; dash?: string }> = {
  Direct: { color: '#d9b45b', width: 3.2 },
  Default: { color: '#8e96a6', width: 1.5 },
  Portal: { color: '#62a8f2', width: 2.2, dash: '7 5' },
  Proximity: { color: '#5cc4a4', width: 1.5, dash: '2 6' },
  GladiatorArena: { color: '#f0cf4a', width: 2.6, dash: '12 4' },
}

export function strokeFor(conn: Connection): { color: string; width: number; dash?: string } {
  const base = STROKES[conn.connectionType] ?? STROKES.Default
  if (conn.guardMatchGroup) return { ...base, color: guardGroupColor(conn.guardMatchGroup) }
  return base
}

export function guardGroupColor(group: string): string {
  let h = 0
  for (let i = 0; i < group.length; i++) h = (h * 31 + group.charCodeAt(i)) >>> 0
  return `hsl(${h % 360} 62% 58%)`
}