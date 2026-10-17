import type { Connection, RmgTemplate, Road, Variant, Zone } from '../types/rmg'
import {
  BUILDINGS_BAN_PRESETS as CATALOG_BUILDINGS_BAN_PRESETS,
  BUILDINGS_CONSTRUCTION_PRESETS as CATALOG_BUILDINGS_CONSTRUCTION_PRESETS,
} from '../data/presets.ts'

export type Severity = 'error' | 'warning' | 'info'
export type IssueGroup = 'root' | 'variant' | 'zone' | 'connection' | 'road'

/** Параметры интерполяции сообщения/scope (подставляются в перевод на слое UI). */
export type IssueParams = Record<string, string | number>

/** Координаты issue для кликабельной навигации в панели валидатора. */
export interface IssueNav {
  /** Индекс варианта раскладки (0-based); undefined — корень шаблона. */
  variant?: number
  /** Имя зоны варианта (для issue группы zone/road). */
  zoneId?: string
  /** Канонический id связи (name ?? from-to) для issue группы connection. */
  connectionId?: string
}

/** Код «места» замечания; текст собирается переводом `validator:scope.<code>`. */
export type ScopeCode =
  | 'root' // корень шаблона (отображается пустой строкой)
  | 'mapSize' // размер карты
  | 'variant' // V{{variant}}
  | 'zone' // V{{variant}} · {{zone}}
  | 'connection' // V{{variant}} · связь {{connection}}
  | 'guardGroup' // V{{variant}} · группа стражей {{group}}
  | 'road' // V{{variant}} · {{zone}} · дорога {{road}}
  | 'group' // группа mandatoryContent/contentCountLimits в корне: {{group}}

export interface IssueScope {
  code: ScopeCode
  params?: IssueParams
}

/**
 * Коды замечаний валидатора. Переводы — `validator:issues.<code>` (i18n),
 * исчерпаемость контролируется компилятором в src/i18n/locales/ru/validator/index.ts.
 */
export type IssueCode =
  // ---- корень: общее ----
  | 'nameEmpty'
  | 'gameModeUnknown'
  | 'sizeNotSquare'
  | 'sizeNotMultiple16'
  | 'sizeOutOfRange'
  | 'noVariants'
  // ---- корень: группы контента ----
  | 'mcGroupDupNames'
  | 'ccGroupDupNames'
  | 'noMcGroups'
  | 'noCcGroups'
  | 'inlinePoolsLegacy'
  | 'inlineListsUnverified'
  | 'mcGroupEmpty'
  | 'mcItemDead'
  | 'listNotFound'
  | 'mcRuleUnknownType'
  | 'ccGroupEmpty'
  // ---- корень: valueOverrides / globalBans / gameRules ----
  | 'overrideNoSid'
  | 'overrideVariantRange'
  | 'overrideNegativeGuardValue'
  | 'overrideDuplicate'
  | 'bansDuplicates'
  | 'gameRulesRequiredMissing'
  | 'gameRulesValueOutOfRange'
  | 'heroCountMinMax'
  | 'heroHireBanConflict'
  | 'tournamentRulesNotBoolean'
  | 'bonusNoSid'
  | 'bonusReceiverSide'
  | 'desertionDayWithoutDesertion'
  | 'tournamentDaysLength'
  // ---- корень: zoneLayouts ----
  | 'layoutNoName'
  | 'layoutDupNames'
  | 'layoutRequiredMissing'
  // ---- вариант ----
  | 'noZones'
  | 'zoneDupNames'
  | 'spawnAlreadyUsed'
  | 'connDupAutoNames'
  | 'guardGroupSingle'
  | 'guardGroupFieldMismatch'
  // ---- связь ----
  | 'connFromMissing'
  | 'connToMissing'
  | 'connTypeUnknown'
  | 'connNegativeGuardValue'
  | 'portalNoGatePlacement'
  | 'proximityNoLength'
  | 'connGuardZoneMissing'
  | 'connGateZoneMissing'
  | 'connGatePlacementUnknown'
  | 'connGateRuleUnknownType'
  | 'connGateRuleTargetMin'
  | 'connGateRuleTargetMax'
  | 'connGateRuleWeight'
  // ---- зона: ссылки на другие зоны ----
  | 'zoneRefMatchZone'
  | 'zoneRefMatchMainObject'
  | 'zoneRefDifferentFrom'
  | 'zoneRefFactionMatch'
  | 'zoneRefFactionDifferentFrom'
  | 'zoneRefNearZone'
  // ---- зона ----
  | 'zoneNameEmpty'
  | 'biomeSelectorUnknown'
  | 'zoneSizePositive'
  | 'zoneSizeRange'
  | 'zoneLayoutNotDeclared'
  | 'zoneBudgetBothAbsoluteAndPerArea'
  | 'zoneBudgetNegative'
  | 'moSpawnWithoutPlayer'
  | 'moTypeUnknown'
  | 'moPlacementUnknown'
  | 'moConstructionPresetUnknown'
  | 'moBanPresetUnknown'
  | 'moGuardChanceRange'
  | 'moNegativeGuardValue'
  | 'moFactionTypeUnknown'
  | 'moPlacementConnectionMissing'
  | 'randomHireInitialUnitIncrementLength'
  | 'randomHireEnableWeeklyUnitIncrementLength'
  | 'grdNotArray'
  | 'grdLength'
  | 'grdNotNumbers'
  | 'ehsIgnored'
  | 'ehsShareRange'
  | 'zoneNoMc'
  | 'zoneMcGroupMissing'
  | 'zoneCclStringAnomaly'
  | 'zoneCclEmpty'
  | 'zoneCclGroupMissing'
  | 'zonePoolUnknown'
  | 'mcGroupRuleConnectionMissing'
  | 'mcGroupRuleTargetMin'
  | 'mcGroupRuleTargetMax'
  | 'mcGroupRuleWeight'
  // ---- дороги ----
  | 'roadTypeUnknown'
  | 'roadSelfLoop'
  | 'roadEndNotObject'
  | 'roadEndMainObjectNoIndex'
  | 'roadEndMainObjectOutOfRange'
  | 'roadEndConnectionMissing'
  | 'roadEndMcMissing'
  | 'roadEndCrossroadsExtraArgs'
  | 'roadEndTypeUnknown'
  // ---- ориентация макета ----
  | 'orientationModeUnknown'
  | 'orientationAngleMinMax'
  | 'orientationBaseAngleMinRange'
  | 'orientationBaseAngleMaxRange'
  | 'orientationRandomAmplitudeRange'
  | 'orientationRandomStepRange'
  | 'orientationZeroAngleZoneMissing'
  // ---- граница карты ----
  | 'borderCornerRadiusRange'
  | 'borderObstaclesWidthRange'
  | 'borderWaterWidthRange'
  | 'borderWaterTypeNonstandard'
  | 'borderNoiseAmpRange'
  | 'borderNoiseFreqRange'

