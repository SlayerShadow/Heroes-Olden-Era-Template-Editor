import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type {
  AmbientPickupDistribution,
  BiomeSelectorType,
  Connection,
  ConnectionType,
  FactionSelector,
  GameRules,
  MainObjectType,
  OrientationMode,
  Placement,
  RmgTemplate,
  RoadEndpointType,
  RoadSurface,
  Zone,
  ZoneLayout,
} from '../types/rmg'
import { sampleTemplate } from '../data/sampleTemplate'
import { parseDifferentFrom, validateTemplate, type IssueCode, type IssueScope, type Severity, type ValidationIssue, type ValidationReport } from './validate'

const ETALON_PATH = new URL('../../export/JebusCross.rmg.json', import.meta.url)

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, '')
}

function loadEtalon(): RmgTemplate {
  return JSON.parse(stripBom(readFileSync(ETALON_PATH, 'utf8'))) as RmgTemplate
}

/** Значение, заведомо нарушающее формат, — валидатор обязан его поймать. */
function corrupt<T>(v: unknown): T {
  return v as T
}

/** Соответствие scope-строки и scope-параметров issue (для variant допустима форма «V1»). */
function scopeMatches(scope: IssueScope, want: string): boolean {
  if (!scope.params) return false
  return Object.values(scope.params).some((v) => String(v) === want || `V${v}` === want)
}

function findIssue(
  report: ValidationReport,
  sev: Severity,
  code: IssueCode,
  scope?: string,
): ValidationIssue | undefined {
  return report.issues.find(
    (i) =>
      i.severity === sev &&
      i.code === code &&
      (scope === undefined || scope === '' || scopeMatches(i.scope, scope)),
  )
}

function expectIssue(
  report: ValidationReport,
  sev: Severity,
  code: IssueCode,
  scope?: string,
): void {
  const issue = findIssue(report, sev, code, scope)
  expect(issue, `ожидалось issue [${sev}] ${code}${scope ? ` у «${scope}»` : ''}`).toBeDefined()
  if (issue) expect(issue).toMatchObject({ severity: sev })
}

/** Минимальный корректный шаблон — база для гранулярных мутаций. */
function baseTemplate(): RmgTemplate {
  return {
    name: 'Test',
    gameMode: 'Classic',
    sizeX: 128,
    sizeZ: 128,
    variants: [
      {
        orientation: { mode: 'BoundingCircle', baseAngleMin: 0, baseAngleMax: 0 },
        border: {},
        zones: [
          {
            name: 'ZoneA',
            size: 0.5,
            layout: 'layout_center',
            mainObjects: [],
            zoneBiome: { type: 'FromList', args: [] },
            contentBiome: { type: 'FromList', args: [] },
            metaObjectsBiome: { type: 'FromList', args: [] },
            roads: [],
            mandatoryContent: ['mc_group'],
            contentCountLimits: ['cc_group'],
          },
          {
            name: 'ZoneB',
            size: 0.5,
            layout: 'layout_center',
            mainObjects: [],
            zoneBiome: { type: 'FromList', args: [] },
            contentBiome: { type: 'FromList', args: [] },
            metaObjectsBiome: { type: 'FromList', args: [] },
            roads: [],
            mandatoryContent: ['mc_group'],
            contentCountLimits: ['cc_group'],
          },
        ],
        connections: [
          { name: 'ZoneA-ZoneB', from: 'ZoneA', to: 'ZoneB', connectionType: 'Direct', guardValue: 1000 },
        ],
      },
    ],
    zoneLayouts: [
      {
        // Полный лэйаут: все 8 обязательных ключей (иначе сработает layoutRequiredMissing).
        name: 'layout_center',
        obstaclesFill: 0.36,
        obstaclesFillVoid: 0.36,
        lakesFill: 0.3,
        elevationClusterScale: 0.16,
        roadClusterArea: 80,
        guardedEncounterResourceFractions: { countBounds: [], fractions: [0.5] },
        ambientPickupDistribution: { repulsion: 1, noise: 0.3, roadAttraction: -0.3, obstacleAttraction: 0, groupSizeWeights: [20, 2, 1] },
      },
    ],
    mandatoryContent: [{ name: 'mc_group', content: [{ sid: 'town_hall' }] }],
    contentCountLimits: [{ name: 'cc_group', limits: [{ maxCount: 3, sid: 'town_hall' }] }],
    valueOverrides: [],
    // Полные gameRules: все 6 обязательных полей (иначе сработает gameRulesRequiredMissing).
    gameRules: {
      heroCountMin: 0,
      heroCountMax: 10,
      heroCountIncrement: 0,
      heroHireBan: false,
      encounterHoles: false,
      winConditions: { classic: true },
    },
    globalBans: {},
    contentPools: [],
    contentLists: [],
  }
}

