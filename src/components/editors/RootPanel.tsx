import { useCallback, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../store/editorStore'
import { sidHint, sidNameLang, sidOptions, type SidNameLang } from '../../data/sidCatalog'
import { SID_NAMES_EN, SID_NAMES_RU } from '../../data/sidNames'
import type {
  AmbientPickupDistribution,
  Bonus,
  ElevationMode,
  GameMode,
  GameRules,
  GlobalBans,
  RmgTemplate,
  ValueOverride,
  WinConditions,
  ZoneLayout,
} from '../../types/rmg'
import { mergeRootJson, rootJsonView, validateRootDraft } from '../../utils/jsonEdit'
import { CommaList, ComboInput, Num, NumList, Section, Select, Text, TriSelect, type ComboSuggestion } from './fields'
import { JsonEditor } from './JsonEditor'
import { SidText } from './RootPanels'

// Условия победы (поле displayWinCondition) и режимы игры (gameMode).
// Значения — данные формата; имена и описания переводятся в UI
// (ключи root.wcNames.* / root.gameModes.*; оригинал — из официальной
// русской локализации игры: ui.json, sid win_condition_N_name/_desc).
const WIN_CONDITION_SIDS = [
  'win_condition_1',
  'win_condition_2',
  'win_condition_3',
  'win_condition_4',
  'win_condition_5',
  'win_condition_6',
]

const GAME_MODE_VALUES: GameMode[] = ['Classic', 'SingleHero']

// Подсказки бонусных sid переводятся в UI (ключи root.bonusHints.*). Основа —
// полный разбор параметров во всех 60 штатных шаблонах.
// receiverFilter бонусов: start_hero / all_heroes — подписи вариантов
// в root.bonusFilter.*.
const BONUS_SIDS = ['add_bonus_hero_spell', 'add_bonus_hero_stat', 'add_bonus_res', 'add_bonus_hero_unit_multipler', 'add_bonus_hero_item']
const BONUS_FILTER_VALUES = ['start_hero', 'all_heroes']

// Штатные формы parameters бонусов — полный разбор всех 60 штатных шаблонов.
// Ресурсы — id из core_db resources_info.json (русские имена —
// ui.json); заклинания — приключенческие из world_magic_cast_info (без
// служебных id); артефакты — sid с суффиксом _artifact (каталог sidNames.ts).
const BONUS_RESOURCES = ['gold', 'wood', 'ore', 'mercury', 'crystals', 'gemstones', 'alchemicalDust']
const WORLD_SPELL_SIDS = [
  'neutral_magic_town_portal',
  'neutral_magic_dimension_door',
  'neutral_magic_shadow_form',
  'neutral_magic_light_gate',
  'neutral_magic_second_sight',
  // «Карманное измерение»: в штатных globalBans.magics встречается ×3, но
  // cast-эффекта в world_magic_cast_info нет — та же ловушка, что с некромантией.
  'neutral_magic_pocket_dimension',
  // Некромантия: sid заклинания — change_use_necromancy («Воля некроманта»),
  // а neutral_magic_necromancy — лишь id cast-эффекта в world_magic_cast_info.
  'change_use_necromancy',
  'primal_17_magic_groundsight',
  'primal_18_magic_primordial_chaos',
  'space_17_magic_reinforcements',
  'space_18_magic_assemble',
  'day_17_magic_clear_view',
  'day_18_magic_farsight',
  'night_17_magic_read_minds',
  'night_18_magic_nairas_veil',
]
// Списки sid строятся по ключам каталога имён: ключи SID_NAMES_RU и SID_NAMES_EN
// совпадают (генератор читает один набор Lang-токенов; паритет фиксирует тест
// src/data/sidCatalog.test.ts), берём объединение — на случай расхождения локалей.
const NAME_SIDS = Array.from(new Set([...Object.keys(SID_NAMES_RU), ...Object.keys(SID_NAMES_EN)]))
const ARTIFACT_SIDS = NAME_SIDS.filter((s) => s.endsWith('_artifact'))
// Кандидаты globalBans: заклинания — тот же список, что для
// бонусов; предметы — все sid артефактов, включая составные свитки
// magic_scroll_artifact_*; навыки — skill_* без псевдонавыков; герои —
// имена вида <...>_hero_<номер> (фракционные, кампанийные, обучающие).
const BAN_ITEM_SIDS = NAME_SIDS.filter((s) => s.includes('_artifact'))
const BAN_SKILL_SIDS = NAME_SIDS.filter((s) => /^skill_(?!pseudo)/.test(s))
const BAN_HERO_SIDS = NAME_SIDS.filter((s) => /^(?:[a-z0-9]+_)*hero_\d+(?:_[a-z0-9]+)*$/.test(s))
// Виды первого аргумента add_bonus_hero_stat (единственные два в штатных).
const STAT_KIND_VALUES = ['movementBonus', 'magicCostSidSet']

// Каталог подсказок ComboInput: value — сырой sid, label — читаемое имя.
// Прежние модульные константы SPELL_OPTIONS/ARTIFACT_OPTIONS/BAN_*_OPTIONS
// вычислялись при импорте и замораживали язык — русские имена протекали в
// en-UI. Теперь списки строятся в рендере по активной локали (useMemo) или
// через sidOptions(). Заменяют прежние нативные <datalist> этого файла.
function buildSidOptions(sids: string[], lang: SidNameLang): ComboSuggestion[] {
  return sids.map((s) => ({ value: s, label: sidHint(s, lang) }))
}

function newOverride(): ValueOverride {
  return { sid: '', variant: -1, guardValue: 0 }
}

function newBonus(): Bonus {
  return { sid: 'add_bonus_hero_stat', receiverSide: -1, receiverFilter: 'start_hero', parameters: [] }
}

function newElevation(): ElevationMode {
  return { weight: 1, minElevatedFraction: 0, maxElevatedFraction: 0 }
}

function newZoneLayout(index: number): ZoneLayout {
  return {
    name: `zone_layout_${index}`,
    obstaclesFill: 0.36,
    obstaclesFillVoid: 0.36,
    lakesFill: 0.3,
    minLakeArea: 16,
    elevationClusterScale: 0.16,
    elevationModes: [newElevation()],
    roadClusterArea: 80,
    guardedEncounterResourceFractions: { countBounds: [], fractions: [0.5] },
    ambientPickupDistribution: {
      repulsion: 1,
      noise: 0.3,
      roadAttraction: -0.3,
      obstacleAttraction: 0,
      groupSizeWeights: [20, 2, 1],
    },
  }
}

function WcRow({
  label,
  hint,
  value,
  onChange,
  children,
}: {
  label: string
  hint?: string
  value?: boolean
  onChange: (v: boolean | undefined) => void
  children?: React.ReactNode
}) {
  return (
    <div className="wc-row">
      <TriSelect label={label} value={value} hint={hint} onChange={onChange} />
      {value === true && <div className="wc-row__args">{children}</div>}
    </div>
  )
}

function BasicsSection() {
  const template = useEditorStore((s) => s.template)
  const patchRoot = useEditorStore((s) => s.patchRoot)
  const { t } = useTranslation()
  return (
    <Section title={t('root.sectionBasics')} open>
      <Text label={t('root.nameLabel')} hint={t('root.nameHint')} value={template.name} onChange={(v) => patchRoot({ name: v })} />
      <Select
        label={t('root.gameModeLabel')}
        allowBlank={false}
        value={template.gameMode}
        onChange={(v) => patchRoot({ gameMode: v as GameMode })}
        options={GAME_MODE_VALUES.map((m) => ({ value: m, label: t(`root.gameModes.${m}.label`) }))}
        hint={['gameMode', GAME_MODE_VALUES.includes(template.gameMode as GameMode) ? t(`root.gameModes.${template.gameMode}.desc`) : undefined].filter(Boolean).join(' — ')}
      />
      <Text
        label={t('root.descLabel')}
        hint={t('root.descHint')}
        value={template.description}
        onChange={(v) => patchRoot({ description: v || undefined })}
      />
      <Select
        label={t('root.winCondLabel')}
        blankLabel="—"
        value={template.displayWinCondition}
        onChange={(v) => patchRoot({ displayWinCondition: v || undefined })}
        options={WIN_CONDITION_SIDS.map((w) => ({ value: w, label: t(`root.wcNames.${w}.label`) }))}
        hint={['displayWinCondition', template.displayWinCondition ? t(`root.wcNames.${template.displayWinCondition}.desc`) : undefined].filter(Boolean).join(' — ')}
      />
      <Num
        label={t('root.sizeXLabel')}
        step={16}
        hint={t('root.sizeXHint')}
        value={template.sizeX}
        onChange={(v) => patchRoot({ sizeX: v })}
      />
      <Num
        label={t('root.sizeZLabel')}
        step={16}
        hint={t('root.sizeZHint')}
        value={template.sizeZ}
        onChange={(v) => patchRoot({ sizeZ: v })}
      />
    </Section>
  )
}

function numParam(s: string | undefined): number | undefined {
  if (s == null || s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Структурный редактор `parameters` бонуса по его sid. Штатные формы:
 * - add_bonus_hero_spell: [sid заклинания]
 * - add_bonus_hero_item: [sid артефакта]
 * - add_bonus_res: [ресурс, количество]
 * - add_bonus_hero_stat: [movementBonus, N] | [magicCostSidSet, sid, изменение стоимости, 0]
 * - add_bonus_hero_unit_multipler: [множитель]
 * Если данные не соответствуют форме — фолбэк на правку сырым списком.
 * Ключи полей привязаны к значениям параметров: commit у Num/SidText по blur,
 * поэтому remount после commit лишь синхронизирует отображение со store.
 */
function BonusParamsEditor({
  sid,
  value,
  onChange,
}: {
  sid: string
  value?: string[]
  onChange: (v: string[]) => void
}) {
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  const spellOpts = useMemo(() => buildSidOptions(WORLD_SPELL_SIDS, lang), [lang])
  const artifactOpts = useMemo(() => buildSidOptions(ARTIFACT_SIDS, lang), [lang])
  const p = value ?? []

  const raw = (mismatch: boolean) => (
    <CommaList
      key={`raw:${p.join('|')}`}
      label={t('root.parametersLabel')}
      hint={mismatch ? `${t('root.paramRawHint')}. ${t('root.parametersHint')}` : t('root.parametersHint')}
      value={p}
      onChange={onChange}
    />
  )

  switch (sid) {
    case 'add_bonus_hero_spell':
      if (p.length > 1) return raw(true)
      return (
        <SidText
          key={`spell:${p[0] ?? ''}`}
          label={t('root.paramSpellLabel')}
          value={p[0]}
          hint={[t('root.paramSpellHint'), p[0] ? sidHint(p[0], lang) : undefined].filter(Boolean).join('. ')}
          suggestions={spellOpts}
          onChange={(v) => onChange(v ? [v] : [])}
        />
      )
    case 'add_bonus_hero_item':
      if (p.length > 1) return raw(true)
      return (
        <SidText
          key={`item:${p[0] ?? ''}`}
          label={t('root.paramArtifactLabel')}
          value={p[0]}
          hint={[t('root.paramArtifactHint'), p[0] ? sidHint(p[0], lang) : undefined].filter(Boolean).join('. ')}
          suggestions={artifactOpts}
          onChange={(v) => onChange(v ? [v] : [])}
        />
      )
    case 'add_bonus_res': {
      const res = p[0]
      if (p.length > 2 || (res && !BONUS_RESOURCES.includes(res))) return raw(true)
      return (
        <>
          <Select
            label={t('root.paramResLabel')}
            hint={t('root.paramResHint')}
            blankLabel="—"
            value={res}
            onChange={(v) => onChange(v ? [v, p[1] ?? '0'] : [])}
            options={BONUS_RESOURCES.map((r) => ({ value: r, label: t(`root.resources.${r}`) }))}
          />
          {res ? (
            <Num
              key={`amt:${p[1] ?? ''}`}
              label={t('root.paramResAmountLabel')}
              min={0}
              value={numParam(p[1])}
              onChange={(n) => onChange([res, String(n ?? 0)])}
            />
          ) : null}
        </>
      )
    }
    case 'add_bonus_hero_stat': {
      const kind = p[0] ?? ''
      const shapeOk = p.length === 0 || (kind === 'movementBonus' && p.length === 2) || (kind === 'magicCostSidSet' && p.length === 4)
      if (!shapeOk) return raw(true)
      const setKind = (v: string) => {
        if (v === 'movementBonus') onChange(['movementBonus', '0'])
        else if (v === 'magicCostSidSet') onChange(['magicCostSidSet', '', '-999', '0'])
        else onChange([])
      }
      return (
        <>
          <Select
            label={t('root.paramStatKindLabel')}
            hint={t('root.paramStatKindHint')}
            blankLabel="—"
            value={kind}
            onChange={setKind}
            options={STAT_KIND_VALUES.map((k) => ({ value: k, label: t(`root.paramStatKinds.${k}`) }))}
          />
          {kind === 'movementBonus' && (
            <Num
              key={`mb:${p[1] ?? ''}`}
              label={t('root.paramMoveBonusLabel')}
              hint={t('root.paramMoveBonusHint')}
              value={numParam(p[1])}
              onChange={(n) => onChange(['movementBonus', String(n ?? 0)])}
            />
          )}
          {kind === 'magicCostSidSet' && (
            <>
              <SidText
                key={`mcs:${p[1] ?? ''}`}
                label={t('root.paramSpellLabel')}
                value={p[1]}
                hint={[t('root.paramSpellHint'), p[1] ? sidHint(p[1], lang) : undefined].filter(Boolean).join('. ')}
                suggestions={spellOpts}
                onChange={(v) => onChange(['magicCostSidSet', v ?? '', p[2] ?? '-999', p[3] ?? '0'])}
              />
              <Num
                key={`cost:${p[2] ?? ''}`}
                label={t('root.paramMagicCostLabel')}
                hint={t('root.paramMagicCostHint')}
                value={numParam(p[2])}
                onChange={(n) => onChange(['magicCostSidSet', p[1] ?? '', String(n ?? 0), p[3] ?? '0'])}
              />
            </>
          )}
        </>
      )
    }
    case 'add_bonus_hero_unit_multipler':
      if (p.length > 1) return raw(true)
      return (
        <Num
          key={`mult:${p[0] ?? ''}`}
          label={t('root.paramMultiplierLabel')}
          hint={t('root.paramMultiplierHint')}
          min={0}
          value={numParam(p[0])}
          onChange={(n) => onChange(n == null ? [] : [String(n)])}
        />
      )
    default:
      return raw(false)
  }
}

function GameRulesSection() {
  const template = useEditorStore((s) => s.template)
  const patchRoot = useEditorStore((s) => s.patchRoot)
  const rules = template.gameRules
  const set = (p: Partial<GameRules>) => patchRoot({ gameRules: { ...(rules ?? {}), ...p } })
  const bonuses = rules?.bonuses ?? []

  const setBonuses = (next: Bonus[]) => {
    const copyR: GameRules = { ...(rules ?? {}) }
    if (next.length) copyR.bonuses = next
    else delete copyR.bonuses
    patchRoot({ gameRules: copyR })
  }
  const patchBonus = (i: number, p: Partial<Bonus>) =>
    setBonuses(bonuses.map((b, j) => (j === i ? { ...b, ...p } : b)))

  const wc = rules?.winConditions
  const setWc = (p: Partial<WinConditions>) => set({ winConditions: { ...(wc ?? {}), ...p } })
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)

  // Каталог поля «Бонус (sid)» — сперва пять игровых бонусов с
  // официальными именами, затем общий каталог sid.
  const bonusOptions: ComboSuggestion[] = [
    ...BONUS_SIDS.map((s) => ({ value: s, label: t(`root.bonusNames.${s}`) })),
    ...sidOptions(lang),
  ]

  // Читаемое имя бонуса — официальное имя для пяти игровых
  // бонусов (root.bonusNames.*), иначе имя из каталога sid.
  const bonusName = (sid?: string): string | undefined =>
    sid ? sidHint(sid, lang) ?? (BONUS_SIDS.includes(sid) ? t(`root.bonusNames.${sid}`) : undefined) : undefined

  return (
    <Section title={t('root.sectionRules')}>
      <Num label={t('root.heroCountMinLabel')} hint={t('root.heroCountMinHint')} min={0} max={6} value={rules?.heroCountMin} onChange={(v) => set({ heroCountMin: v })} />
      <Num label={t('root.heroCountMaxLabel')} hint={t('root.heroCountMaxHint')} min={1} max={10} value={rules?.heroCountMax} onChange={(v) => set({ heroCountMax: v })} />
      <Num label={t('root.heroCountIncrementLabel')} hint={t('root.heroCountIncrementHint')} min={0} max={2} value={rules?.heroCountIncrement} onChange={(v) => set({ heroCountIncrement: v })} />
      <TriSelect label={t('root.heroHireBanLabel')} hint={t('root.heroHireBanHint')} value={rules?.heroHireBan} onChange={(v) => set({ heroHireBan: v })} />
      <TriSelect label={t('root.encounterHolesLabel')} hint={t('root.encounterHolesHint')} value={rules?.encounterHoles} onChange={(v) => set({ encounterHoles: v })} />
      <TriSelect label={t('root.tournamentRulesLabel')} hint={t('root.tournamentRulesHint')} value={rules?.tournamentRules} onChange={(v) => set({ tournamentRules: v })} />
      <Num label={t('root.factionLawsExpLabel')} hint={t('root.factionLawsExpHint')} step={0.05} value={rules?.factionLawsExpModifier} onChange={(v) => set({ factionLawsExpModifier: v })} />
      <Num label={t('root.astrologyExpLabel')} hint={t('root.astrologyExpHint')} step={0.05} value={rules?.astrologyExpModifier} onChange={(v) => set({ astrologyExpModifier: v })} />

      <div className="full">
        <span className="ef__label">{t('root.bonusesTitle')}</span>
        {bonuses.map((b, i) => (
          <details className="mo" key={i}>
            <summary>
              {(() => {
                // Читаемое имя бонуса основным, сырой sid вторичным.
                const name = bonusName(b.sid)
                const title = name && b.sid && name !== b.sid ? `${name} · ${b.sid}` : b.sid ?? undefined
                return (
                  <span title={title}>
                    {name ?? b.sid ?? t('root.sidQuestion')}
                    {name && b.sid && name !== b.sid && <span className="mo__sid">{b.sid}</span>}
                  </span>
                )
              })()}
              {b.receiverFilter && (
                <span className="mo__hint">
                  {BONUS_FILTER_VALUES.includes(b.receiverFilter) ? t(`root.bonusFilter.${b.receiverFilter}`) : b.receiverFilter}
                </span>
              )}
              <button
                type="button"
                className="mo__del"
                onClick={(e) => {
                  e.preventDefault()
                  setBonuses(bonuses.filter((_, j) => j !== i))
                }}
                title={t('root.bonusDeleteTitle')}
              >
                ✕
              </button>
            </summary>
            <div className="mo__grid">
              <SidText
                label={t('root.bonusSidLabel')}
                value={b.sid}
                hint={sidHint(b.sid, lang) ?? (BONUS_SIDS.includes(b.sid) ? t(`root.bonusHints.${b.sid}`) : undefined)}
                suggestions={bonusOptions}
                sub={bonusName(b.sid)}
                onChange={(v) => patchBonus(i, { sid: v })}
              />
              <Num
                label={t('root.receiverSideLabel')}
                hint={t('root.receiverSideHint')}
                value={b.receiverSide}
                onChange={(v) => patchBonus(i, { receiverSide: v })}
              />
              <Select
                label={t('root.receiverFilterLabel')}
                blankLabel="—"
                hint={t('root.receiverFilterHint')}
                value={b.receiverFilter}
                onChange={(v) => patchBonus(i, { receiverFilter: v || undefined })}
                options={BONUS_FILTER_VALUES.map((v) => ({ value: v, label: t(`root.bonusFilter.${v}`) }))}
              />
              <BonusParamsEditor key={b.sid} sid={b.sid} value={b.parameters} onChange={(v) => patchBonus(i, { parameters: v })} />
            </div>
          </details>
        ))}
        <button type="button" className="btn" onClick={() => setBonuses([...bonuses, newBonus()])}>
          <Plus size={12} /> {t('root.addBonus')}
        </button>
      </div>

      <div className="full">
        <span className="ef__label">{t('root.winConditionsTitle')}</span>
        <div className="wc-list">
          <WcRow label={t('root.wcClassicLabel')} hint={t('root.wcClassicHint')} value={wc?.classic} onChange={(v) => setWc({ classic: v })} />
          <WcRow label={t('root.wcDesertionLabel')} hint={t('root.wcDesertionHint')} value={wc?.desertion} onChange={(v) => setWc({ desertion: v })}>
            <Num label={t('root.desertionDayLabel')} hint={t('root.desertionDayHint')} min={1} value={wc?.desertionDay} onChange={(v) => setWc({ desertionDay: v })} />
            <Num label={t('root.desertionValueLabel')} hint={t('root.desertionValueHint')} step={100} value={wc?.desertionValue} onChange={(v) => setWc({ desertionValue: v })} />
          </WcRow>
          <WcRow label={t('root.wcHeroLightingLabel')} hint={t('root.heroLightingHint')} value={wc?.heroLighting} onChange={(v) => setWc({ heroLighting: v })}>
            <Num label={t('root.heroLightingDayLabel')} hint={t('root.heroLightingDayHint')} min={1} value={wc?.heroLightingDay} onChange={(v) => setWc({ heroLightingDay: v })} />
          </WcRow>
          <WcRow label={t('root.wcLostStartCityLabel')} hint={t('root.wcLostStartCityHint')} value={wc?.lostStartCity} onChange={(v) => setWc({ lostStartCity: v })}>
            <Num label={t('root.lostStartCityDayLabel')} hint={t('root.lostStartCityDayHint')} min={1} max={3} value={wc?.lostStartCityDay} onChange={(v) => setWc({ lostStartCityDay: v })} />
          </WcRow>
          <WcRow label={t('root.wcLostStartHeroLabel')} hint={t('root.wcLostStartHeroHint')} value={wc?.lostStartHero} onChange={(v) => setWc({ lostStartHero: v })} />
          <WcRow label={t('root.wcCityHoldLabel')} hint={t('root.wcCityHoldHint')} value={wc?.cityHold} onChange={(v) => setWc({ cityHold: v })}>
            <Num label={t('root.cityHoldDaysLabel')} hint={t('root.cityHoldDaysHint')} min={3} max={7} value={wc?.cityHoldDays} onChange={(v) => setWc({ cityHoldDays: v })} />
          </WcRow>
          <WcRow label={t('root.wcHoldCityLabel')} hint={t('root.holdCityWinConHint')} value={wc?.holdCityWinCon} onChange={(v) => setWc({ holdCityWinCon: v })} />
          <WcRow label={t('root.wcGladiatorArenaLabel')} hint={t('root.wcGladiatorArenaHint')} value={wc?.gladiatorArena} onChange={(v) => setWc({ gladiatorArena: v })}>
            <TriSelect label={t('root.gladiatorRegWorkLabel')} hint={t('root.gladiatorRegWorkHint')} value={wc?.gladiatorArenaRegistrationStartWork} onChange={(v) => setWc({ gladiatorArenaRegistrationStartWork: v })} />
            <TriSelect label={t('root.gladiatorRegFightLabel')} hint={t('root.gladiatorRegFightHint')} value={wc?.gladiatorArenaRegistrationStartFight} onChange={(v) => setWc({ gladiatorArenaRegistrationStartFight: v })} />
            <Num label={t('root.gladiatorDaysDelayLabel')} hint={t('root.gladiatorDaysDelayHint')} min={1} max={30} value={wc?.gladiatorArenaDaysDelayStart} onChange={(v) => setWc({ gladiatorArenaDaysDelayStart: v })} />
            <Num label={t('root.gladiatorCountDayLabel')} hint={t('root.gladiatorCountDayHint')} min={1} max={8} value={wc?.gladiatorArenaCountDay} onChange={(v) => setWc({ gladiatorArenaCountDay: v })} />
          </WcRow>
          <WcRow label={t('root.wcTournamentLabel')} hint={t('root.wcTournamentHint')} value={wc?.tournament} onChange={(v) => setWc({ tournament: v })}>
            <Num label={t('root.tournamentPointsLabel')} hint={t('root.tournamentPointsHint')} min={2} max={3} value={wc?.tournamentPointsToWin} onChange={(v) => setWc({ tournamentPointsToWin: v })} />
            <TriSelect label={t('root.tournamentSaveArmyLabel')} hint={t('root.tournamentSaveArmyHint')} value={wc?.tournamentSaveArmy} onChange={(v) => setWc({ tournamentSaveArmy: v })} />
            <NumList label={t('root.tournamentDaysLabel')} hint={t('root.tournamentDaysHint')} value={wc?.tournamentDays} onChange={(v) => setWc({ tournamentDays: v })} />
            <NumList label={t('root.tournamentAnnounceLabel')} hint={t('root.tournamentAnnounceHint')} value={wc?.tournamentAnnounceDays} onChange={(v) => setWc({ tournamentAnnounceDays: v })} />
            <Select
              label={t('root.championSelectLabel')}
              blankLabel="—"
              hint={t('root.championSelectHint')}
              value={wc?.championSelectRule}
              onChange={(v) => setWc({ championSelectRule: v || undefined })}
              options={[{ value: 'StartHero', label: t('root.championStartHero') }]}
            />
          </WcRow>
        </div>
      </div>
    </Section>
  )
}

function OverridesSection() {
  const template = useEditorStore((s) => s.template)
  const patchRoot = useEditorStore((s) => s.patchRoot)
  const overrides = template.valueOverrides ?? []
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  const set = (next: ValueOverride[]) => patchRoot({ valueOverrides: next.length ? next : undefined })
  const patch = (i: number, p: Partial<ValueOverride>) =>
    set(overrides.map((o, j) => (j === i ? { ...o, ...p } : o)))

  return (
    <Section title={t('root.sectionOverrides')}>
      <div className="hint full">{t('root.overridesHint')}</div>
      {overrides.map((o, i) => (
        <details className="mo" key={i}>
          <summary>
            {(() => {
              // Читаемое имя объекта основным, сырой sid вторичным.
              const name = o.sid ? sidHint(o.sid, lang) : undefined
              const title = name && o.sid && name !== o.sid ? `${name} · ${o.sid}` : o.sid || undefined
              return (
                <span title={title}>
                  {name ?? (o.sid || t('root.sidQuestion'))}
                  {name && o.sid && name !== o.sid && <span className="mo__sid">{o.sid}</span>}
                </span>
              )
            })()}
            <span className="mo__hint">
              {t('root.overrideSummary', {
                v: o.variant === -1 ? t('root.variantAll') : String(o.variant),
                g: String(o.guardValue),
              })}
            </span>
            <button
              type="button"
              className="mo__del"
              onClick={(e) => {
                e.preventDefault()
                set(overrides.filter((_, j) => j !== i))
              }}
              title={t('root.overrideDeleteTitle')}
            >
              ✕
            </button>
          </summary>
          <div className="mo__grid">
            <SidText
              label={t('root.overrideSidLabel')}
              value={o.sid}
              hint={sidHint(o.sid, lang)}
              suggestions={sidOptions(lang)}
              showHint
              onChange={(v) => patch(i, { sid: v })}
            />
            <Num label={t('root.overrideVariantLabel')} hint={t('root.variantAllHint')} value={o.variant} onChange={(v) => patch(i, { variant: v })} />
            <Num label={t('root.overrideGuardValueLabel')} step={100} hint={t('root.overrideGuardValueHint')} value={o.guardValue} onChange={(v) => patch(i, { guardValue: v })} />
          </div>
        </details>
      ))}
      <button type="button" className="btn" onClick={() => set([...overrides, newOverride()])}>
        <Plus size={12} /> {t('root.addOverride')}
      </button>
    </Section>
  )
}

// Список банов: чипы выбранных sid (имя — из каталога, неизвестные — warn)
// + строка добавления с подсказками ComboInput. Клик по чипу — убрать из банов.
function BanListEditor({
  label,
  hint,
  suggestions,
  value,
  onChange,
}: {
  label: string
  hint?: string
  suggestions: ComboSuggestion[]
  value?: string[]
  onChange: (v: string[]) => void
}) {
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  const [draft, setDraft] = useState('')
  const sids = value ?? []

  const add = (forced?: string) => {
    const sid = (forced ?? draft).trim()
    setDraft('')
    if (!sid || sids.includes(sid)) return
    onChange([...sids, sid])
  }
  const remove = (sid: string) => onChange(sids.filter((s) => s !== sid))

  return (
    <div className="ban-field full">
      <span className="ef__label" title={hint}>{label}</span>
      {sids.length > 0 && (
        <div className="chips">
          {sids.map((sid) => {
            const name = sidHint(sid, lang)
            return (
              <button
                key={sid}
                type="button"
                className={`chip${name ? '' : ' chip--warn'}`}
                title={t('root.bansRemoveTitle', { sid })}
                onClick={() => remove(sid)}
              >
                {name ?? sid}
                {!name && <span className="preset__badge preset__badge--missing">{t('root.bansUnknownBadge')}</span>}
              </button>
            )
          })}
        </div>
      )}
      <div className="ban-add">
        <ComboInput
          text={draft}
          onText={setDraft}
          onSelect={(v) => add(v)}
          onCommit={(v) => add(v)}
          suggestions={suggestions}
          placeholder={t('root.bansAddPlaceholder')}
        />
        <button type="button" className="icon-btn" title={t('root.bansAddPlaceholder')} onClick={() => add()}>
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

function GlobalBansSection() {
  const template = useEditorStore((s) => s.template)
  const patchRoot = useEditorStore((s) => s.patchRoot)
  const bans = template.globalBans
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  const banMagicsOpts = useMemo(() => buildSidOptions(WORLD_SPELL_SIDS, lang), [lang])
  const banItemsOpts = useMemo(() => buildSidOptions(BAN_ITEM_SIDS, lang), [lang])
  const banSkillsOpts = useMemo(() => buildSidOptions(BAN_SKILL_SIDS, lang), [lang])
  const banHeroesOpts = useMemo(() => buildSidOptions(BAN_HERO_SIDS, lang), [lang])

  const setKey = (key: keyof GlobalBans, v: string[]) => {
    const next: GlobalBans = { ...(bans ?? {}) }
    if (v.length) next[key] = v
    else delete next[key]
    patchRoot({ globalBans: Object.keys(next).length > 0 ? next : undefined })
  }

  return (
    <Section title={t('root.sectionBans')}>
      <div className="hint full">{t('root.bansHint')}</div>
      <BanListEditor
        label={t('root.bansMagicsLabel')}
        hint={t('root.bansMagicsHint')}
        suggestions={banMagicsOpts}
        value={bans?.magics}
        onChange={(v) => setKey('magics', v)}
      />
      <BanListEditor
        label={t('root.bansItemsLabel')}
        hint={t('root.bansItemsHint')}
        suggestions={banItemsOpts}
        value={bans?.items}
        onChange={(v) => setKey('items', v)}
      />
      <BanListEditor
        label={t('root.bansSkillsLabel')}
        hint={t('root.bansSkillsHint')}
        suggestions={banSkillsOpts}
        value={bans?.skills}
        onChange={(v) => setKey('skills', v)}
      />
      <BanListEditor
        label={t('root.bansHeroesLabel')}
        hint={t('root.bansHeroesHint')}
        suggestions={banHeroesOpts}
        value={bans?.heroes}
        onChange={(v) => setKey('heroes', v)}
      />
    </Section>
  )
}

function ZoneLayoutsSection() {
  const template = useEditorStore((s) => s.template)
  const patchRoot = useEditorStore((s) => s.patchRoot)
  const layouts = template.zoneLayouts ?? []
  const { t } = useTranslation()
  const set = (next: ZoneLayout[]) => patchRoot({ zoneLayouts: next.length ? next : undefined })

  const patchLayout = (i: number, p: Partial<ZoneLayout>) =>
    set(layouts.map((l, j) => (j === i ? { ...l, ...p } : l)))

  const patchMode = (i: number, mi: number, p: Partial<ElevationMode>) => {
    const modes = layouts[i].elevationModes ?? []
    patchLayout(i, { elevationModes: modes.map((m, j) => (j === mi ? { ...m, ...p } : m)) })
  }

  const patchAmbient = (i: number, p: Partial<AmbientPickupDistribution>) => {
    const base: AmbientPickupDistribution =
      layouts[i].ambientPickupDistribution ?? {
        repulsion: 1,
        noise: 0.3,
        roadAttraction: -0.3,
        obstacleAttraction: 0,
        groupSizeWeights: [],
      }
    patchLayout(i, { ambientPickupDistribution: { ...base, ...p } })
  }

  return (
    <Section title={t('root.sectionLayouts')}>
      <div className="hint full">{t('root.layoutsHint')}</div>
      {layouts.map((l, i) => (
        <details className="mo" key={i} open>
          <summary>
            <span>{l.name}</span>
            <button
              type="button"
              className="mo__del"
              onClick={(e) => {
                e.preventDefault()
                set(layouts.filter((_, j) => j !== i))
              }}
              title={t('root.layoutDeleteTitle')}
            >
              ✕
            </button>
          </summary>
          <div className="mo__grid">
            <Text label={t('root.layoutNameLabel')} hint={t('root.layoutNameHint')} required value={l.name} onChange={(v) => patchLayout(i, { name: v })} />
            <Num label={t('root.layoutObstaclesLabel')} step={0.02} min={0} max={1} hint={t('root.obstaclesFillHint')} required value={l.obstaclesFill} onChange={(v) => patchLayout(i, { obstaclesFill: v })} />
            <Num label={t('root.layoutObstaclesVoidLabel')} step={0.02} min={0} max={1} hint={t('root.obstaclesVoidHint')} required value={l.obstaclesFillVoid} onChange={(v) => patchLayout(i, { obstaclesFillVoid: v })} />
            <Num label={t('root.layoutLakesLabel')} step={0.02} min={0} max={0.5} hint={t('root.lakesFillHint')} required value={l.lakesFill} onChange={(v) => patchLayout(i, { lakesFill: v })} />
            <Num label={t('root.layoutMinLakeLabel')} min={1} hint={t('root.minLakeAreaHint')} value={l.minLakeArea} onChange={(v) => patchLayout(i, { minLakeArea: v })} />
            <Num label={t('root.layoutElevScaleLabel')} step={0.02} min={0} max={1} hint={t('root.elevationClusterScaleHint')} required value={l.elevationClusterScale} onChange={(v) => patchLayout(i, { elevationClusterScale: v })} />
            <Num label={t('root.layoutRoadClusterLabel')} step={5} min={1} hint={t('root.roadClusterAreaHint')} required value={l.roadClusterArea} onChange={(v) => patchLayout(i, { roadClusterArea: v })} />

            <div className="full">
              <span className="ef__label" title={t('root.elevationTitleHint')}>{t('root.elevationTitle')}</span>
              {(l.elevationModes ?? []).map((m, mi) => (
                <div key={mi} className="mc-rule">
                  <div className="full mc-rule__head">
                    <span>{t('root.elevationItem', { n: mi + 1 })}</span>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() =>
                        patchLayout(i, { elevationModes: (l.elevationModes ?? []).filter((_, j) => j !== mi) })
                      }
                      title={t('root.elevationDeleteTitle')}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <Num label={t('root.modeWeightLabel')} min={0} hint={t('root.modeWeightHint')} value={m.weight} onChange={(v) => patchMode(i, mi, { weight: v })} />
                  <Num label={t('root.modeMinElevLabel')} step={0.05} min={0} max={1} hint={t('root.modeMinElevHint')} value={m.minElevatedFraction} onChange={(v) => patchMode(i, mi, { minElevatedFraction: v })} />
                  <Num label={t('root.modeMaxElevLabel')} step={0.05} min={0} max={1} hint={t('root.modeMaxElevHint')} value={m.maxElevatedFraction} onChange={(v) => patchMode(i, mi, { maxElevatedFraction: v })} />
                </div>
              ))}
              <button
                type="button"
                className="btn"
                onClick={() => patchLayout(i, { elevationModes: [...(l.elevationModes ?? []), newElevation()] })}
              >
                <Plus size={12} /> {t('root.addElevation')}
              </button>
            </div>

            <Num
              label={t('root.gerFractionsLabel')}
              step={0.01}
              min={0}
              max={1}
              hint={t('root.gerFractionsHint')}
              required
              value={l.guardedEncounterResourceFractions?.fractions?.[0]}
              onChange={(v) =>
                patchLayout(i, {
                  guardedEncounterResourceFractions: {
                    countBounds: l.guardedEncounterResourceFractions?.countBounds ?? [],
                    fractions: v == null ? [] : [v],
                  },
                })
              }
            />
            <NumList
              label={t('root.gerCountBoundsLabel')}
              hint={t('root.countBoundsHint')}
              value={l.guardedEncounterResourceFractions?.countBounds}
              onChange={(v) =>
                patchLayout(i, { guardedEncounterResourceFractions: { fractions: l.guardedEncounterResourceFractions?.fractions ?? [], countBounds: v } })
              }
            />

            <div className="full">
              <span className="ef__label" title={t('root.ambientTitleHint')}>
                {t('root.ambientTitle')}
                <span className="ef__req" title={t('fields.requiredTitle')}>*</span>
              </span>
            </div>
            <Num label={t('root.ambientRepulsionLabel')} step={0.1} hint={t('root.ambientRepulsionHint')} value={l.ambientPickupDistribution?.repulsion} onChange={(v) => patchAmbient(i, { repulsion: v })} />
            <Num label={t('root.ambientNoiseLabel')} step={0.05} hint={t('root.ambientNoiseHint')} value={l.ambientPickupDistribution?.noise} onChange={(v) => patchAmbient(i, { noise: v })} />
            <Num label={t('root.ambientRoadLabel')} step={0.05} hint={t('root.ambientRoadHint')} value={l.ambientPickupDistribution?.roadAttraction} onChange={(v) => patchAmbient(i, { roadAttraction: v })} />
            <Num label={t('root.ambientObstacleLabel')} step={0.01} hint={t('root.ambientObstacleHint')} value={l.ambientPickupDistribution?.obstacleAttraction} onChange={(v) => patchAmbient(i, { obstacleAttraction: v })} />
            <NumList label={t('root.ambientGroupWeightsLabel')} hint={t('root.groupSizeWeightsHint')} value={l.ambientPickupDistribution?.groupSizeWeights} onChange={(v) => patchAmbient(i, { groupSizeWeights: v })} />
          </div>
        </details>
      ))}
      <button type="button" className="btn" onClick={() => set([...layouts, newZoneLayout(layouts.length + 1)])}>
        <Plus size={12} /> {t('root.addLayout')}
      </button>
    </Section>
  )
}

/**
 * «Умный» JSON всей глобальной информации шаблона (кроме зон и связей —
 * они редактируются на канве). variants[] показываются без zones/connections;
 * при применении они сливаются обратно из текущего шаблона.
 */
function RootJsonSection() {
  const { t } = useTranslation()
  const template = useEditorStore((s) => s.template)
  const applyRootJson = useEditorStore((s) => s.applyRootJson)
  const view = useMemo(() => rootJsonView(template), [template])
  const variantsCount = template.variants?.length ?? 0
  const validate = useCallback(
    (parsed: unknown) => validateRootDraft(parsed, variantsCount),
    [variantsCount],
  )
  const onApply = useCallback(
    (parsed: unknown) => {
      const err = validateRootDraft(parsed, variantsCount)
      if (err) return err
      applyRootJson(mergeRootJson(parsed as RmgTemplate, template))
      return null
    },
    [applyRootJson, template, variantsCount],
  )
  return (
    <Section title={t('root.sectionJson')} persistKey="root-json">
      <div className="json-edit-full">
        <div className="json-edit__hint">{t('root.jsonHint')}</div>
        <JsonEditor draftKey="root" value={view} validate={validate} onApply={onApply} rows={20} />
      </div>
    </Section>
  )
}

export function RootPanel() {
  return (
    <div className="editor">
      <BasicsSection />
      <GameRulesSection />
      <OverridesSection />
      <GlobalBansSection />
      <ZoneLayoutsSection />
      <RootJsonSection />
    </div>
  )
}