export interface ValidationIssue extends IssueNav {
  severity: Severity
  group: IssueGroup
  scope: IssueScope
  path: string
  code: IssueCode
  params?: IssueParams
}

/** Внешние знания, недоступные чистой функции (каталог пулов/списков генератора). */
export interface ValidateOptions {
  /** Имена пулов контента из каталога (`catalog.poolNames`); проверка включена только при наличии. */
  poolNames?: Iterable<string>
  /** Имена content-списков (`catalog.listNames`); проверка включена только при наличии. */
  listNames?: Iterable<string>
}

export interface ValidationReport {
  issues: ValidationIssue[]
  errors: number
  warnings: number
  infos: number
}

// Каталог пресетов застройки/банлистов вынесен в ../data/presets.ts (собран из core_db,
// `DB/buildings_constructions/*.json`, `DB/buildings_bans/*.json`) — фиксирован и мал,
// поэтому доступен и чистой функции, и UI. В штатных шаблонах есть 5 известных битых
// ссылок (игра переносит их молча) — см. KNOWN_BROKEN_CONSTRUCTION_PRESETS в presets.ts;
// их в каталоге нет, и валидатор помечает их как предупреждение (не ошибку).

const BUILDINGS_CONSTRUCTION_PRESETS = new Set(CATALOG_BUILDINGS_CONSTRUCTION_PRESETS)

const BUILDINGS_BAN_PRESETS = new Set(CATALOG_BUILDINGS_BAN_PRESETS)

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object'
}

function groupNames(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const out: string[] = []
  for (const g of list) if (isObj(g) && typeof g.name === 'string' && g.name) out.push(g.name)
  return out
}

function dupNames(names: string[]): string[] {
  const seen = new Set<string>()
  const dup: string[] = []
  for (const n of names) {
    if (seen.has(n)) dup.push(n)
    seen.add(n)
  }
  return [...new Set(dup)]
}

const connId = (c: Connection): string => c.name ?? `${c.from}-${c.to}`

/** Числовые ключи zoneLayouts[], обязательные по данным 60 штатных шаблонов. */
const LAYOUT_REQUIRED_NUMS = ['obstaclesFill', 'obstaclesFillVoid', 'lakesFill', 'elevationClusterScale', 'roadClusterArea'] as const

/** Числовые ключи ambientPickupDistribution, обязательные по тем же данным. */
const AMBIENT_REQUIRED_NUMS = ['repulsion', 'noise', 'roadAttraction', 'obstacleAttraction'] as const

/** Числовые ключи gameRules, обязательные по данным 60 штатных шаблонов. */
const GAME_RULES_REQUIRED_NUMS = ['heroCountMin', 'heroCountMax', 'heroCountIncrement'] as const

/** Булевы ключи gameRules, обязательные по тем же данным. */
const GAME_RULES_REQUIRED_BOOLS = ['heroHireBan', 'encounterHoles'] as const

/** Диапазоны числовых ключей gameRules: наблюдаемые значения во всех 60 штатных
 * шаблонах (скан map_templates), зеркалируются min/max Num-полей редактора. */
const GAME_RULES_RANGES = [
  { field: 'heroCountMin', min: 0, max: 6 },
  { field: 'heroCountMax', min: 1, max: 10 },
  { field: 'heroCountIncrement', min: 0, max: 2 },
] as const

const DIFFERENT_FROM_RE = /^differentFrom:\s*(?:(\d+)\s+)?(\S.*)$/

/** Разбор выражения `differentFrom: [индекс ]<имяЗоны>` → имя зоны (или undefined). */
export function parseDifferentFrom(arg: string): string | undefined {
  return DIFFERENT_FROM_RE.exec(arg)?.[2]
}

