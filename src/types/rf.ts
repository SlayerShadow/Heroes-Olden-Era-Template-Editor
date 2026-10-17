import type { Edge, Node } from '@xyflow/react'
import type { Connection, Zone } from './rmg'

export interface ZoneNodeData extends Record<string, unknown> {
  zone: Zone
}

export type ZoneNodeModel = Node<ZoneNodeData, 'zone'>

/** Сторона узла, к которой якорится конец связи: left/right/top/bottom. */
export type ZoneEdgeSide = 'l' | 'r' | 't' | 'b'

export interface ZoneEdgeData extends Record<string, unknown> {
  connection: Connection
  /** Сторона узла-источника (выбирается по геометрии в buildGraph). */
  sourceSide?: ZoneEdgeSide
  /** Сторона узла-приёмника. */
  targetSide?: ZoneEdgeSide
  /**
   * Слот якоря вдоль стороны узла, (0;1): все концы связей одной стороны
   * равномерно распределяются по ней — параллельные линии не сливаются
   * и не «отлипают» от узла (приём HotA).
   */
  sourceSlot?: number
  targetSlot?: number
}

export type ZoneEdgeModel = Edge<ZoneEdgeData, 'zone-edge'>