// Эталонный шаблон в репозиторий не входит: локально, где файл есть, гоняется
// полный набор; в CI (без файла) оба эталонных теста скипаются.
describe.skipIf(!existsSync(ETALON_PATH))('validateTemplate: эталон JebusCross (порог для регрессий)', () => {
  it('эталон JebusCross — 0 ошибок/предупреждений/инфо', () => {
    const r = validateTemplate(loadEtalon())
    expect({ errors: r.errors, warnings: r.warnings, infos: r.infos }).toEqual({ errors: 0, warnings: 0, infos: 0 })
    expect(r.issues).toEqual([])
  })

  it('испорченный шаблон из scripts/check_root_validate.mjs — новые проверки срабатывают', () => {
    const bad = structuredClone(loadEtalon()) as RmgTemplate
    bad.valueOverrides?.push({ sid: '', variant: -2, guardValue: -500 }, { sid: 'point_of_balance', variant: 0, guardValue: 100 })
    bad.gameRules = {
      ...bad.gameRules,
      heroCountMin: 9,
      heroCountMax: 4,
      heroHireBan: true,
      bonuses: [{ sid: '', receiverSide: 3, parameters: [] }],
    }
    bad.globalBans = { magics: ['a', 'b', 'a'], items: ['x', 'x'] }
    if (bad.zoneLayouts && bad.zoneLayouts[0]) bad.zoneLayouts[0].name = ''
    if (bad.zoneLayouts?.[1]) bad.zoneLayouts.push({ name: bad.zoneLayouts[1].name })
    bad.gameRules.winConditions = {
      ...bad.gameRules.winConditions,
      desertionDay: 3,
      desertion: false,
      tournament: true,
      tournamentDays: [4, 4],
      tournamentAnnounceDays: [3],
    }

    const r = validateTemplate(bad)
    expect({ errors: r.errors, warnings: r.warnings, infos: r.infos }).toEqual({ errors: 1, warnings: 9, infos: 7 })

    expectIssue(r, 'warning', 'overrideNoSid')
    expectIssue(r, 'warning', 'overrideVariantRange')
    expectIssue(r, 'info', 'overrideNegativeGuardValue')
    expectIssue(r, 'info', 'overrideDuplicate')
    expectIssue(r, 'info', 'bansDuplicates')
    expectIssue(r, 'warning', 'heroCountMinMax')
    expectIssue(r, 'warning', 'gameRulesValueOutOfRange')
    expectIssue(r, 'info', 'heroHireBanConflict')
    expectIssue(r, 'warning', 'bonusNoSid')
    expectIssue(r, 'info', 'bonusReceiverSide')
    expectIssue(r, 'info', 'desertionDayWithoutDesertion')
    expectIssue(r, 'warning', 'tournamentDaysLength')
    expectIssue(r, 'error', 'layoutNoName')
    expectIssue(r, 'warning', 'layoutDupNames')
    // добитый лэйаут { name } без параметров — обязательные поля отсутствуют
    expectIssue(r, 'warning', 'layoutRequiredMissing')
  })
})

describe('validateTemplate: сэмпл редактора', () => {
  it('sampleTemplate редактора — 0 ошибок, 9 предупреждений (пустые группы + gameRules)', () => {
    const r = validateTemplate(structuredClone(sampleTemplate))
    expect(r.errors).toBe(0)
    expect(r.warnings).toBe(9)
    expect(r.infos).toBe(0)
    for (const name of ['group_spawn', 'group_center', 'group_treasure', 'group_supertreasure']) {
      expectIssue(r, 'warning', 'mcGroupEmpty', name)
    }
    for (const name of ['content_limits_spawn', 'content_limits_center', 'content_limits_treasure', 'content_limits_supertreasure']) {
      expectIssue(r, 'warning', 'ccGroupEmpty', name)
    }
    // У сэмпла намеренно gameRules: {} (демо-шаблон) — валидатор отмечает
    // отсутствие шести обязательных полей предупреждением, не ошибкой.
    expectIssue(r, 'warning', 'gameRulesRequiredMissing')
  })
})

describe('root: zoneLayouts — обязательные поля (layoutRequiredMissing)', () => {
  const fullLayout = (): ZoneLayout => ({
    name: 'layout_center',
    obstaclesFill: 0.36,
    obstaclesFillVoid: 0.36,
    lakesFill: 0.3,
    elevationClusterScale: 0.16,
    roadClusterArea: 80,
    guardedEncounterResourceFractions: { countBounds: [], fractions: [0.5] },
    ambientPickupDistribution: { repulsion: 1, noise: 0.3, roadAttraction: -0.3, obstacleAttraction: 0, groupSizeWeights: [20, 2, 1] },
  })

  it('полный лэйаут — предупреждения нет', () => {
    const t = baseTemplate()
    t.zoneLayouts = [fullLayout()]
    expect(validateTemplate(t).issues.filter((i) => i.code === 'layoutRequiredMissing')).toEqual([])
  })

  it('лэйаут только с именем — предупреждение со списком всех отсутствующих полей', () => {
    const t = baseTemplate()
    t.zoneLayouts = [{ name: 'layout_center' }]
    const issue = validateTemplate(t).issues.find((i) => i.code === 'layoutRequiredMissing')
    expect(issue?.severity).toBe('warning')
    expect(issue?.params?.fields).toBe(
      'obstaclesFill, obstaclesFillVoid, lakesFill, elevationClusterScale, roadClusterArea, guardedEncounterResourceFractions, ambientPickupDistribution',
    )
  })

  it('частичные потери: числовое поле, пустые fractions, подобъект ambient', () => {
    const t = baseTemplate()
    const l = fullLayout()
    delete l.obstaclesFill
    l.guardedEncounterResourceFractions = { countBounds: [], fractions: [] }
    corrupt<Partial<AmbientPickupDistribution>>(l.ambientPickupDistribution).repulsion = undefined
    t.zoneLayouts = [l]
    const issue = validateTemplate(t).issues.find((i) => i.code === 'layoutRequiredMissing')
    expect(issue?.params?.fields).toBe('obstaclesFill, guardedEncounterResourceFractions.fractions, ambientPickupDistribution.repulsion')
  })
})