export function validateTemplate(template: RmgTemplate, options?: ValidateOptions): ValidationReport {
  const issues: ValidationIssue[] = []
  const add = (
    severity: Severity,
    group: IssueGroup,
    scope: IssueScope,
    path: string,
    code: IssueCode,
    params?: IssueParams,
    nav?: IssueNav,
  ) => issues.push({ severity, group, scope, path, code, ...(params ? { params } : {}), ...nav })

  const ROOT: IssueScope = { code: 'root' }

  // ---------- корень ----------
  if (!template.name || !template.name.trim()) {
    add('error', 'root', ROOT, 'name', 'nameEmpty')
  }
  if (template.gameMode !== undefined && template.gameMode !== 'Classic' && template.gameMode !== 'SingleHero') {
    add('error', 'root', ROOT, 'gameMode', 'gameModeUnknown', { value: template.gameMode })
  }

  const sizes = [template.sizeX, template.sizeZ].filter((v): v is number => typeof v === 'number')
  if (sizes.length > 0) {
    const a = sizes[0]
    const b = sizes[1] ?? sizes[0]
    const scope: IssueScope = { code: 'mapSize' }
    if (a !== b) add('warning', 'root', scope, 'sizeX/sizeZ', 'sizeNotSquare')
    if (a % 16 !== 0 || b % 16 !== 0) add('warning', 'root', scope, 'sizeX/sizeZ', 'sizeNotMultiple16')
    if (a < 80 || a > 240) add('warning', 'root', scope, 'sizeX', 'sizeOutOfRange')
  }

  const variants = Array.isArray(template.variants) ? template.variants : []
  if (variants.length === 0) {
    add('error', 'root', ROOT, 'variants', 'noVariants')
  }

  const poolNames = options?.poolNames ? new Set(options.poolNames) : null
  const listNames = options?.listNames ? new Set(options.listNames) : null

  const mcGroups = groupNames(template.mandatoryContent)
  const ccGroups = groupNames(template.contentCountLimits)

  for (const d of dupNames(mcGroups)) {
    add('warning', 'root', ROOT, 'mandatoryContent[].name', 'mcGroupDupNames', { name: d })
  }
  for (const d of dupNames(ccGroups)) {
    add('warning', 'root', ROOT, 'contentCountLimits[].name', 'ccGroupDupNames', { name: d })
  }
  if (mcGroups.length === 0) {
    add('warning', 'root', ROOT, 'mandatoryContent', 'noMcGroups')
  }
  if (ccGroups.length === 0) {
    add('warning', 'root', ROOT, 'contentCountLimits', 'noCcGroups')
  }
  if (Array.isArray(template.contentPools) && template.contentPools.length > 0) {
    add('info', 'root', ROOT, 'contentPools', 'inlinePoolsLegacy')
  }
  if (Array.isArray(template.contentLists) && template.contentLists.length > 0) {
    add('info', 'root', ROOT, 'contentLists', 'inlineListsUnverified')
  }

  // имена name_* объектов обязательного контента (для дорог)
  const mcItemNames = new Set<string>()
  for (const g of template.mandatoryContent ?? []) {
    if (!isObj(g)) continue
    const content = Array.isArray(g.content) ? g.content : []
    const gname = String(g.name ?? '?')
    const gscope: IssueScope = { code: 'group', params: { group: gname } }
    if (content.length === 0) {
      add('warning', 'root', gscope, 'mandatoryContent[].content', 'mcGroupEmpty')
      continue
    }
    for (const item of content) {
      if (!isObj(item)) continue
      if (!item.sid && (!Array.isArray(item.includeLists) || item.includeLists.length === 0)) {
        add('warning', 'root', gscope, 'mandatoryContent[].content[]', 'mcItemDead')
      }
      if (listNames && listNames.size > 0) {
        for (const ln of Array.isArray(item.includeLists) ? item.includeLists : []) {
          if (ln && !listNames.has(ln)) {
            add('warning', 'root', gscope, 'mandatoryContent[].content[].includeLists[]', 'listNotFound', { name: ln })
          }
        }
      }
      if (typeof item.name === 'string' && item.name) mcItemNames.add(item.name)
      const rules = Array.isArray(item.rules) ? item.rules : []
      for (const rule of rules) {
        if (!isObj(rule)) continue
        const t = String(rule.type)
        if (!['Road', 'MainObject', 'Crossroads', 'Sid', 'Connection'].includes(t)) {
          add('warning', 'root', gscope, 'mandatoryContent[].rules[].type', 'mcRuleUnknownType', { type: t })
        }
      }
    }
  }

  for (const g of template.contentCountLimits ?? []) {
    if (!isObj(g)) continue
    const gname = String(g.name ?? '?')
    const gscope: IssueScope = { code: 'group', params: { group: gname } }
    if (!Array.isArray(g.limits) || g.limits.length === 0) {
      add('warning', 'root', gscope, 'contentCountLimits[].limits', 'ccGroupEmpty')
      continue
    }
    if (!listNames || listNames.size === 0) continue
    for (const lim of g.limits) {
      if (!isObj(lim)) continue
      for (const ln of Array.isArray(lim.includeLists) ? lim.includeLists : []) {
        if (ln && !listNames.has(ln)) {
          add('warning', 'root', gscope, 'contentCountLimits[].limits[].includeLists[]', 'listNotFound', { name: ln })
        }
      }
    }
  }

  // ---------- valueOverrides ----------
  const overrides = template.valueOverrides
  if (Array.isArray(overrides)) {
    const seen = new Set<string>()
    for (const o of overrides) {
      if (!isObj(o)) continue
      const sid = typeof o.sid === 'string' ? o.sid : ''
      const variant = o.variant
      if (!sid) {
        add('warning', 'root', ROOT, 'valueOverrides[].sid', 'overrideNoSid')
      }
      if (typeof variant === 'number' && variant < -1) {
        add('warning', 'root', ROOT, 'valueOverrides[].variant', 'overrideVariantRange', { variant })
      }
      if (typeof o.guardValue === 'number' && o.guardValue < 0) {
        add('info', 'root', ROOT, 'valueOverrides[].guardValue', 'overrideNegativeGuardValue')
      }
      if (sid) {
        const key = `${sid}|${variant}`
        if (seen.has(key)) add('info', 'root', ROOT, 'valueOverrides', 'overrideDuplicate', { key })
        seen.add(key)
      }
    }
  }

  // ---------- globalBans ----------
  const bans = template.globalBans
  if (isObj(bans)) {
    for (const key of ['magics', 'items', 'skills', 'heroes'] as const) {
      const list = bans[key]
      if (!Array.isArray(list)) continue
      const unique = new Set(list)
      if (unique.size < list.length) {
        add('info', 'root', ROOT, `globalBans.${key}`, 'bansDuplicates', { count: list.length - unique.size })
      }
    }
  }

  // ---------- gameRules ----------
  const rules = template.gameRules
  if (isObj(rules)) {
    // Шесть полей есть во всех 60 штатных шаблонах (скан map_templates).
    // Поведение игры при отсутствии не проверено (гипотеза: десериализатор подставит
    // дефолты 0/false) — поэтому warning, не error: зеркалит политику layoutRequiredMissing
    // («валидатор мягче данных»).
    const missingRules: string[] = []
    for (const k of GAME_RULES_REQUIRED_NUMS) if (typeof rules[k] !== 'number') missingRules.push(k)
    for (const k of GAME_RULES_REQUIRED_BOOLS) if (typeof rules[k] !== 'boolean') missingRules.push(k)
    if (!isObj(rules.winConditions)) missingRules.push('winConditions')
    if (missingRules.length > 0) {
      add('warning', 'root', ROOT, 'gameRules', 'gameRulesRequiredMissing', { fields: missingRules.join(', ') })
    }
    const min = rules.heroCountMin
    const max = rules.heroCountMax
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      add('warning', 'root', ROOT, 'gameRules.heroCountMin/heroCountMax', 'heroCountMinMax', { min, max })
    }
    // Диапазоны — наблюдаемые значения всех 60 штатных шаблонов (скан) и
    // min/max Num-полей редактора. Num не клампит ввод, а импорт JSON минует UI вовсе,
    // поэтому значения вне диапазона достижимы обоими путями. Поведение игры вне
    // диапазонов не проверено (гипотеза: кламп или игнор) — warning, не error.
    const outOfRange: string[] = []
    for (const r of GAME_RULES_RANGES) {
      const v = rules[r.field]
      if (typeof v === 'number' && (v < r.min || v > r.max)) {
        outOfRange.push(`${r.field}: ${v} (${r.min}–${r.max})`)
      }
    }
    if (outOfRange.length > 0) {
      add('warning', 'root', ROOT, 'gameRules', 'gameRulesValueOutOfRange', { fields: outOfRange.join('; ') })
    }
    if (rules.heroHireBan === true && !(typeof max === 'number' && max <= 1)) {
      add('info', 'root', ROOT, 'gameRules.heroHireBan', 'heroHireBanConflict')
    }
    // tournamentRules — назначение поля неясно (гипотеза):
    // проверяем только форму, значение true/false равнозначно; никогда не error.
    if ('tournamentRules' in rules && typeof rules.tournamentRules !== 'boolean') {
      add('warning', 'root', ROOT, 'gameRules.tournamentRules', 'tournamentRulesNotBoolean', {
        value: JSON.stringify(rules.tournamentRules),
      })
    }
    const bonuses = rules.bonuses
    if (Array.isArray(bonuses)) {
      for (const b of bonuses) {
        if (!isObj(b)) continue
        if (!b.sid) add('warning', 'root', ROOT, 'gameRules.bonuses[].sid', 'bonusNoSid')
        if (typeof b.receiverSide === 'number' && b.receiverSide !== -1) {
          add('info', 'root', ROOT, 'gameRules.bonuses[].receiverSide', 'bonusReceiverSide', { value: b.receiverSide })
        }
      }
    }
    const wc = rules.winConditions
    if (isObj(wc)) {
      if (typeof wc.desertionDay === 'number' && wc.desertion !== true) {
        add('info', 'root', ROOT, 'gameRules.winConditions.desertionDay', 'desertionDayWithoutDesertion')
      }
      if (
        Array.isArray(wc.tournamentDays) &&
        Array.isArray(wc.tournamentAnnounceDays) &&
        wc.tournamentDays.length !== wc.tournamentAnnounceDays.length
      ) {
        add('warning', 'root', ROOT, 'gameRules.winConditions.tournamentDays', 'tournamentDaysLength', {
          days: wc.tournamentDays.length,
          announceDays: wc.tournamentAnnounceDays.length,
        })
      }
    }
  } else {
    // gameRules вовсе нет или это не объект: во всех 60 штатных он присутствует.
    add('warning', 'root', ROOT, 'gameRules', 'gameRulesRequiredMissing', { fields: 'gameRules' })
  }

  // ---------- zoneLayouts ----------
  const layouts = template.zoneLayouts
  if (Array.isArray(layouts)) {
    for (const l of layouts) {
      if (!isObj(l)) continue
      if (!l.name) add('error', 'root', ROOT, 'zoneLayouts[].name', 'layoutNoName')
      // 8 ключей присутствуют у всех 174 лэйаутов 60 штатных шаблонов (скан map_templates);
      // поведение генератора без них неизвестно — предупреждение, не ошибка (валидатор мягче данных).
      const missing: string[] = []
      for (const k of LAYOUT_REQUIRED_NUMS) if (typeof l[k] !== 'number') missing.push(k)
      const ger = l.guardedEncounterResourceFractions
      if (!isObj(ger)) missing.push('guardedEncounterResourceFractions')
      else if (!Array.isArray(ger.fractions) || ger.fractions.length === 0) missing.push('guardedEncounterResourceFractions.fractions')
      const amb = l.ambientPickupDistribution
      if (!isObj(amb)) missing.push('ambientPickupDistribution')
      else {
        for (const k of AMBIENT_REQUIRED_NUMS) if (typeof amb[k] !== 'number') missing.push(`ambientPickupDistribution.${k}`)
        if (!Array.isArray(amb.groupSizeWeights) || amb.groupSizeWeights.length === 0) missing.push('ambientPickupDistribution.groupSizeWeights')
      }
      if (missing.length > 0) {
        add('warning', 'root', ROOT, 'zoneLayouts[]', 'layoutRequiredMissing', {
          name: String(l.name ?? ''),
          fields: missing.join(', '),
        })
      }
    }
    const names = layouts.map((l) => (isObj(l) ? String(l.name ?? '') : '')).filter(Boolean)
    for (const d of dupNames(names)) {
      add('warning', 'root', ROOT, 'zoneLayouts[].name', 'layoutDupNames', { name: d })
    }
  }

  // ---------- варианты ----------
  variants.forEach((variant, vi) => {
    validateVariant(template, variant, vi, { mcGroups, ccGroups, mcItemNames, poolNames }, add)
  })

  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.filter((i) => i.severity === 'warning').length
  const infos = issues.filter((i) => i.severity === 'info').length
  return { issues, errors, warnings, infos }
}

