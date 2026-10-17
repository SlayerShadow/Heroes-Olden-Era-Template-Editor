export type BiomeSelectorType = 'MatchMainObject' | 'FromList' | 'MatchZone'

export interface BiomeSelector {
  type: BiomeSelectorType
  args: string[]
}

export type MainObjectType = 'City' | 'Spawn' | 'AbandonedOutpost' | 'GladiatorArena'
export type Placement = 'Uniform' | 'Center' | 'Connection' | 'NearZone'

export interface FactionSelector {
  type: 'Match' | 'FromList'
  args: string[]
}

export interface MainObject {
  type: MainObjectType
  spawn?: string
  placement: Placement
  placementArgs?: string[]
  owner?: string
  faction?: FactionSelector
  buildingsConstructionSid?: string
  buildingsBanSid?: string
  guardChance?: number
  guardValue?: number
  guardRandomization?: number
  guardWeeklyIncrement?: number
  removeGuardIfHasOwner?: boolean
  isKeyObject?: boolean
  holdCityWinCon?: boolean
  initialUnitIncrement?: number
  enableWeeklyUnitIncrement?: boolean
}

export type RoadEndpointType = 'MainObject' | 'Connection' | 'Crossroads' | 'MandatoryContent'
export type RoadSurface = 'Stone' | 'Dirt'

export interface RoadEndpoint {
  type: RoadEndpointType
  args: string[]
}

export interface Road {
  /** Покрытие дороги. Может отсутствовать — такие дороги встречаются в штатных шаблонах (~10%, в осн. Jebus-семейство). */
  type?: RoadSurface
  from: RoadEndpoint
  to: RoadEndpoint
}

export interface EncounterHolesSettings {
  /** Доля энкаунтеров с «дырами» (0..1) */
  affectedEncounters?: number
  /** Доля «дыр» с двумя проходами (0..1) */
  twoHoleEncounters?: number
}

export interface Zone {
  name: string
  size: number
  layout: string
  mainObjects: MainObject[]
  zoneBiome: BiomeSelector
  contentBiome: BiomeSelector
  metaObjectsBiome: BiomeSelector
  roads?: Road[]
  mandatoryContent?: string[]
  contentCountLimits?: string[]
  crossroadsPosition?: number
  guardedContentValue?: number
  guardedContentValuePerArea?: number
  unguardedContentValue?: number
  unguardedContentValuePerArea?: number
  resourcesValue?: number
  resourcesValuePerArea?: number
  guardedContentPool?: string[]
  unguardedContentPool?: string[]
  resourcesContentPool?: string[]
  guardCutoffValue?: number
  guardMultiplier?: number
  guardRandomization?: number
  guardWeeklyIncrement?: number
  guardReactionDistribution?: number[]
  diplomacyModifier?: number
  /** Ключ: номер random_hire (1..7), значение: начальный прирост найма */
  randomHireInitialUnitIncrement?: number[]
  /** Ключ: номер random_hire (1..7), значение: включить еженедельный прирост */
  randomHireEnableWeeklyUnitIncrement?: boolean[]
  /** «Дыры» в энкаунтерах — активно при gameRules.encounterHoles=true (Anarchy) */
  encounterHolesSettings?: EncounterHolesSettings
}

export type ConnectionType = 'Direct' | 'Default' | 'Portal' | 'Proximity' | 'GladiatorArena'

export interface Connection {
  name?: string
  from: string
  to: string
  connectionType: ConnectionType
  guardValue?: number
  guardWeeklyIncrement?: number
  guardRandomization?: number
  guardZone?: string
  guardMatchGroup?: string
  guardEscape?: boolean
  road?: boolean
  simTurnSquad?: boolean
  gatePlacement?: string
  gatePlacementArgs?: string
  /** Правила размещения врат портала (формат как у mandatoryContent rules) */
  portalPlacementRulesFrom?: McRule[]
  portalPlacementRulesTo?: McRule[]
  length?: number
}

export type OrientationMode = 'MinimalBoundingSquare' | 'BoundingCircle'

export interface Orientation {
  /** Способ вписания макета зон в квадрат карты */
  mode?: OrientationMode
  baseAngleMin?: number
  baseAngleMax?: number
  randomAngleAmplitude?: number
  randomAngleStep?: number
  zeroAngleZone?: string
}

export interface BorderNoise {
  /** Амплитуда шума кромки (0.5–2) */
  amp?: number
  /** Частота шума кромки (1–12) */
  freq?: number
}