describe('root: gameRules — обязательные поля (gameRulesRequiredMissing)', () => {
  const fullRules = (): GameRules => ({
    heroCountMin: 0,
    heroCountMax: 10,
    heroCountIncrement: 0,
    heroHireBan: false,
    encounterHoles: false,
    winConditions: { classic: true },
  })

  it('полные gameRules — предупреждения нет', () => {
    const t = baseTemplate()
    t.gameRules = fullRules()
    expect(validateTemplate(t).issues.filter((i) => i.code === 'gameRulesRequiredMissing')).toEqual([])
  })

  it('пустые gameRules — предупреждение со списком всех полей', () => {
    const t = baseTemplate()
    t.gameRules = {}
    const issue = validateTemplate(t).issues.find((i) => i.code === 'gameRulesRequiredMissing')
    expect(issue?.severity).toBe('warning')
    expect(issue?.params?.fields).toBe('heroCountMin, heroCountMax, heroCountIncrement, heroHireBan, encounterHoles, winConditions')
  })

  it('частичная потеря: нет heroCountIncrement', () => {
    const t = baseTemplate()
    const g = fullRules()
    delete g.heroCountIncrement
    t.gameRules = g
    const issue = validateTemplate(t).issues.find((i) => i.code === 'gameRulesRequiredMissing')
    expect(issue?.params?.fields).toBe('heroCountIncrement')
  })

  it('значение не того типа считается отсутствием', () => {
    const t = baseTemplate()
    t.gameRules = corrupt<GameRules>({
      heroCountMin: '2',
      heroCountMax: 10,
      heroCountIncrement: 0,
      heroHireBan: 'no',
      encounterHoles: false,
      winConditions: { classic: true },
    })
    const issue = validateTemplate(t).issues.find((i) => i.code === 'gameRulesRequiredMissing')
    expect(issue?.params?.fields).toBe('heroCountMin, heroHireBan')
  })

  it('gameRules вовсе нет — предупреждение про раздел целиком', () => {
    const t = baseTemplate()
    delete t.gameRules
    const issue = validateTemplate(t).issues.find((i) => i.code === 'gameRulesRequiredMissing')
    expect(issue?.severity).toBe('warning')
    expect(issue?.params?.fields).toBe('gameRules')
  })
})

describe('root: gameRules — диапазоны значений (gameRulesValueOutOfRange)', () => {
  const fullRules = (): GameRules => ({
    heroCountMin: 0,
    heroCountMax: 10,
    heroCountIncrement: 0,
    heroHireBan: false,
    encounterHoles: false,
    winConditions: { classic: true },
  })
  const rangeIssue = (t: RmgTemplate) =>
    validateTemplate(t).issues.find((i) => i.code === 'gameRulesValueOutOfRange')

  it('верхние границы диапазонов (6/10/2) — предупреждения нет', () => {
    const t = baseTemplate()
    t.gameRules = { ...fullRules(), heroCountMin: 6, heroCountIncrement: 2 }
    expect(rangeIssue(t)).toBeUndefined()
  })

  it('нижние границы диапазонов (0/1/0) — предупреждения нет', () => {
    const t = baseTemplate()
    t.gameRules = { ...fullRules(), heroCountMax: 1 }
    expect(rangeIssue(t)).toBeUndefined()
  })

  it('значение вне диапазона — warning с полем, значением и диапазоном', () => {
    const t = baseTemplate()
    t.gameRules = { ...fullRules(), heroCountMin: 99 }
    const issue = rangeIssue(t)
    expect(issue?.severity).toBe('warning')
    expect(issue?.params?.fields).toBe('heroCountMin: 99 (0–6)')
  })

  it('несколько значений вне диапазонов — агрегируется в одно предупреждение', () => {
    const t = baseTemplate()
    t.gameRules = { ...fullRules(), heroCountMax: 0, heroCountIncrement: 5 }
    expect(rangeIssue(t)?.params?.fields).toBe('heroCountMax: 0 (1–10); heroCountIncrement: 5 (0–2)')
  })

  it('нечисловое значение диапазонами не проверяется (это gameRulesRequiredMissing)', () => {
    const t = baseTemplate()
    t.gameRules = corrupt<GameRules>({ ...fullRules(), heroCountMin: '7' })
    expect(rangeIssue(t)).toBeUndefined()
    const missing = validateTemplate(t).issues.find((i) => i.code === 'gameRulesRequiredMissing')
    expect(missing?.params?.fields).toBe('heroCountMin')
  })
})

describe('parseDifferentFrom', () => {
  it('возвращает имя зоны из выражения', () => {
    expect(parseDifferentFrom('differentFrom: ZoneA')).toBe('ZoneA')
    expect(parseDifferentFrom('differentFrom: 3 ZoneA')).toBe('ZoneA')
    expect(parseDifferentFrom('differentFrom:  7 Treasure-2 ')).toBe('Treasure-2 ')
  })

  it('возвращает undefined для не-разбора', () => {
    expect(parseDifferentFrom('')).toBeUndefined()
    expect(parseDifferentFrom('differentFrom:')).toBeUndefined()
    expect(parseDifferentFrom('xyz')).toBeUndefined()
    expect(parseDifferentFrom(undefined as unknown as string)).toBeUndefined()
  })
})

describe('root: базовые поля', () => {
  it('пустое имя шаблона — ошибка', () => {
    const t = baseTemplate()
    t.name = ''
    expectIssue(validateTemplate(t), 'error', 'nameEmpty')
  })

  it('неизвестный gameMode — ошибка', () => {
    const t = baseTemplate()
    t.gameMode = corrupt('Anarchy')
    expectIssue(validateTemplate(t), 'error', 'gameModeUnknown')
  })

  it('пустая строка в gameMode — тоже ошибка (раньше falsy-условие её пропускало)', () => {
    const t = baseTemplate()
    t.gameMode = corrupt('')
    expectIssue(validateTemplate(t), 'error', 'gameModeUnknown')
  })

  it('неквадратная карта — warning', () => {
    const t = baseTemplate()
    t.sizeX = 128
    t.sizeZ = 160
    expectIssue(validateTemplate(t), 'warning', 'sizeNotSquare')
  })

  it('размеры не кратны 16 — warning', () => {
    const t = baseTemplate()
    t.sizeX = 130
    t.sizeZ = 128
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'sizeNotMultiple16')
    expectIssue(r, 'warning', 'sizeNotSquare')
  })

  it('размер вне диапазона 80–240 — warning', () => {
    const t = baseTemplate()
    t.sizeX = 64
    t.sizeZ = 64
    expectIssue(validateTemplate(t), 'warning', 'sizeOutOfRange')
  })

  it('нет вариантов — ошибка', () => {
    const t = baseTemplate()
    t.variants = []
    expectIssue(validateTemplate(t), 'error', 'noVariants')
  })

  it('инлайн-пулы/списки — info (legacy)', () => {
    const t = baseTemplate()
    t.contentPools = [{}]
    t.contentLists = [{}]
    const r = validateTemplate(t)
    expectIssue(r, 'info', 'inlinePoolsLegacy')
    expectIssue(r, 'info', 'inlineListsUnverified')
  })
})