interface VariantCtx {
  mcGroups: string[]
  ccGroups: string[]
  mcItemNames: Set<string>
  poolNames: Set<string> | null
}

type Push = (
  sev: Severity,
  group: IssueGroup,
  scope: IssueScope,
  path: string,
  code: IssueCode,
  params?: IssueParams,
  nav?: IssueNav,
) => void

function validateVariant(
  template: RmgTemplate,
  variant: Variant,
  vi: number,
  ctx: VariantCtx,
  add: Push,
): void {
  const vscope: IssueScope = { code: 'variant', params: { variant: vi + 1 } }
  const zones = Array.isArray(variant.zones) ? variant.zones : []
  const conns = Array.isArray(variant.connections) ? variant.connections : []
  const zoneNames = zones.map((z) => (z && typeof z.name === 'string' ? z.name : '')).filter(Boolean)
  const addV = (
    sev: Severity,
    group: IssueGroup,
    scope: IssueScope,
    path: string,
    code: IssueCode,
    params?: IssueParams,
    nav?: IssueNav,
  ) => add(sev, group, scope, path, code, params, { variant: vi, ...nav })

  if (zones.length === 0) addV('error', 'variant', vscope, 'zones', 'noZones')

  const dupZones = dupNames(zoneNames)
  if (dupZones.length > 0) {
    addV('error', 'variant', vscope, 'zones[].name', 'zoneDupNames', { names: dupZones.join(', ') })
  }

  validateOrientation(variant.orientation, zoneNames, vscope, vi, addV)
  validateBorder(variant.border, vscope, vi, addV)

  const spawnOwner = new Map<string, string>()
  zones.forEach((z, zi) => {
    const zoneScope = zoneScopeOf(vi, z)
    if (!z || typeof z.name !== 'string' || !z.name) return
    for (const mo of z.mainObjects ?? []) {
      if (mo?.type !== 'Spawn' || !mo.spawn) continue
      const prev = spawnOwner.get(mo.spawn)
      if (prev) {
        addV(
          'error',
          'zone',
          zoneScope,
          `variants[${vi}].zones[${zi}].mainObjects[].spawn`,
          'spawnAlreadyUsed',
          { spawn: mo.spawn, zone: prev },
          { zoneId: z.name },
        )
      } else {
        spawnOwner.set(mo.spawn, z.name)
      }
    }
  })

  const connSet = new Set<string>()
  const dupConn: string[] = []
  conns.forEach((c) => {
    const id = connId(c)
    if (connSet.has(id)) dupConn.push(id)
    connSet.add(id)
  })
  if (dupConn.length > 0) {
    addV('info', 'variant', vscope, 'connections[].name', 'connDupAutoNames', {
      names: [...new Set(dupConn)].join(', '),
    })
  }

  // guardMatchGroup — стражи одной группы должны быть согласованы (одинаковая армия)
  const gmGroups = new Map<string, Connection[]>()
  for (const c of conns) {
    if (!c.guardMatchGroup) continue
    const arr = gmGroups.get(c.guardMatchGroup)
    if (arr) arr.push(c)
    else gmGroups.set(c.guardMatchGroup, [c])
  }
  for (const [grp, list] of gmGroups) {
    const gscope: IssueScope = { code: 'guardGroup', params: { variant: vi + 1, group: grp } }
    if (list.length === 1) {
      addV('info', 'connection', gscope, `variants[${vi}].connections[].guardMatchGroup`, 'guardGroupSingle', {
        group: grp,
      })
      continue
    }
    const numeric = (v: unknown) => typeof v === 'number'
    for (const field of ['guardValue', 'guardWeeklyIncrement', 'guardRandomization'] as const) {
      const values = list.map((c) => c[field]).filter(numeric)
      const distinct = [...new Set(values)]
      if (distinct.length > 1) {
        addV('warning', 'connection', gscope, `variants[${vi}].connections[].${field}`, 'guardGroupFieldMismatch', {
          group: grp,
          field,
          values: distinct.join(' / '),
        })
      }
    }
  }

  conns.forEach((c, ci) => {
    const cid = connId(c)
    const scope: IssueScope = { code: 'connection', params: { variant: vi + 1, connection: cid } }
    const p = `variants[${vi}].connections[${ci}]`
    const addC = (sev: Severity, group: IssueGroup, path: string, code: IssueCode, params?: IssueParams) =>
      addV(sev, group, scope, path, code, params, { connectionId: cid })
    if (!zoneNames.includes(c.from)) addC('error', 'connection', `${p}.from`, 'connFromMissing', { zone: c.from })
    if (!zoneNames.includes(c.to)) addC('error', 'connection', `${p}.to`, 'connToMissing', { zone: c.to })
    if (
      c.connectionType !== undefined &&
      !['Direct', 'Default', 'Portal', 'Proximity', 'GladiatorArena'].includes(String(c.connectionType))
    ) {
      addC('warning', 'connection', `${p}.connectionType`, 'connTypeUnknown', { value: String(c.connectionType) })
    }
    if (typeof c.guardValue === 'number' && c.guardValue < 0) {
      addC('warning', 'connection', `${p}.guardValue`, 'connNegativeGuardValue', { value: c.guardValue })
    }
    if (c.connectionType === 'Portal' && !c.gatePlacement) {
      addC('info', 'connection', `${p}.gatePlacement`, 'portalNoGatePlacement')
    }
    if (c.connectionType === 'Proximity' && typeof c.length !== 'number') {
      addC('info', 'connection', `${p}.length`, 'proximityNoLength')
    }
    if (c.guardZone && !zoneNames.includes(c.guardZone)) {
      addC('warning', 'connection', `${p}.guardZone`, 'connGuardZoneMissing', { zone: c.guardZone })
    }
    if (
      c.gatePlacement === 'NearZone' &&
      typeof c.gatePlacementArgs === 'string' &&
      c.gatePlacementArgs &&
      !zoneNames.includes(c.gatePlacementArgs)
    ) {
      addC('warning', 'connection', `${p}.gatePlacementArgs`, 'connGateZoneMissing', { zone: c.gatePlacementArgs })
    }
    if (c.gatePlacement && c.gatePlacement !== 'Center' && c.gatePlacement !== 'NearZone') {
      addC('warning', 'connection', `${p}.gatePlacement`, 'connGatePlacementUnknown', { value: c.gatePlacement })
    }
    for (const dir of ['portalPlacementRulesFrom', 'portalPlacementRulesTo'] as const) {
      const rules = c[dir]
      if (!Array.isArray(rules) || rules.length === 0) continue
      for (const rule of rules) {
        if (!isObj(rule)) continue
        const rpath = `${p}.${dir}[]`
        const t = String(rule.type)
        if (t !== 'Crossroads' && t !== 'MainObject') {
          addC('warning', 'connection', `${rpath}.type`, 'connGateRuleUnknownType', { type: t })
        }
        if (typeof rule.targetMin === 'number' && (rule.targetMin < 0 || rule.targetMin > 0.9)) {
          addC('warning', 'connection', `${rpath}.targetMin`, 'connGateRuleTargetMin', { value: rule.targetMin })
        }
        if (typeof rule.targetMax === 'number' && (rule.targetMax < 0 || rule.targetMax > 2)) {
          addC('warning', 'connection', `${rpath}.targetMax`, 'connGateRuleTargetMax', { value: rule.targetMax })
        }
        if (typeof rule.weight === 'number' && (rule.weight < 1 || rule.weight > 2)) {
          addC('warning', 'connection', `${rpath}.weight`, 'connGateRuleWeight', { value: rule.weight })
        }
      }
    }
  })

  zones.forEach((z, zi) => {
    const addZ: Push = (sev, group, scope, path, code, params, nav) =>
      add(sev, group, scope, path, code, params, { variant: vi, zoneId: z.name, ...nav })
    validateZone(template, z, vi, zi, connSet, ctx, addZ)
  })
}