export interface Border {
  /** Скругление углов игровой области (доля от половины стороны, 0–0.8) */
  cornerRadius?: number
  /** Толщина кольца непроходимых препятствий по краю (в клетках, 2–6) */
  obstaclesWidth?: number
  obstaclesNoise?: BorderNoise[]
  /** Толщина водного кольца (0 = без воды по краю) */
  waterWidth?: number
  waterNoise?: BorderNoise[]
  /** Тип/вид воды (sid, в штатных только "water grass") */
  waterType?: string
}

export interface Variant {
  orientation?: Orientation
  border?: Border
  zones: Zone[]
  connections: Connection[]
}

export type GameMode = 'Classic' | 'SingleHero'

export type McRuleType = 'Road' | 'MainObject' | 'Crossroads' | 'Sid' | 'Connection'

export interface McRule {
  type: McRuleType | string
  args?: Array<string | number>
  targetMin?: number
  targetMax?: number
  weight?: number
  target?: number
}

export interface McContentVariant {
  sid?: string
  variant?: number
  weight?: number
}

export interface MandatoryContentItem {
  sid?: string
  name?: string
  variant?: number
  isMine?: boolean
  isGuarded?: boolean
  road?: boolean
  owner?: string
  guardValue?: number
  soloEncounter?: boolean
  designatedEncounter?: boolean
  includeLists?: string[]
  content?: McContentVariant[]
  rules?: McRule[]
}

export interface MandatoryContentGroup {
  name: string
  content: MandatoryContentItem[]
}

export interface ContentCountLimit {
  sid?: string
  variant?: number
  maxCount: number
  content?: McContentVariant[]
  includeLists?: string[]
}

export interface ContentCountLimitGroup {
  name: string
  limits: ContentCountLimit[]
}

export interface ValueOverride {
  sid: string
  variant: number
  guardValue: number
}

export interface Bonus {
  sid: string
  receiverSide?: number
  receiverFilter?: string
  parameters: string[]
}

export interface WinConditions {
  classic?: boolean
  desertion?: boolean
  desertionDay?: number
  desertionValue?: number
  heroLighting?: boolean
  heroLightingDay?: number
  lostStartCity?: boolean
  lostStartCityDay?: number
  lostStartHero?: boolean
  cityHold?: boolean
  cityHoldDays?: number
  holdCityWinCon?: boolean
  gladiatorArena?: boolean
  gladiatorArenaRegistrationStartWork?: boolean
  gladiatorArenaRegistrationStartFight?: boolean
  gladiatorArenaDaysDelayStart?: number
  gladiatorArenaCountDay?: number
  tournament?: boolean
  tournamentPointsToWin?: number
  tournamentSaveArmy?: boolean
  tournamentDays?: number[]
  tournamentAnnounceDays?: number[]
  championSelectRule?: string
}

export interface GlobalBans {
  magics?: string[]
  items?: string[]
  skills?: string[]
  heroes?: string[]
}

export interface GameRules {
  heroCountMin?: number
  heroCountMax?: number
  heroCountIncrement?: number
  heroHireBan?: boolean
  encounterHoles?: boolean
  tournamentRules?: boolean
  bonuses?: Bonus[]
  winConditions?: WinConditions
  factionLawsExpModifier?: number
  astrologyExpModifier?: number
  globalBans?: GlobalBans
}

export interface ElevationMode {
  weight: number
  minElevatedFraction: number
  maxElevatedFraction: number
}

export interface GuardedEncounterResourceFractions {
  countBounds: number[]
  fractions: number[]
}

export interface AmbientPickupDistribution {
  repulsion: number
  noise: number
  roadAttraction: number
  obstacleAttraction: number
  groupSizeWeights: number[]
}

export interface ZoneLayout {
  name: string
  obstaclesFill?: number
  obstaclesFillVoid?: number
  lakesFill?: number
  minLakeArea?: number
  elevationClusterScale?: number
  elevationModes?: ElevationMode[]
  roadClusterArea?: number
  guardedEncounterResourceFractions?: GuardedEncounterResourceFractions
  ambientPickupDistribution?: AmbientPickupDistribution
}

export interface RmgTemplate {
  name: string
  gameMode: GameMode
  description?: string
  displayWinCondition?: string
  sizeX?: number
  sizeZ?: number
  valueOverrides?: ValueOverride[]
  gameRules?: GameRules
  globalBans?: GlobalBans
  variants: Variant[]
  zoneLayouts?: ZoneLayout[]
  mandatoryContent?: MandatoryContentGroup[]
  contentCountLimits?: ContentCountLimitGroup[]
  contentPools?: unknown[]
  contentLists?: unknown[]
}