describe('root: mandatoryContent и contentCountLimits', () => {
  it('дубли имён групп — warning', () => {
    const t = baseTemplate()
    t.mandatoryContent = [
      { name: 'g', content: [{ sid: 'a' }] },
      { name: 'g', content: [{ sid: 'b' }] },
    ]
    t.contentCountLimits = [
      { name: 'c', limits: [{ maxCount: 1 }] },
      { name: 'c', limits: [{ maxCount: 2 }] },
    ]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'mcGroupDupNames')
    expectIssue(r, 'warning', 'ccGroupDupNames')
  })

  it('нет групп обязательного контента / лимитов — warning', () => {
    const t = baseTemplate()
    t.mandatoryContent = []
    t.contentCountLimits = []
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'noMcGroups')
    expectIssue(r, 'warning', 'noCcGroups')
  })

  it('пустая группа MC и мёртвая запись — warning', () => {
    const t = baseTemplate()
    t.mandatoryContent = [
      { name: 'mc_group', content: [] },
      { name: 'dead', content: [{ includeLists: [] }] },
    ]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'mcGroupEmpty', 'mc_group')
    expectIssue(r, 'warning', 'mcItemDead', 'dead')
  })

  it('незнакомый type правила MC — warning; пустая группа лимитов — warning', () => {
    const t = baseTemplate()
    t.mandatoryContent = [{ name: 'mc_group', content: [{ sid: 'town_hall', rules: [{ type: 'Teleport' }] }] }]
    t.contentCountLimits = [{ name: 'cc_group', limits: [] }]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'mcRuleUnknownType', 'mc_group')
    expectIssue(r, 'warning', 'ccGroupEmpty', 'cc_group')
  })
})

describe('root: valueOverrides, globalBans, gameRules, zoneLayouts', () => {
  it('valueOverrides: sid пустой, variant < −1, минус guardValue, дубликат', () => {
    const t = baseTemplate()
    t.valueOverrides = [
      { sid: '', variant: 0, guardValue: 100 },
      { sid: 'x', variant: -3, guardValue: 500 },
      { sid: 'y', variant: 0, guardValue: -100 },
      { sid: 'z', variant: 1, guardValue: 50 },
      { sid: 'z', variant: 1, guardValue: 60 },
    ]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'overrideNoSid')
    expectIssue(r, 'warning', 'overrideVariantRange')
    expectIssue(r, 'info', 'overrideNegativeGuardValue')
    expectIssue(r, 'info', 'overrideDuplicate')
  })

  it('globalBans: дубли в списках', () => {
    const t = baseTemplate()
    t.globalBans = { magics: ['a', 'b', 'a'], items: ['x', 'x'], skills: ['s'], heroes: ['h'] }
    const r = validateTemplate(t)
    expectIssue(r, 'info', 'bansDuplicates')
  })

  it('gameRules: heroCountMin>Max, heroHireBan, бонусы, winConditions', () => {
    const t = baseTemplate()
    t.gameRules = {
      heroCountMin: 9,
      heroCountMax: 4,
      heroHireBan: true,
      bonuses: [{ sid: '', receiverSide: 3, parameters: [] }],
      winConditions: { desertionDay: 3, desertion: false, tournamentDays: [4, 4], tournamentAnnounceDays: [3] },
    }
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'heroCountMinMax')
    expectIssue(r, 'info', 'heroHireBanConflict')
    expectIssue(r, 'warning', 'bonusNoSid')
    expectIssue(r, 'info', 'bonusReceiverSide')
    expectIssue(r, 'info', 'desertionDayWithoutDesertion')
    expectIssue(r, 'warning', 'tournamentDaysLength')
  })

  it('zoneLayouts: пустое имя — ошибка, дубли имён — warning', () => {
    const t = baseTemplate()
    t.zoneLayouts = [{ name: '' }, { name: 'layout_center' }, { name: 'layout_center' }]
    const r = validateTemplate(t)
    expectIssue(r, 'error', 'layoutNoName')
    expectIssue(r, 'warning', 'layoutDupNames')
  })
})

describe('variant: зоны и ориентация', () => {
  it('нет зон в варианте — ошибка', () => {
    const t = baseTemplate()
    t.variants[0].zones = []
    expectIssue(validateTemplate(t), 'error', 'noZones')
  })

  it('дубли имён зон — ошибка', () => {
    const t = baseTemplate()
    t.variants[0].zones[1].name = 'ZoneA'
    expectIssue(validateTemplate(t), 'error', 'zoneDupNames')
  })

  it('orientation: неизвестный mode, baseAngleMin>Max, zeroAngleZone не зона', () => {
    const t = baseTemplate()
    t.variants[0].orientation = {
      mode: corrupt<OrientationMode>('Polygon'),
      baseAngleMin: 200,
      baseAngleMax: 100,
      randomAngleAmplitude: 720,
      randomAngleStep: 360,
      zeroAngleZone: 'Nope',
    }
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'orientationModeUnknown')
    expectIssue(r, 'warning', 'orientationAngleMinMax')
    expectIssue(r, 'warning', 'orientationRandomAmplitudeRange')
    expectIssue(r, 'warning', 'orientationRandomStepRange')
    expectIssue(r, 'warning', 'orientationZeroAngleZoneMissing')
  })

  it('orientation: пустая строка в mode — warning (раньше falsy-условие её пропускало)', () => {
    const t = baseTemplate()
    t.variants[0].orientation = { mode: corrupt<OrientationMode>('') }
    expectIssue(validateTemplate(t), 'warning', 'orientationModeUnknown')
  })

  it('border: диапазоны cornerRadius/obstaclesWidth/waterWidth/noise', () => {
    const t = baseTemplate()
    t.variants[0].border = {
      cornerRadius: 0.9,
      obstaclesWidth: 8,
      obstaclesNoise: [{ amp: 3, freq: 20 }],
      waterWidth: 9,
      waterNoise: [{ amp: 0.1, freq: 0.5 }],
      waterType: 'water abyss',
    }
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'borderCornerRadiusRange')
    expectIssue(r, 'warning', 'borderObstaclesWidthRange')
    expectIssue(r, 'warning', 'borderWaterWidthRange')
    expectIssue(r, 'warning', 'borderNoiseAmpRange')
    expectIssue(r, 'warning', 'borderNoiseFreqRange')
    expectIssue(r, 'info', 'borderWaterTypeNonstandard')
  })
})