function validateZone(
  template: RmgTemplate,
  z: Zone,
  vi: number,
  zi: number,
  connSet: Set<string>,
  ctx: VariantCtx,
  add: Push,
): void {
  const scope = zoneScopeOf(vi, z)
  const p = `variants[${vi}].zones[${zi}]`

  const zoneNames: string[] = []
  for (const zz of template.variants[vi]?.zones ?? []) {
    if (zz && typeof zz.name === 'string' && zz.name) zoneNames.push(zz.name)
  }

  const checkZoneRef = (target: string | undefined, path: string, code: IssueCode, sev: Severity = 'warning') => {
    if (target && !zoneNames.includes(target)) {
      add(sev, 'zone', scope, path, code, { target })
    }
  }

  if (!z.name || !z.name.trim()) {
    add('error', 'zone', scope, `${p}.name`, 'zoneNameEmpty')
  }

  for (const [key, sel] of [
    ['zoneBiome', z.zoneBiome],
    ['contentBiome', z.contentBiome],
    ['metaObjectsBiome', z.metaObjectsBiome],
  ] as const) {
    if (!isObj(sel)) continue
    const bpath = `${p}.${key}`
    const args = Array.isArray(sel.args) ? sel.args : []
    const selType = String(sel.type)
    if (!['MatchMainObject', 'FromList', 'MatchZone'].includes(selType)) {
      add('warning', 'zone', scope, bpath, 'biomeSelectorUnknown', { type: selType })
      continue
    }
    if (selType === 'MatchZone') {
      checkZoneRef(String(args[0] ?? ''), bpath, 'zoneRefMatchZone')
    } else if (selType === 'MatchMainObject') {
      if (args.length > 1) checkZoneRef(String(args[1] ?? ''), bpath, 'zoneRefMatchMainObject')
    } else {
      for (const a of args) {
        const target = parseDifferentFrom(String(a))
        if (target) checkZoneRef(target, bpath, 'zoneRefDifferentFrom')
      }
    }
  }

  if (typeof z.size === 'number') {
    if (z.size <= 0) add('error', 'zone', scope, `${p}.size`, 'zoneSizePositive')
    else if (z.size < 0.15 || z.size > 2) add('warning', 'zone', scope, `${p}.size`, 'zoneSizeRange', { value: z.size })
  }

  const layoutNames = groupNames(template.zoneLayouts)
  if (z.layout !== undefined && layoutNames.length > 0 && !layoutNames.includes(z.layout)) {
    add('warning', 'zone', scope, `${p}.layout`, 'zoneLayoutNotDeclared', { layout: z.layout })
  }

  const budgetPairs: Array<[string, number | undefined, number | undefined]> = [
    ['guardedContentValue', z.guardedContentValue, z.guardedContentValuePerArea],
    ['unguardedContentValue', z.unguardedContentValue, z.unguardedContentValuePerArea],
    ['resourcesValue', z.resourcesValue, z.resourcesValuePerArea],
  ]
  for (const [label, abs, perArea] of budgetPairs) {
    // Половина штатных шаблонов (30/60) заполняет оба поля — это легально, семантика пары неизвестна.
    // Поэтому только info-подсказка, не warning.
    if (typeof abs === 'number' && abs > 0 && typeof perArea === 'number' && perArea > 0) {
      add('info', 'zone', scope, `${p}.${label} / ${label}PerArea`, 'zoneBudgetBothAbsoluteAndPerArea')
    }
    if (typeof abs === 'number' && abs < 0) {
      add('warning', 'zone', scope, `${p}.${label}`, 'zoneBudgetNegative', { value: abs })
    }
  }

  z.mainObjects?.forEach((mo, mi) => {
    const mp = `${p}.mainObjects[${mi}]`
    if (mo.type !== undefined && !['City', 'Spawn', 'AbandonedOutpost', 'GladiatorArena'].includes(String(mo.type))) {
      add('warning', 'zone', scope, `${mp}.type`, 'moTypeUnknown', { value: String(mo.type) })
    }
    if (
      mo.placement !== undefined &&
      !['Uniform', 'Center', 'Connection', 'NearZone'].includes(String(mo.placement))
    ) {
      add('warning', 'zone', scope, `${mp}.placement`, 'moPlacementUnknown', { value: String(mo.placement) })
    }
    if (mo.type === 'Spawn' && !mo.spawn) {
      add('error', 'zone', scope, `${mp}.spawn`, 'moSpawnWithoutPlayer')
    }
    if (mo.buildingsConstructionSid && !BUILDINGS_CONSTRUCTION_PRESETS.has(mo.buildingsConstructionSid)) {
      add('warning', 'zone', scope, `${mp}.buildingsConstructionSid`, 'moConstructionPresetUnknown', {
        preset: mo.buildingsConstructionSid,
      })
    }
    if (mo.buildingsBanSid && !BUILDINGS_BAN_PRESETS.has(mo.buildingsBanSid)) {
      add('warning', 'zone', scope, `${mp}.buildingsBanSid`, 'moBanPresetUnknown', { preset: mo.buildingsBanSid })
    }
    if (typeof mo.guardChance === 'number' && (mo.guardChance < 0 || mo.guardChance > 1)) {
      add('warning', 'zone', scope, `${mp}.guardChance`, 'moGuardChanceRange', { value: mo.guardChance })
    }
    if (typeof mo.guardValue === 'number' && mo.guardValue < 0) {
      add('info', 'zone', scope, `${mp}.guardValue`, 'moNegativeGuardValue')
    }
    if (mo.faction && !['Match', 'FromList'].includes(mo.faction.type)) {
      add('error', 'zone', scope, `${mp}.faction.type`, 'moFactionTypeUnknown', { type: mo.faction.type })
    }
    if (mo.faction && mo.faction.type === 'Match') {
      checkZoneRef(String(mo.faction.args?.[1] ?? ''), `${mp}.faction.args`, 'zoneRefFactionMatch')
    }
    if (mo.faction && mo.faction.type === 'FromList') {
      for (const a of mo.faction.args ?? []) {
        const target = parseDifferentFrom(String(a))
        if (target) checkZoneRef(target, `${mp}.faction.args`, 'zoneRefFactionDifferentFrom')
      }
    }
    if (mo.placement === 'NearZone') {
      checkZoneRef(String(mo.placementArgs?.[0] ?? ''), `${mp}.placementArgs`, 'zoneRefNearZone')
    }
    if (mo.placement === 'Connection') {
      const target = mo.placementArgs?.[0]
      if (target && !connSet.has(target)) {
        add('warning', 'zone', scope, `${mp}.placementArgs`, 'moPlacementConnectionMissing', { connection: target })
      }
    }
  })

  const randomHireChecks: Array<[
    'randomHireInitialUnitIncrement' | 'randomHireEnableWeeklyUnitIncrement',
    IssueCode,
  ]> = [
    ['randomHireInitialUnitIncrement', 'randomHireInitialUnitIncrementLength'],
    ['randomHireEnableWeeklyUnitIncrement', 'randomHireEnableWeeklyUnitIncrementLength'],
  ]
  for (const [key, code] of randomHireChecks) {
    const arr = z[key]
    if (!Array.isArray(arr)) continue
    if (arr.length !== 7) {
      add('warning', 'zone', scope, `${p}.${key}`, code, { length: arr.length })
    }
  }

  // guardReactionDistribution — 6 «ярусов» реакции стражей; семантика ярусов неизвестна
  // (гипотеза) — проверяется только форма, всегда warning.
  const grd: unknown = z.guardReactionDistribution
  if (grd !== undefined) {
    const gp = `${p}.guardReactionDistribution`
    if (!Array.isArray(grd)) {
      add('warning', 'zone', scope, gp, 'grdNotArray')
    } else {
      if (grd.length !== 6) {
        add('warning', 'zone', scope, gp, 'grdLength', { length: grd.length })
      }
      if (!grd.every((n) => typeof n === 'number' && Number.isFinite(n))) {
        add('warning', 'zone', scope, gp, 'grdNotNumbers')
      }
    }
  }

  const ehs = z.encounterHolesSettings
  if (isObj(ehs)) {
    const hol = template.gameRules && template.gameRules.encounterHoles
    const rpath = `${p}.encounterHolesSettings`
    if (hol !== true) {
      add('info', 'zone', scope, rpath, 'ehsIgnored')
    }
    for (const k of ['affectedEncounters', 'twoHoleEncounters'] as const) {
      const v = ehs[k]
      if (typeof v === 'number' && (v < 0 || v > 1)) {
        add('warning', 'zone', scope, `${rpath}.${k}`, 'ehsShareRange', { field: k, value: v })
      }
    }
  }

  const zoneMc = Array.isArray(z.mandatoryContent) ? z.mandatoryContent : []
  if (zoneMc.length === 0) {
    add('warning', 'zone', scope, `${p}.mandatoryContent`, 'zoneNoMc')
  }
  for (const g of zoneMc) {
    if (typeof g === 'string' && !ctx.mcGroups.includes(g)) {
      add('warning', 'zone', scope, `${p}.mandatoryContent`, 'zoneMcGroupMissing', { group: g })
      continue
    }
    checkMcGroupRules(template, g, scope, p, connSet, add)
  }

  const zcc = z.contentCountLimits
  if (typeof zcc === 'string') {
    add('warning', 'zone', scope, `${p}.contentCountLimits`, 'zoneCclStringAnomaly')
  } else if (Array.isArray(zcc)) {
    if (zcc.length === 0) add('warning', 'zone', scope, `${p}.contentCountLimits`, 'zoneCclEmpty')
    for (const g of zcc) {
      if (typeof g === 'string' && !ctx.ccGroups.includes(g)) {
        add('warning', 'zone', scope, `${p}.contentCountLimits`, 'zoneCclGroupMissing', { group: g })
      }
    }
  }

  if (ctx.poolNames && ctx.poolNames.size > 0) {
    for (const pfield of ['guardedContentPool', 'unguardedContentPool', 'resourcesContentPool'] as const) {
      const list = z[pfield]
      if (!Array.isArray(list)) continue
      for (const pn of list) {
        if (pn && !ctx.poolNames.has(pn)) {
          add('warning', 'zone', scope, `${p}.${pfield}`, 'zonePoolUnknown', { pool: pn, total: ctx.poolNames.size })
        }
      }
    }
  }

  const roads = Array.isArray(z.roads) ? z.roads : []
  roads.forEach((r, ri) => {
    validateRoad(r, ri, z, vi, zi, connSet, ctx.mcItemNames, add)
  })
}

