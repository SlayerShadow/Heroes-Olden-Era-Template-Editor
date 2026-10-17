import type {
  BiomeSelector,
  Connection,
  FactionSelector,
  MainObject,
  MandatoryContentGroup,
  McRule,
  RmgTemplate,
  RoadEndpoint,
  Variant,
  Zone,
} from '../types/rmg'
import { parseDifferentFrom } from './validate'

interface RenameCtx {
  oldName: string
  newName: string
  /** Неявные id связей (From-To без name), чей id меняется из-за переименования. */
  connIds: Map<string, string>
}

function isSameZone(v: string | number | undefined, ctx: RenameCtx): boolean {
  return v != null && String(v) === ctx.oldName
}

function renameExact(v: string | undefined, ctx: RenameCtx): string | undefined {
  return v === ctx.oldName ? ctx.newName : v
}

function renameArgs(args: string[], ctx: RenameCtx): string[] {
  return args.map((a) => (String(a) === ctx.oldName ? ctx.newName : a))
}

function renameDifferentFrom(arg: string, ctx: RenameCtx): string {
  const zone = parseDifferentFrom(arg)
  if (!zone || zone !== ctx.oldName) return arg
  return arg.replace(ctx.oldName, ctx.newName)
}

function renameBiome(sel: BiomeSelector, ctx: RenameCtx): BiomeSelector {
  if (!sel) return sel
  const args = Array.isArray(sel.args) ? sel.args : []
  if (sel.type === 'MatchZone') {
    return { ...sel, args: renameArgs(args, ctx) }
  }
  if (sel.type === 'MatchMainObject') {
    const next = [...args]
    if (next.length > 1 && isSameZone(next[1] as string | undefined, ctx)) next[1] = ctx.newName
    return { ...sel, args: next }
  }
  return { ...sel, args: args.map((a) => renameDifferentFrom(a, ctx)) }
}

function renameFaction(sel: FactionSelector, ctx: RenameCtx): FactionSelector {
  const args = Array.isArray(sel.args) ? sel.args : []
  if (sel.type === 'Match') {
    const next = [...args]
    if (next.length > 1 && isSameZone(next[1] as string | undefined, ctx)) next[1] = ctx.newName
    return { ...sel, args: next }
  }
  return { ...sel, args: args.map((a) => renameDifferentFrom(a, ctx)) }
}

function renameMainObject(mo: MainObject, ctx: RenameCtx): MainObject {
  let next = mo
  if (Array.isArray(mo.placementArgs)) {
    if (mo.placement === 'NearZone') {
      next = { ...next, placementArgs: renameArgs(mo.placementArgs, ctx) }
    } else if (mo.placement === 'Connection' && ctx.connIds.size > 0) {
      next = {
        ...next,
        placementArgs: mo.placementArgs.map((a) => ctx.connIds.get(String(a)) ?? a),
      }
    }
  }
  if (mo.faction) next = { ...next, faction: renameFaction(mo.faction, ctx) }
  return next
}

function renameRoadEnd(end: RoadEndpoint, ctx: RenameCtx): RoadEndpoint {
  if (!end || end.type !== 'Connection' || ctx.connIds.size === 0) return end
  const args = Array.isArray(end.args) ? end.args : []
  return { ...end, args: args.map((a) => ctx.connIds.get(String(a)) ?? a) }
}

function renameZoneObj(z: Zone, ctx: RenameCtx): Zone {
  return {
    ...z,
    name: z.name === ctx.oldName ? ctx.newName : z.name,
    zoneBiome: renameBiome(z.zoneBiome, ctx),
    contentBiome: renameBiome(z.contentBiome, ctx),
    metaObjectsBiome: renameBiome(z.metaObjectsBiome, ctx),
    mainObjects: (z.mainObjects ?? []).map((mo) => renameMainObject(mo, ctx)),
    roads: z.roads?.map((r) => ({
      ...r,
      from: renameRoadEnd(r.from, ctx),
      to: renameRoadEnd(r.to, ctx),
    })),
  }
}