describe('connection', () => {
  it('несуществующие from/to — ошибки', () => {
    const t = baseTemplate()
    t.variants[0].connections[0].from = 'Nope'
    t.variants[0].connections[0].to = 'AlsoNope'
    const r = validateTemplate(t)
    expectIssue(r, 'error', 'connFromMissing')
    expectIssue(r, 'error', 'connToMissing')
  })

  it('неизвестный connectionType (в т.ч. пустая строка) — warning', () => {
    const t = baseTemplate()
    t.variants[0].connections[0].connectionType = corrupt<ConnectionType>('')
    expectIssue(validateTemplate(t), 'warning', 'connTypeUnknown')

    const t2 = baseTemplate()
    t2.variants[0].connections[0].connectionType = corrupt<ConnectionType>('Teleport')
    expectIssue(validateTemplate(t2), 'warning', 'connTypeUnknown')
  })

  it('отрицательный guardValue — warning', () => {
    const t = baseTemplate()
    t.variants[0].connections[0].guardValue = -50
    expectIssue(validateTemplate(t), 'warning', 'connNegativeGuardValue')
  })

  it('Portal без gatePlacement — info; Proximity без length — info', () => {
    const t = baseTemplate()
    const portal: Connection = { name: 'p', from: 'ZoneA', to: 'ZoneB', connectionType: 'Portal' }
    const prox: Connection = { name: 'x', from: 'ZoneA', to: 'ZoneB', connectionType: 'Proximity' }
    t.variants[0].connections = [portal, prox]
    const r = validateTemplate(t)
    expectIssue(r, 'info', 'portalNoGatePlacement')
    expectIssue(r, 'info', 'proximityNoLength')
  })

  it('guardZone / gatePlacementArgs / gatePlacement — ссылки и enum', () => {
    const t = baseTemplate()
    t.variants[0].connections[0].guardZone = 'Nope'
    t.variants[0].connections[0].gatePlacement = 'NearZone'
    t.variants[0].connections[0].gatePlacementArgs = 'Nope'
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'connGuardZoneMissing')
    expectIssue(r, 'warning', 'connGateZoneMissing')

    const t2 = baseTemplate()
    t2.variants[0].connections[0].gatePlacement = 'Corner'
    expectIssue(validateTemplate(t2), 'warning', 'connGatePlacementUnknown')
  })

  it('portalPlacementRules: незнакомый type, целевые диапазоны', () => {
    const t = baseTemplate()
    const portal: Connection = {
      name: 'p',
      from: 'ZoneA',
      to: 'ZoneB',
      connectionType: 'Portal',
      gatePlacement: 'Center',
      portalPlacementRulesFrom: [
        { type: 'Spell', targetMin: 0.99, targetMax: 3, weight: 5 },
        { type: 'Crossroads', targetMin: 0.5, targetMax: 1 },
      ],
    }
    t.variants[0].connections = [portal]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'connGateRuleUnknownType')
    expectIssue(r, 'warning', 'connGateRuleTargetMin')
    expectIssue(r, 'warning', 'connGateRuleTargetMax')
    expectIssue(r, 'warning', 'connGateRuleWeight')
  })
})