function checkMcGroupRules(
  template: RmgTemplate,
  groupName: string,
  scope: IssueScope,
  p: string,
  connSet: Set<string>,
  add: Push,
): void {
  const group = (template.mandatoryContent ?? []).find(
    (g) => isObj(g) && g.name === groupName,
  )
  if (!isObj(group)) return
  const content = Array.isArray(group.content) ? group.content : []
  for (const item of content) {
    if (!isObj(item)) continue
    const rules = Array.isArray(item.rules) ? item.rules : []
    for (const rule of rules) {
      if (!isObj(rule)) continue
      if (String(rule.type) === 'Connection') {
        const arg = Array.isArray(rule.args) ? String(rule.args[0]) : undefined
        if (arg && !connSet.has(arg)) {
          add('warning', 'zone', scope, `${p}.mandatoryContent.rules`, 'mcGroupRuleConnectionMissing', {
            group: groupName,
            connection: arg,
          })
        }
      }
      if (typeof rule.targetMin === 'number' && (rule.targetMin < 0 || rule.targetMin > 0.9)) {
        add('warning', 'zone', scope, `${p}.mandatoryContent.rules`, 'mcGroupRuleTargetMin', {
          value: rule.targetMin,
          group: groupName,
        })
      }
      if (typeof rule.targetMax === 'number' && (rule.targetMax < 0 || rule.targetMax > 2)) {
        add('warning', 'zone', scope, `${p}.mandatoryContent.rules`, 'mcGroupRuleTargetMax', {
          value: rule.targetMax,
          group: groupName,
        })
      }
      if (typeof rule.weight === 'number' && (rule.weight < 0 || rule.weight > 10)) {
        add('warning', 'zone', scope, `${p}.mandatoryContent.rules`, 'mcGroupRuleWeight', {
          value: rule.weight,
          group: groupName,
        })
      }
    }
  }
}