function renameConnection(c: Connection, ctx: RenameCtx): Connection {
  return {
    ...c,
    from: renameExact(c.from, ctx) ?? c.from,
    to: renameExact(c.to, ctx) ?? c.to,
    guardZone: renameExact(c.guardZone, ctx),
    gatePlacementArgs:
      c.gatePlacement === 'NearZone' ? renameExact(c.gatePlacementArgs, ctx) : c.gatePlacementArgs,
  }
}

function renameVariant(v: Variant, ctx: RenameCtx): Variant {
  const orientation = v.orientation
    ? { ...v.orientation, zeroAngleZone: renameExact(v.orientation.zeroAngleZone, ctx) }
    : v.orientation
  return {
    ...v,
    orientation,
    zones: (v.zones ?? []).map((z) => renameZoneObj(z, ctx)),
    connections: (v.connections ?? []).map((c) => renameConnection(c, ctx)),
  }
}

function renameMcRules(rules: McRule[] | undefined, ctx: RenameCtx): McRule[] | undefined {
  if (!rules || ctx.connIds.size === 0) return rules
  return rules.map((r) => {
    if (r.type !== 'Connection' || !Array.isArray(r.args)) return r
    return { ...r, args: r.args.map((a) => ctx.connIds.get(String(a)) ?? a) }
  })
}

function renameMandatoryContent(
  groups: MandatoryContentGroup[] | undefined,
  ctx: RenameCtx,
): MandatoryContentGroup[] | undefined {
  if (!groups || ctx.connIds.size === 0) return groups
  return groups.map((g) => ({
    ...g,
    content: (g.content ?? []).map((item) =>
      item.rules ? { ...item, rules: renameMcRules(item.rules, ctx) } : item,
    ),
  }))
}

/**
 * Неявный id связи — `From-To`, если у связи нет собственного name.
 * При переименовании зоны такой id меняется, и все ссылки на него должны переписаться.
 */
function buildConnectionIdMap(
  template: RmgTemplate,
  oldName: string,
  newName: string,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const v of template.variants ?? []) {
    for (const c of v.connections ?? []) {
      if (c.name) continue
      const oldId = `${c.from}-${c.to}`
      const from = c.from === oldName ? newName : c.from
      const to = c.to === oldName ? newName : c.to
      const newId = `${from}-${to}`
      if (newId !== oldId) map.set(oldId, newId)
    }
  }
  return map
}

/**
 * Каскадное переименование зоны по всем вариантам шаблона.
 * Обновляются: имя зоны, ссылки связей (from/to/guardZone/gatePlacementArgs),
 * orientation.zeroAngleZone, биомы (MatchZone/MatchMainObject/differentFrom),
 * faction, placementArgs (NearZone/Connection), roads и правила
 * mandatoryContent по неявным id связей, позиции схемы (sidecar).
 */
export function renameZoneInTemplate(
  template: RmgTemplate,
  oldName: string,
  newName: string,
): RmgTemplate {
  const ctx: RenameCtx = {
    oldName,
    newName,
    connIds: buildConnectionIdMap(template, oldName, newName),
  }
  return {
    ...template,
    variants: (template.variants ?? []).map((v) => renameVariant(v, ctx)),
    mandatoryContent: renameMandatoryContent(template.mandatoryContent, ctx),
  }
}

/** Переименовывает ключ зоны во всех слотах позиций sidecar. */
export function renameZonePositions<T extends Record<string, unknown>>(
  positions: T[],
  oldName: string,
  newName: string,
): T[] {
  return positions.map((slot) => {
    if (!(oldName in slot)) return slot
    const next = { ...(slot as Record<string, unknown>) } as Record<string, unknown>
    const pos = next[oldName]
    delete next[oldName]
    next[newName] = pos
    return next as T
  })
}

/** Переименовывает ключ зоны в заметках sidecar (`.editor.json`, не часть `.rmg.json`). */
export function renameZoneNotes(
  notes: Record<string, string>,
  oldName: string,
  newName: string,
): Record<string, string> {
  if (!(oldName in notes)) return notes
  const next = { ...notes }
  next[newName] = next[oldName]
  delete next[oldName]
  return next
}