describe('zone', () => {
  it('пустое имя зоны — ошибка', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].name = ''
    const r = validateTemplate(t)
    expect(r.errors).toBeGreaterThan(0)
    expectIssue(r, 'error', 'zoneNameEmpty', 'V1')
  })

  it('size ≤ 0 — ошибка; size вне 0.15–2 — warning', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].size = 0
    const r1 = validateTemplate(t)
    expectIssue(r1, 'error', 'zoneSizePositive', 'ZoneA')
    const t2 = baseTemplate()
    t2.variants[0].zones[0].size = 5
    expectIssue(validateTemplate(t2), 'warning', 'zoneSizeRange', 'ZoneA')
  })

  it('layout не объявлен — warning', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].layout = 'no_such_layout'
    expectIssue(validateTemplate(t), 'warning', 'zoneLayoutNotDeclared', 'ZoneA')
  })

  it('пустая строка в layout — тоже warning (раньше falsy-условие её пропускало)', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].layout = ''
    expectIssue(validateTemplate(t), 'warning', 'zoneLayoutNotDeclared', 'ZoneA')
  })

  it('бюджеты: и абсолютное, и PerArea — info (штатные шаблоны так делают); отрицательный бюджет — warning', () => {
    const t = baseTemplate()
    const z = t.variants[0].zones[0] as Zone & { guardedContentValue?: number }
    z.guardedContentValue = 10000
    z.guardedContentValuePerArea = 500
    z.resourcesValue = -5
    const r = validateTemplate(t)
    expectIssue(r, 'info', 'zoneBudgetBothAbsoluteAndPerArea', 'ZoneA')
    expectIssue(r, 'warning', 'zoneBudgetNegative', 'ZoneA')
  })

  it('биом-селекторы: незнакомый тип, MatchZone/MatchMainObject/differentFrom', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].zoneBiome = { type: corrupt<BiomeSelectorType>('Dice'), args: [] }
    t.variants[0].zones[0].contentBiome = { type: 'MatchZone', args: ['Nope'] }
    t.variants[0].zones[0].metaObjectsBiome = { type: 'MatchMainObject', args: ['0', 'Nope'] }
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'biomeSelectorUnknown', 'ZoneA')
    expectIssue(r, 'warning', 'zoneRefMatchZone', 'ZoneA')
    expectIssue(r, 'warning', 'zoneRefMatchMainObject', 'ZoneA')

    const t2 = baseTemplate()
    t2.variants[0].zones[0].zoneBiome = { type: 'FromList', args: ['differentFrom: Nope'] }
    expectIssue(validateTemplate(t2), 'warning', 'zoneRefDifferentFrom', 'ZoneA')
  })

  it('mainObjects: Spawn без spawn — ошибка; guardChance вне 0..1; faction', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].mainObjects = [
      { type: 'Spawn', placement: 'Center' },
      { type: 'City', placement: 'Center', guardChance: 1.5, guardValue: -10 },
      { type: corrupt<MainObjectType>('Mine'), placement: 'Center', faction: { type: corrupt<FactionSelector['type']>('Dice'), args: [] } },
      { type: 'City', placement: 'Center', faction: { type: 'Match', args: ['', 'Nope'] } },
      { type: 'City', placement: 'Center', faction: { type: 'FromList', args: ['differentFrom: Nope'] } },
      { type: 'City', placement: 'Center' },
    ]
    const r = validateTemplate(t)
    expectIssue(r, 'error', 'moSpawnWithoutPlayer', 'ZoneA')
    expectIssue(r, 'warning', 'moGuardChanceRange', 'ZoneA')
    expectIssue(r, 'info', 'moNegativeGuardValue', 'ZoneA')
    expectIssue(r, 'error', 'moFactionTypeUnknown', 'ZoneA')
    expectIssue(r, 'warning', 'zoneRefFactionMatch', 'ZoneA')
    expectIssue(r, 'warning', 'zoneRefFactionDifferentFrom', 'ZoneA')
  })

  it('mainObjects: неизвестный type/placement (в т.ч. пустая строка) — warning', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].mainObjects = [
      { type: corrupt<MainObjectType>(''), placement: corrupt<Placement>('') },
      { type: corrupt<MainObjectType>('Town'), placement: corrupt<Placement>('Ring') },
    ]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'moTypeUnknown', 'ZoneA')
    expectIssue(r, 'warning', 'moPlacementUnknown', 'ZoneA')
  })

  it('faction FromList с корректным differentFrom — без предупреждений', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].mainObjects = [
      { type: 'City', placement: 'Center', faction: { type: 'FromList', args: ['differentFrom: ZoneB'] } },
    ]
    expect(validateTemplate(t).warnings).toBe(0)
  })

  it('placement NearZone/Connection — ссылки на зону/связь', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].mainObjects = [
      { type: 'City', placement: 'NearZone', placementArgs: ['Nope'] },
      { type: 'City', placement: 'Connection', placementArgs: ['NoConn'] },
    ]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'zoneRefNearZone', 'ZoneA')
    expectIssue(r, 'warning', 'moPlacementConnectionMissing', 'ZoneA')
  })

  it('Spawn на нескольких зонах с одним игроком — ошибка', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].mainObjects = [{ type: 'Spawn', placement: 'Center', spawn: 'Player1', buildingsConstructionSid: 'x' }]
    t.variants[0].zones[1].mainObjects = [{ type: 'Spawn', placement: 'Center', spawn: 'Player1', buildingsConstructionSid: 'x' }]
    const r = validateTemplate(t)
    expect(r.errors).toBeGreaterThan(0)
    expectIssue(r, 'error', 'spawnAlreadyUsed', 'ZoneB')
  })

  it('randomHire: длина массива не 7 — warning', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].randomHireInitialUnitIncrement = [1, 2, 3]
    t.variants[0].zones[0].randomHireEnableWeeklyUnitIncrement = [true]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'randomHireInitialUnitIncrementLength', 'ZoneA')
    expectIssue(r, 'warning', 'randomHireEnableWeeklyUnitIncrementLength', 'ZoneA')
  })

  it('encounterHolesSettings при выключенном gameRules.encounterHoles — info; доли вне 0..1 — warning', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].encounterHolesSettings = { affectedEncounters: 1.5, twoHoleEncounters: -0.2 }
    const r = validateTemplate(t)
    expectIssue(r, 'info', 'ehsIgnored', 'ZoneA')
    expectIssue(r, 'warning', 'ehsShareRange', 'ZoneA')
    expectIssue(r, 'warning', 'ehsShareRange', 'ZoneA')
  })

  it('mandatoryContent: пустой список — warning; группа не найдена — warning', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].mandatoryContent = []
    t.variants[0].zones[1].mandatoryContent = ['nope_group']
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'zoneNoMc', 'ZoneA')
    expectIssue(r, 'warning', 'zoneMcGroupMissing', 'ZoneB')
  })

  it('contentCountLimits: строка-аномалия — warning; группа не найдена — warning', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].contentCountLimits = 'nope' as unknown as string[]
    t.variants[0].zones[1].contentCountLimits = ['nope_group']
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'zoneCclStringAnomaly', 'ZoneA')
    expectIssue(r, 'warning', 'zoneCclGroupMissing', 'ZoneB')
  })
})