function validateRoad(
  r: Road,
  ri: number,
  z: Zone,
  vi: number,
  zi: number,
  connSet: Set<string>,
  mcItemNames: Set<string>,
  add: Push,
): void {
  const p = `variants[${vi}].zones[${zi}].roads[${ri}]`
  const rscope: IssueScope = {
    code: 'road',
    params: { variant: vi + 1, zone: z.name || '?', road: ri + 1 },
  }
  if (r.type && r.type !== 'Stone' && r.type !== 'Dirt') {
    add('warning', 'road', rscope, `${p}.type`, 'roadTypeUnknown', { type: r.type })
  }
  if (JSON.stringify(r.from) === JSON.stringify(r.to)) {
    add('warning', 'road', rscope, `${p}`, 'roadSelfLoop')
  }
  checkRoadEnd(r.from, 'from', rscope, p, z, connSet, mcItemNames, add)
  checkRoadEnd(r.to, 'to', rscope, p, z, connSet, mcItemNames, add)
}

function checkRoadEnd(
  end: Road['from'],
  label: string,
  scope: IssueScope,
  p: string,
  z: Zone,
  connSet: Set<string>,
  mcItemNames: Set<string>,
  add: Push,
): void {
  if (!isObj(end)) {
    add('error', 'road', scope, `${p}.${label}`, 'roadEndNotObject')
    return
  }
  const t = String(end.type)
  const args = Array.isArray(end.args) ? end.args.map(String) : []
  if (t === 'MainObject') {
    const idx = Number(args[0])
    const max = (z.mainObjects ?? []).length - 1
    if (args.length === 0 || !Number.isInteger(idx) || idx < 0) {
      add('error', 'road', scope, `${p}.${label}`, 'roadEndMainObjectNoIndex')
    } else if (idx > max) {
      add('error', 'road', scope, `${p}.${label}`, 'roadEndMainObjectOutOfRange', { index: idx, max })
    }
  } else if (t === 'Connection') {
    if (args[0] && !connSet.has(args[0])) {
      add('error', 'road', scope, `${p}.${label}`, 'roadEndConnectionMissing', { connection: args[0] })
    }
  } else if (t === 'MandatoryContent') {
    if (args[0] && !mcItemNames.has(args[0])) {
      add('error', 'road', scope, `${p}.${label}`, 'roadEndMcMissing', { object: args[0] })
    }
  } else if (t === 'Crossroads') {
    if (args.length > 0) add('info', 'road', scope, `${p}.${label}`, 'roadEndCrossroadsExtraArgs')
  } else {
    add('warning', 'road', scope, `${p}.${label}`, 'roadEndTypeUnknown', { type: t })
  }
}

