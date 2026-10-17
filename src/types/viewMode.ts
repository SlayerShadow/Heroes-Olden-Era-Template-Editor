export type ViewMode = 'overview' | 'budget' | 'guard' | 'biome' | 'road' | 'mandatory'

export type BiomeLayer = 'zone' | 'content' | 'meta'

export type BudgetMetric = 'total' | 'guarded' | 'unguarded' | 'resources'

export type BudgetTarget = 'abs' | 'perArea'

export type BiomeName = 'Grass' | 'Sand' | 'Snow' | 'Dirt' | 'Deathland' | 'Autumn' | 'Lava'

export interface BiomeResolve {
  biome: BiomeName | 'any' | 'unknown'
  kind:
    | 'fixed'
    | 'match-zone'
    | 'match-object'
    | 'different-from'
    | 'multi'
    | 'any'
    | 'unknown'
  sourceZone?: string
  sourceObject?: string
}