describe('roads', () => {
  it('неизвестный тип дороги и дорога в себя — warnings', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].roads = [
      { type: corrupt<RoadSurface>('Gravel'), from: { type: 'MainObject', args: ['0'] }, to: { type: 'MainObject', args: ['0'] } },
    ]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'roadTypeUnknown')
    expectIssue(r, 'warning', 'roadSelfLoop')
  })

  it('MainObject-конец: без индекса и вне диапазона — ошибки', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].roads = [
      { type: 'Stone', from: { type: 'MainObject', args: [] }, to: { type: 'MainObject', args: ['5'] } },
    ]
    const r = validateTemplate(t)
    expectIssue(r, 'error', 'roadEndMainObjectNoIndex')
    expectIssue(r, 'error', 'roadEndMainObjectOutOfRange')
  })

  it('Connection-конец на несуществующую связь, MandatoryContent на несуществующий объект — ошибки', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].roads = [
      { type: 'Stone', from: { type: 'Connection', args: ['NoConn'] }, to: { type: 'MandatoryContent', args: ['NoObj'] } },
    ]
    const r = validateTemplate(t)
    expectIssue(r, 'error', 'roadEndConnectionMissing')
    expectIssue(r, 'error', 'roadEndMcMissing')
  })

  it('lifecycle: корректная дорога MainObject→Connection проходит без проблем', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].mainObjects = [
      { type: 'City', placement: 'Center', buildingsConstructionSid: 'x' },
    ]
    t.variants[0].zones[0].roads = [
      { type: 'Stone', from: { type: 'MainObject', args: ['0'] }, to: { type: 'Connection', args: ['ZoneA-ZoneB'] } },
    ]
    const r = validateTemplate(t)
    expect(r.errors).toBe(0)
  })

  it('неизвестный тип конца дороги — warning; Crossroads с лишними аргументами — info', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].roads = [
      { type: 'Stone', from: { type: corrupt<RoadEndpointType>('Teleport'), args: [] }, to: { type: 'Crossroads', args: ['1'] } },
    ]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'roadEndTypeUnknown')
    expectIssue(r, 'info', 'roadEndCrossroadsExtraArgs')
  })
})

describe('правила групп MC, на которые ссылаются зоны', () => {
  it('правило Connection ссылается на несуществующую связь — warning', () => {
    const t = baseTemplate()
    const mc = t.mandatoryContent![0]
    mc.content = [{ sid: 'cross', rules: [{ type: 'Connection', args: ['NoConn'] }] }]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'mcGroupRuleConnectionMissing', 'ZoneA')
  })

  it('целевые диапазоны правил MC (targetMin/Max, weight)', () => {
    const t = baseTemplate()
    const mc = t.mandatoryContent![0]
    mc.content = [
      { sid: 'town_hall', rules: [{ type: 'Road', targetMin: 0.95, targetMax: 3, weight: 15 }] },
    ]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'mcGroupRuleTargetMin', 'ZoneA')
    expectIssue(r, 'warning', 'mcGroupRuleTargetMax')
    expectIssue(r, 'warning', 'mcGroupRuleWeight', 'ZoneA')
  })
})

describe('validateTemplate: каталог пулов/списков (opts)', () => {
  it('неизвестные пулы зоны — warning со scope зоны; валидный пул — без проблем', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].guardedContentPool = ['template_pool_random_t2_item', 'no_such_pool']
    t.variants[0].zones[0].resourcesContentPool = ['content_pool_general_resources_treasure_zone_rich']
    const r = validateTemplate(t, { poolNames: ['template_pool_random_t2_item', 'content_pool_general_resources_treasure_zone_rich'] })
    expectIssue(r, 'warning', 'zonePoolUnknown', 'ZoneA')
    expect(validateTemplate(baseTemplate(), { poolNames: ['template_pool_random_t2_item'] }).warnings).toBe(0)
  })

  it('без opts или с пустым каталогом проверки пулов не выполняются', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].guardedContentPool = ['no_such_pool']
    expect(validateTemplate(t).warnings).toBe(0)
    expect(validateTemplate(t, { poolNames: [] }).warnings).toBe(0)
  })

  it('неизвестные includeLists в обязательном контенте и лимитах — warning', () => {
    const t = baseTemplate()
    t.mandatoryContent = [
      { name: 'mc_group', content: [{ sid: 'town_hall', includeLists: ['basic_content_list_pickup_random_items', 'no_such_list'] }] },
    ]
    t.contentCountLimits = [
      { name: 'cc_group', limits: [{ maxCount: 2, sid: 'town_hall', includeLists: ['also_missing'] }] },
    ]
    const r = validateTemplate(t, { listNames: ['basic_content_list_pickup_random_items'] })
    expectIssue(r, 'warning', 'listNotFound', 'mc_group')
    expectIssue(r, 'warning', 'listNotFound', 'cc_group')
  })
})

describe('validateTemplate: целостность guardMatchGroup', () => {
  it('связи одной группы с разными guardValue / guardWeeklyIncrement — warning', () => {
    const t = baseTemplate()
    t.variants[0].connections = [
      { name: 'c1', from: 'ZoneA', to: 'ZoneB', connectionType: 'Direct', guardValue: 5000, guardWeeklyIncrement: 0.1, guardMatchGroup: 'g1' },
      { name: 'c2', from: 'ZoneA', to: 'ZoneB', connectionType: 'Direct', guardValue: 7000, guardWeeklyIncrement: 0.2, guardMatchGroup: 'g1' },
    ]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'guardGroupFieldMismatch')
    expectIssue(r, 'warning', 'guardGroupFieldMismatch')
  })

  it('согласованная группа — без проблем; группа из одной связи — info', () => {
    const t = baseTemplate()
    t.variants[0].connections = [
      { name: 'c1', from: 'ZoneA', to: 'ZoneB', connectionType: 'Direct', guardValue: 5000, guardMatchGroup: 'g1' },
      { name: 'c2', from: 'ZoneA', to: 'ZoneB', connectionType: 'Direct', guardValue: 5000, guardMatchGroup: 'g1' },
      { name: 'solo', from: 'ZoneA', to: 'ZoneB', connectionType: 'Direct', guardValue: 100, guardMatchGroup: 'solo_g' },
    ]
    const r = validateTemplate(t)
    expect(r.warnings).toBe(0)
    expectIssue(r, 'info', 'guardGroupSingle')
  })
})