function validateOrientation(
  orientation: Variant['orientation'],
  zoneNames: string[],
  vscope: IssueScope,
  vi: number,
  add: Push,
): void {
  if (!isObj(orientation)) return
  const p = `variants[${vi}].orientation`

  const rawMode = orientation.mode
  if (rawMode !== undefined && rawMode !== 'MinimalBoundingSquare' && rawMode !== 'BoundingCircle') {
    add('warning', 'variant', vscope, `${p}.mode`, 'orientationModeUnknown', { mode: String(rawMode) })
  }

  const minA = orientation.baseAngleMin
  const maxA = orientation.baseAngleMax
  if (typeof minA === 'number' && typeof maxA === 'number' && minA > maxA) {
    add('warning', 'variant', vscope, `${p}.baseAngleMin/baseAngleMax`, 'orientationAngleMinMax', {
      min: minA,
      max: maxA,
    })
  }
  if (typeof minA === 'number' && (minA < 0 || minA > 360)) {
    add('warning', 'variant', vscope, `${p}.baseAngleMin`, 'orientationBaseAngleMinRange', { value: minA })
  }
  if (typeof maxA === 'number' && (maxA < 0 || maxA > 360)) {
    add('warning', 'variant', vscope, `${p}.baseAngleMax`, 'orientationBaseAngleMaxRange', { value: maxA })
  }
  if (typeof orientation.randomAngleAmplitude === 'number' && (orientation.randomAngleAmplitude < 0 || orientation.randomAngleAmplitude > 360)) {
    add('warning', 'variant', vscope, `${p}.randomAngleAmplitude`, 'orientationRandomAmplitudeRange', {
      value: orientation.randomAngleAmplitude,
    })
  }
  if (typeof orientation.randomAngleStep === 'number' && (orientation.randomAngleStep < 0 || orientation.randomAngleStep > 180)) {
    add('warning', 'variant', vscope, `${p}.randomAngleStep`, 'orientationRandomStepRange', {
      value: orientation.randomAngleStep,
    })
  }

  const zaz = orientation.zeroAngleZone
  if (typeof zaz === 'string' && zaz && !zoneNames.includes(zaz)) {
    add('warning', 'variant', vscope, `${p}.zeroAngleZone`, 'orientationZeroAngleZoneMissing', { zone: zaz })
  }
}

function validateBorder(
  border: Variant['border'],
  vscope: IssueScope,
  vi: number,
  add: Push,
): void {
  if (!isObj(border)) return
  const p = `variants[${vi}].border`

  const cornerRadius = border.cornerRadius
  if (typeof cornerRadius === 'number' && (cornerRadius < 0 || cornerRadius > 0.8)) {
    add('warning', 'variant', vscope, `${p}.cornerRadius`, 'borderCornerRadiusRange', { value: cornerRadius })
  }
  const obstaclesWidth = border.obstaclesWidth
  if (typeof obstaclesWidth === 'number' && (obstaclesWidth < 2 || obstaclesWidth > 6)) {
    add('warning', 'variant', vscope, `${p}.obstaclesWidth`, 'borderObstaclesWidthRange', { value: obstaclesWidth })
  }
  const waterWidth = border.waterWidth
  if (typeof waterWidth === 'number' && (waterWidth < 0 || waterWidth > 6)) {
    add('warning', 'variant', vscope, `${p}.waterWidth`, 'borderWaterWidthRange', { value: waterWidth })
  }
  if (typeof border.waterType === 'string' && border.waterType && border.waterType !== 'water grass') {
    add('info', 'variant', vscope, `${p}.waterType`, 'borderWaterTypeNonstandard', { value: border.waterType })
  }

  for (const key of ['obstaclesNoise', 'waterNoise'] as const) {
    const arr = border[key]
    if (!Array.isArray(arr)) continue
    for (let i = 0; i < arr.length; i++) {
      const n = arr[i]
      if (!isObj(n)) continue
      const np = `${p}.${key}[${i}]`
      if (typeof n.amp === 'number' && (n.amp < 0.5 || n.amp > 2)) {
        add('warning', 'variant', vscope, `${np}.amp`, 'borderNoiseAmpRange', { value: n.amp })
      }
      if (typeof n.freq === 'number' && (n.freq < 1 || n.freq > 12)) {
        add('warning', 'variant', vscope, `${np}.freq`, 'borderNoiseFreqRange', { value: n.freq })
      }
    }
  }
}

function zoneScopeOf(vi: number, z: Zone | undefined): IssueScope {
  const name = z && z.name ? z.name : '?'
  return { code: 'zone', params: { variant: vi + 1, zone: name } }
}
