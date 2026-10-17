import type { ContentPool } from '../data/poolCatalog'

export const POOL_PROFILES = ['base', 'item', 'pandora', 'hire', 'unit_bank', 'res_bank', 'stat', 'magic'] as const
export type PoolProfile = (typeof POOL_PROFILES)[number]

export const POOL_TIERS = ['t0', 't1', 't2', 't3', 't4', 't5'] as const
export type PoolTier = (typeof POOL_TIERS)[number]

export type PoolKind = 'random' | 'classic' | 'template' | 'content' | 'other'
export type PoolGuard = 'guarded' | 'unguarded'

export interface PoolTag {
  kind: PoolKind
  classic?: boolean
  guard?: PoolGuard
  tier?: string
  profile?: PoolProfile
  template?: string
  role?: string
  wealth?: string
  resources?: boolean
}

const RANDOM_RE =
  /^(classic_)?template_pool_random(?:_unguarded)?_t(\d)_(base|item|pandora|hire|unit_bank|res_bank|stat|magic)$/

const RESOURCE_WEALTH = ['very_poor', 'poor', 'medium', 'rich', 'zero', 'dust_only']

export function parsePoolName(name: string): PoolTag {
  const random = name.match(RANDOM_RE)
  if (random) {
    return {
      kind: random[1] ? 'classic' : 'random',
      classic: !!random[1],
      guard: name.includes('_unguarded_') ? 'unguarded' : 'guarded',
      tier: `t${random[2]}`,
      profile: random[3] as PoolProfile,
    }
  }

  if (name.startsWith('template_pool_')) {
    const rest = name.slice('template_pool_'.length)
    if (rest === 'default') return { kind: 'template', template: 'default', role: 'default' }
    const m = rest.match(/^([a-z0-9_]+?)_(guarded|unguarded)_(.+)$/)
    if (m) {
      return { kind: 'template', template: m[1], guard: m[2] as PoolGuard, role: m[3].replace(/_zone$/, '') }
    }
    return { kind: 'template', template: rest }
  }

  if (name.startsWith('content_pool_')) {
    const rest = name.slice('content_pool_'.length)
    const tag: PoolTag = { kind: 'content' }

    const res = rest.match(/^(general_resources|resources)(?:_(.*))?$/)
    if (res) {
      tag.resources = true
      const tail = res[2] ?? ''
      const wealth = RESOURCE_WEALTH.find((w) => tail.includes(`_${w}`) || tail.endsWith(w))
      tag.wealth = wealth
      tag.role = tail.replace(/_(?:very_poor|poor|medium|rich|zero|dust_only)/g, '').replace(/_no_scrolls$/, '')
      return tag
    }

    const tpl = rest.match(/^template_(.+?)_(guarded|unguarded)_(.+)$/)
    if (tpl) {
      tag.template = tpl[1]
      tag.guard = tpl[2] as PoolGuard
      tag.role = tpl[3].replace(/_zone$/, '')
      return tag
    }

    const gt = rest.match(/^(.+?)_(guarded|unguarded)_(.+)$/)
    if (gt) {
      tag.template = gt[1]
      tag.guard = gt[2] as PoolGuard
      tag.role = gt[3].replace(/_zone$/, '')
      return tag
    }

    const plain = rest.match(/^(.+?)_(guarded|unguarded)$/)
    if (plain) {
      tag.template = plain[1]
      tag.guard = plain[2] as PoolGuard
      return tag
    }

    tag.role = rest
    return tag
  }

  return { kind: 'other' }
}

/**
 * Теги пула как коды. Префиксы `kind.` / `guard.` / `profile.` переводятся
 * в UI-слое (common:poolTags.*); tier, template, wealth, role — данные из
 * имени пула, отображаются как есть.
 */
export function poolTags(tag: PoolTag): string[] {
  const out: string[] = []
  out.push(`kind.${tag.kind}`)
  if (tag.guard) out.push(`guard.${tag.guard}`)
  if (tag.tier) out.push(tag.tier)
  if (tag.profile) out.push(`profile.${tag.profile}`)
  if (tag.template && tag.kind !== 'content') out.push(tag.template)
  if (tag.wealth) out.push(tag.wealth)
  if (tag.role && !tag.resources) out.push(tag.role)
  return out
}