describe('validateTemplate: битые sid пресетов застройки', () => {
  it('неизвестный buildingsConstructionSid / buildingsBanSid — warning', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].mainObjects = [
      { type: 'City', placement: 'Center', buildingsConstructionSid: 'sprint_orange_buildings_construction' },
      { type: 'City', placement: 'Center', buildingsBanSid: 'no_such_ban' },
    ]
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'moConstructionPresetUnknown', 'ZoneA')
    expectIssue(r, 'warning', 'moBanPresetUnknown', 'ZoneA')
  })

  it('валидные пресеты из каталога — без предупреждений', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].mainObjects = [
      {
        type: 'City',
        placement: 'Center',
        buildingsConstructionSid: 'default_buildings_construction',
        buildingsBanSid: 'default_buildings_ban',
      },
    ]
    expect(validateTemplate(t).warnings).toBe(0)
  })
})

describe('валидатор: навигационные координаты issue', () => {
  it('zone-issue несёт variant+zoneId, connection-issue — variant+connectionId, root — без nav', () => {
    const bad = baseTemplate()
    bad.name = ''
    bad.variants[0].connections[0].from = 'Nope'
    bad.variants[0].zones[0].size = 0
    const r = validateTemplate(bad)
    const z = r.issues.find((i) => i.code === 'zoneSizePositive')
    expect(z).toMatchObject({ variant: 0, zoneId: 'ZoneA' })
    const c = r.issues.find((i) => i.code === 'connFromMissing')
    expect(c).toMatchObject({ variant: 0, connectionId: 'ZoneA-ZoneB' })
    const root = r.issues.find((i) => i.code === 'nameEmpty')
    expect(root?.variant).toBeUndefined()
    expect(root?.zoneId).toBeUndefined()
    expect(root?.connectionId).toBeUndefined()
  })

  it('road-issue несёт variant+zoneId владеющей зоны', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].roads = [
      { type: 'Stone', from: { type: 'Connection', args: ['NoConn'] }, to: { type: 'MainObject', args: ['0'] } },
    ]
    const r = validateTemplate(t)
    const road = r.issues.find((i) => i.code === 'roadEndConnectionMissing')
    expect(road).toMatchObject({ variant: 0, zoneId: 'ZoneA' })
  })
})

describe('неизвестная семантика полей — только warning, никогда error', () => {
  it('guardReactionDistribution: не массив / длина ≠ 6 / не-числа — warning', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].guardReactionDistribution = corrupt([1, 2, 3])
    t.variants[0].zones[1].guardReactionDistribution = corrupt('nope')
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'grdLength', 'ZoneA')
    expectIssue(r, 'warning', 'grdNotArray', 'ZoneB')
    expect(r.errors).toBe(0)
  })

  it('guardReactionDistribution: нечисловые значения — warning, не error', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].guardReactionDistribution = corrupt([1, 2, 3, 4, 5, 'x'])
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'grdNotNumbers', 'ZoneA')
    expect(r.errors).toBe(0)
  })

  it('guardReactionDistribution: валидные array[6] из чисел — без issues', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].guardReactionDistribution = [120, 60, 20, 10, 4, 0]
    const r = validateTemplate(t)
    expect(r.issues.filter((i) => i.path.includes('guardReactionDistribution'))).toEqual([])
  })

  it('tournamentRules: не boolean — warning, boolean — без issues', () => {
    const t = baseTemplate()
    t.gameRules = { ...t.gameRules, tournamentRules: corrupt(42) }
    const r = validateTemplate(t)
    expectIssue(r, 'warning', 'tournamentRulesNotBoolean')
    expect(r.errors).toBe(0)

    const t2 = baseTemplate()
    t2.gameRules = { ...t2.gameRules, tournamentRules: false }
    expect(validateTemplate(t2).issues.filter((i) => i.path.includes('tournamentRules'))).toEqual([])
  })

  it('инвариант: ни одна из этих проверок не даёт severity error', () => {
    const t = baseTemplate()
    t.variants[0].zones[0].guardReactionDistribution = corrupt([1])
    t.variants[0].zones[1].guardReactionDistribution = corrupt('nope')
    t.gameRules = { ...t.gameRules, tournamentRules: corrupt('yes') }
    t.variants[0].connections[0].guardValue = -50
    t.variants[0].zones[0].mainObjects = [corrupt({ type: 'City', placement: 'Center', guardValue: -10 })]
    t.valueOverrides = [{ sid: 'x', variant: 0, guardValue: -100 }]
    const r = validateTemplate(t)
    const paths = ['guardReactionDistribution', 'tournamentRules', 'guardValue']
    const related = r.issues.filter((i) => paths.some((s) => i.path.includes(s)))
    expect(related.length).toBeGreaterThanOrEqual(6)
    for (const issue of related) {
      expect(issue, `issue «${issue.code}» не должен быть error`).not.toMatchObject({ severity: 'error' })
    }
  })
})

describe('группы issues и счётчики', () => {
  it('пустой шаблон: ошибки в root', () => {
    const t = {} as RmgTemplate
    const r = validateTemplate(t)
    expect(r.errors).toBeGreaterThanOrEqual(2)
    expectIssue(r, 'error', 'nameEmpty')
    expectIssue(r, 'error', 'noVariants')
    for (const issue of r.issues) {
      expect(['root', 'variant', 'zone', 'connection', 'road']).toContain(issue.group)
    }
  })

  it('отчётные счётчики согласованы с issues', () => {
    const r = validateTemplate(baseTemplate())
    expect(r.errors).toBe(0)
    expect(r.warnings).toBe(0)
    expect(r.infos).toBe(0)
    expect(r.issues).toEqual([])
  })
})