export function groupWeightTotal(pool: Pick<ContentPool, 'groups'>): number {
  return pool.groups.reduce((a, g) => a + g.weight, 0)
}

export function listRefCount(pool: Pick<ContentPool, 'groups'>): number {
  return pool.groups.reduce((a, g) => a + g.lists.length, 0)
}

/** Какие пулы ссылаются на каждый content list. */
export function poolNamesByList(pools: readonly ContentPool[]): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const p of pools) {
    const names = new Set<string>()
    for (const g of p.groups) {
      for (const ln of g.lists) names.add(ln)
    }
    for (const ln of names) {
      const arr = m.get(ln)
      if (arr) arr.push(p.name)
      else m.set(ln, [p.name])
    }
  }
  return m
}

export interface ValueBin {
  label: string
  weight: number
}

/** priceBounds — границы корзин, weights — вес каждой корзины (на 1 больше). */
export function poolValueBins(pool: ContentPool): ValueBin[] {
  const { priceBounds, weights } = pool
  if (!priceBounds?.length || !weights?.length) return []
  return weights.map((weight, i) => {
    const lo = i === 0 ? null : priceBounds[i - 1]
    const hi = i === priceBounds.length ? null : priceBounds[i]
    const label = lo == null ? `≤${hi}` : hi == null ? `≥${lo}` : `${lo}–${hi}`
    return { label, weight }
  })
}

export function formatWeight(w: number): string {
  if (w >= 1000) return `${(w / 1000).toFixed(w % 1000 === 0 ? 0 : 1)}k`
  return String(w)
}

/** Суммарный вес каждого content list в пуле (по всем группам). */
export function poolListWeights(pool: Pick<ContentPool, 'groups'>): Map<string, number> {
  const m = new Map<string, number>()
  for (const g of pool.groups) {
    for (const ln of g.lists) {
      m.set(ln, (m.get(ln) ?? 0) + g.weight)
    }
  }
  return m
}

export interface CompareMatrixRow {
  list: string
  /** вес списка в каждом пуле (порядок — как в аргументе comparePools); null — списка нет */
  weights: (number | null)[]
  /** список присутствует во всех сравниваемых пулах */
  inAll: boolean
  /** состав или вес различается между пулами */
  differs: boolean
}

export interface PoolCompareResult {
  /** все списки объединения, по алфавиту */
  unionLists: string[]
  /** списки, присутствующие во всех пулах */
  commonLists: string[]
  /** списки, встречающиеся ровно в одном пуле */
  uniqueLists: string[]
  /** индекс Жаккара по составу списков: |общие| / |объединение| (0..1, 0 при пустом объединении) */
  jaccard: number
  matrix: CompareMatrixRow[]
}

/** Диагностика сравнения пулов: общие/уникальные списки и матрица весов. */
export function comparePools(pools: readonly Pick<ContentPool, 'groups'>[]): PoolCompareResult {
  const byList = pools.map(poolListWeights)
  const union = new Set<string>()
  for (const m of byList) {
    for (const ln of m.keys()) union.add(ln)
  }
  const unionLists = [...union].sort()
  const n = pools.length

  const matrix: CompareMatrixRow[] = unionLists.map((list) => {
    const weights = byList.map((m) => m.get(list) ?? null)
    const present = weights.filter((w): w is number => w != null)
    const inAll = present.length === n
    const differs = present.length !== n || new Set(present).size > 1
    return { list, weights, inAll, differs }
  })

  const commonLists = matrix.filter((r) => r.inAll).map((r) => r.list)
  const uniqueLists = matrix.filter((r) => r.weights.filter((w) => w != null).length === 1).map((r) => r.list)

  return {
    unionLists,
    commonLists,
    uniqueLists,
    jaccard: unionLists.length ? commonLists.length / unionLists.length : 0,
    matrix,
  }
}