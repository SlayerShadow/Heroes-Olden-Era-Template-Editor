import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../../store/editorStore'
import type { BiomeSelector, EncounterHolesSettings, FactionSelector, MainObject, Placement, Zone, ZoneLayout } from '../../types/rmg'
import { CommaList, NoteArea, Num, PresetSelect, Section, Select, Text, TriSelect } from './fields'
import { GroupRefList } from './GroupRefList'
import { RoadsEditor } from './RoadsEditor'
import { PoolListEditor } from '../pools/PoolListEditor'
import {
  BIOME_NAMES,
  BUILDINGS_BAN_PRESETS,
  BUILDINGS_CONSTRUCTION_PRESETS,
  FACTION_NAMES,
  KNOWN_BROKEN_CONSTRUCTION_PRESETS,
} from '../../data/presets'

const KNOWN_BROKEN_CONSTRUCTION = new Set(KNOWN_BROKEN_CONSTRUCTION_PRESETS)

const PLAYER_OPTIONS = Array.from({ length: 8 }, (_, i) => ({
  value: `Player${i + 1}`,
  label: `Player ${i + 1}`,
}))

const OBJECT_TYPES: MainObject['type'][] = ['City', 'Spawn', 'AbandonedOutpost', 'GladiatorArena']
const PLACEMENTS: Placement[] = ['Uniform', 'Center', 'Connection', 'NearZone']

/**
 * Стабильный пустой массив главных объектов. Значения внутри useShallow-селектора
 * сравниваются по ссылке: свежий `[]` на каждый вызов (зона без mainObjects в
 * слаботипизированном файле) дал бы бесконечный цикл ре-рендеров.
 */
const NO_MAIN_OBJECTS: MainObject[] = []

/** Ряд переключаемых чипов: клик добавляет/убирает термин в/из списка. */
function TermChips({
  terms,
  selected,
  onToggle,
  labelFor,
}: {
  terms: readonly string[]
  selected: string[]
  onToggle: (term: string, on: boolean) => void
  /** Подпись чипа вместо сырого термина (локализация имён); по умолчанию — термин как есть. */
  labelFor?: (term: string) => string
}) {
  const { t } = useTranslation()
  return (
    <div className="chips full">
      {terms.map((term) => {
        const on = selected.includes(term)
        return (
          <button
            key={term}
            type="button"
            className={`chip${on ? ' chip--on' : ''}`}
            title={on ? t('zone.chipRemoveTitle') : t('zone.chipAddTitle')}
            onClick={() => onToggle(term, !on)}
          >
            {on ? '✓ ' : ''}
            {labelFor ? labelFor(term) : term}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Пара полей «Главный объект» + «Зона» для селекторов с позиционными args
 * [индекс, зона?]: биомы (MatchMainObject) и фракция главного объекта (Match).
 * Список опций — из секции «Главные объекты» зоны-источника: без «Зоны» — текущей,
 * с ней — указанной; индекс вне списка остаётся явной опцией,
 * чтобы дропдаун молча не «обнулял» записанное в файле.
 */
function MainObjectRefFields({
  args,
  onArgs,
  zones,
  mainObjectsOf,
  indexLabel,
  indexHint,
  zoneLabel,
  zoneHint,
}: {
  args: string[]
  onArgs: (args: string[]) => void
  zones: string[]
  mainObjectsOf: (zoneName?: string) => MainObject[]
  indexLabel: string
  indexHint: string
  zoneLabel: string
  zoneHint: string
}) {
  const { t } = useTranslation()
  const indexValue = args[0] ?? ''
  const options = mainObjectsOf(args[1] || undefined).map((mo, i) => {
    const typeName = (OBJECT_TYPES as string[]).includes(mo.type) ? t(`zone.moTypes.${mo.type}`) : String(mo.type)
    const spawn = mo.type === 'Spawn' && mo.spawn ? ` · ${mo.spawn}` : ''
    return { value: String(i), label: `${i} · ${typeName}${spawn}` }
  })
  if (indexValue !== '' && !options.some((o) => o.value === indexValue)) {
    options.push({ value: indexValue, label: t('zone.moRefMissing', { v: indexValue }) })
  }
  return (
    <>
      <Select
        label={indexLabel}
        blankLabel="—"
        hint={indexHint}
        value={indexValue}
        onChange={(v) => {
          const zoneArg = args[1]
          // args позиционны ([индекс, зона?]): при очистке индекса зона
          // удерживается на args[1] пустым слотом — иначе она сдвинулась
          // бы на место индекса и стала бы args[0].
          onArgs(v ? (zoneArg ? [v, zoneArg] : [v]) : zoneArg ? ['', zoneArg] : [])
        }}
        options={options}
      />
      <Select
        label={zoneLabel}
        blankLabel="—"
        hint={zoneHint}
        value={args[1] ?? ''}
        onChange={(v) => {
          const idx = args[0]
          onArgs(v ? [idx ?? '', v] : idx ? [idx] : [])
        }}
        options={zones.map((z) => ({ value: z }))}
      />
    </>
  )
}

/**
 * Редактор faction: Match — индекс главного объекта (+ необязательная зона);
 * FromList — чипы известных фракций + CommaList для differentFrom-выражений.
 */
function FactionEditor({
  faction,
  onPatch,
  zones,
  mainObjectsOf,
}: {
  faction?: FactionSelector
  onPatch: (f: FactionSelector | undefined) => void
  zones: string[]
  mainObjectsOf: (zoneName?: string) => MainObject[]
}) {
  const { t } = useTranslation()
  return (
    <>
      <Select
        label={t('zone.factionTypeLabel')}
        blankLabel="—"
        hint={t('zone.factionTypeHint')}
        value={faction?.type}
        onChange={(v) =>
          v
            ? onPatch({ type: v as FactionSelector['type'], args: faction?.args ?? [] })
            : onPatch(undefined)
        }
        options={[
          { value: 'Match', label: t('zone.factionMatch') },
          { value: 'FromList', label: t('zone.factionFromList') },
        ]}
      />
      {faction?.type === 'Match' && (
        <MainObjectRefFields
          args={faction.args}
          onArgs={(args) => onPatch({ ...faction, args })}
          zones={zones}
          mainObjectsOf={mainObjectsOf}
          indexLabel={t('zone.factionArgIndexLabel')}
          indexHint={t('zone.factionArgIndexHint')}
          zoneLabel={t('zone.factionArgZoneLabel')}
          zoneHint={t('zone.factionArgZoneHint')}
        />
      )}
      {faction?.type === 'FromList' && (
        <>
          <TermChips
            terms={FACTION_NAMES}
            selected={faction.args}
            onToggle={(term, on) =>
              onPatch({
                ...faction,
                args: on
                  ? [...faction.args.filter((a) => a !== term), term]
                  : faction.args.filter((a) => a !== term),
              })
            }
          />
          <CommaList
            label={t('zone.restLabel')}
            value={faction.args.filter((a) => !FACTION_NAMES.includes(a))}
            hint={t('zone.factionRestHint')}
            placeholder="differentFrom: 0 Spawn-A"
            onChange={(rest) =>
              onPatch({ ...faction, args: [...faction.args.filter((a) => FACTION_NAMES.includes(a)), ...rest] })
            }
          />
        </>
      )}
    </>
  )
}

function NewObject({ onAdd }: { onAdd: (mo: MainObject) => void }) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<MainObject['type']>('City')
  const add = () => {
    const ready: MainObject =
      kind === 'Spawn'
        ? { type: 'Spawn', spawn: 'Player1', placement: 'Center' }
        : { type: kind, placement: 'Center', guardChance: 1, guardValue: 10000 }
    onAdd(ready)
  }
  return (
    <div className="mo-add">
      <select className="input" value={kind} onChange={(e) => setKind(e.target.value as MainObject['type'])}>
        {OBJECT_TYPES.map((ty) => (
          <option key={ty} value={ty}>
            {t(`zone.moTypes.${ty}`)}
          </option>
        ))}
      </select>
      <button type="button" className="btn" onClick={add}>
        {t('zone.addObject')}
      </button>
    </div>
  )
}

function MainObjectsEditor({
  zone,
  update,
  zones,
  mainObjectsOf,
}: {
  zone: Zone
  update: (p: Partial<Zone>) => void
  zones: string[]
  mainObjectsOf: (zoneName?: string) => MainObject[]
}) {
  const { t } = useTranslation()
  const set = (i: number, patch: Partial<MainObject>) =>
    update({
      mainObjects: (zone.mainObjects ?? []).map((m, j) =>
        j === i ? { ...m, ...patch } : m,
      ),
    })
  const remove = (i: number) =>
    update({ mainObjects: (zone.mainObjects ?? []).filter((_, j) => j !== i) })

  return (
    <div className="full">
      {(zone.mainObjects ?? []).map((mo, i) => (
        <details key={i} className="mo">
          <summary>
            <span>{mo.type}</span>
            {mo.type === 'Spawn' && mo.spawn && <span className="mo__spawn">{mo.spawn}</span>}
            <span className="mo__hint">{mo.placement}{mo.guardValue != null ? ` · ${mo.guardValue}` : ''}</span>
            <button
              type="button"
              className="mo__del"
              onClick={(e) => {
                e.preventDefault()
                remove(i)
              }}
              title={t('zone.deleteObjectTitle')}
            >
              ✕
            </button>
          </summary>
          <div className="mo__body">
            <div className="mo__group">
              <div className="mo__group-title">{t('zone.moGroupObject')}</div>
              <div className="mo__grid">
                <Select
                  label={t('zone.typeLabel')}
                  allowBlank={false}
                  value={mo.type}
                  onChange={(v) => set(i, { type: v as MainObject['type'] })}
                  options={OBJECT_TYPES.map((ty) => ({ value: ty, label: t(`zone.moTypes.${ty}`) }))}
                />
                <Select
                  label={t('zone.spawnLabel')}
                  blankLabel="—"
                  hint={t('zone.spawnOnlyHint')}
                  value={mo.spawn}
                  onChange={(v) => set(i, { spawn: v || undefined })}
                  options={PLAYER_OPTIONS}
                />
                <Select
                  label={t('zone.placementLabel')}
                  allowBlank={false}
                  hint={t('zone.placementHint')}
                  value={mo.placement}
                  onChange={(v) => set(i, { placement: v as Placement })}
                  options={PLACEMENTS.map((p) => ({ value: p, label: t(`zone.placements.${p}`) }))}
                />
                <CommaList
                  label={t('zone.placementArgsLabel')}
                  value={mo.placementArgs}
                  hint={t('zone.placementArgsHint')}
                  placeholder={t('zone.placementArgsPlaceholder')}
                  onChange={(args) => set(i, { placementArgs: args.length ? args : undefined })}
                />
              </div>
            </div>
            <div className="mo__group">
              <div className="mo__group-title">{t('zone.moGroupFaction')}</div>
              <div className="mo__grid">
                <FactionEditor faction={mo.faction} zones={zones} mainObjectsOf={mainObjectsOf} onPatch={(f) => set(i, { faction: f })} />
                <PresetSelect
                  label={t('zone.constructionLabel')}
                  value={mo.buildingsConstructionSid}
                  dataList={BUILDINGS_CONSTRUCTION_PRESETS}
                  broken={KNOWN_BROKEN_CONSTRUCTION}
                  hint={t('zone.constructionPresetHint')}
                  onChange={(v) => set(i, { buildingsConstructionSid: v })}
                />
                <PresetSelect
                  label={t('zone.banLabel')}
                  value={mo.buildingsBanSid}
                  dataList={BUILDINGS_BAN_PRESETS}
                  hint={t('zone.banPresetHint')}
                  onChange={(v) => set(i, { buildingsBanSid: v })}
                />
              </div>
            </div>
            <div className="mo__group">
              <div className="mo__group-title">{t('zone.moGroupGuard')}</div>
              <div className="mo__grid">
                <Text label={t('zone.ownerLabel')} hint={t('zone.ownerHint')} value={mo.owner} onChange={(v) => set(i, { owner: v || undefined })} />
                <Num
                  label={t('zone.guardChanceLabel')}
                  hint={t('zone.guardChanceHint')}
                  min={0}
                  max={1}
                  step={0.05}
                  value={mo.guardChance}
                  onChange={(v) => set(i, { guardChance: v })}
                />
                <Num
                  label={t('zone.guardValueLabel')}
                  step={100}
                  hint={t('zone.guardValueHint')}
                  value={mo.guardValue}
                  onChange={(v) => set(i, { guardValue: v })}
                />
                <Num
                  label={t('zone.moGuardWeeklyLabel')}
                  hint={t('zone.moGuardWeeklyHint')}
                  step={0.05}
                  value={mo.guardWeeklyIncrement}
                  onChange={(v) => set(i, { guardWeeklyIncrement: v })}
                />
                <Num
                  label={t('zone.moGuardRandomLabel')}
                  hint={t('zone.moGuardRandomHint')}
                  min={0}
                  max={1}
                  step={0.05}
                  value={mo.guardRandomization}
                  onChange={(v) => set(i, { guardRandomization: v })}
                />
                <TriSelect
                  label={t('zone.removeGuardLabel')}
                  hint={t('zone.removeGuardHint')}
                  value={mo.removeGuardIfHasOwner}
                  onChange={(v) => set(i, { removeGuardIfHasOwner: v })}
                />
              </div>
            </div>
            <div className="mo__group">
              <div className="mo__group-title">{t('zone.moGroupGarrison')}</div>
              <div className="mo__grid">
                <Num
                  label={t('zone.initialUnitIncrementLabel')}
                  min={0}
                  step={1}
                  hint={t('zone.initialUnitIncrementHint')}
                  value={mo.initialUnitIncrement}
                  onChange={(v) => set(i, { initialUnitIncrement: v })}
                />
                <TriSelect
                  label={t('zone.enableWeeklyUnitIncrementLabel')}
                  hint={t('zone.enableWeeklyUnitIncrementHint')}
                  value={mo.enableWeeklyUnitIncrement}
                  onChange={(v) => set(i, { enableWeeklyUnitIncrement: v })}
                />
                <TriSelect
                  label={t('zone.holdCityWinConLabel')}
                  hint={t('zone.holdCityWinConHint')}
                  value={mo.holdCityWinCon}
                  onChange={(v) => set(i, { holdCityWinCon: v })}
                />
                <TriSelect
                  label={t('zone.isKeyObjectLabel')}
                  hint={t('zone.isKeyObjectHint')}
                  value={mo.isKeyObject}
                  onChange={(v) => set(i, { isKeyObject: v })}
                />
              </div>
            </div>
          </div>
        </details>
      ))}
      <NewObject
        onAdd={(mo) => update({ mainObjects: [...(zone.mainObjects ?? []), mo] })}
      />
    </div>
  )
}

function BiomeEditor({
  label,
  hint,
  selector,
  onPatch,
  zones,
  mainObjectsOf,
}: {
  label: string
  hint?: string
  selector: BiomeSelector
  onPatch: (b: BiomeSelector) => void
  zones: string[]
  /** Главные объекты зоны-источника: без имени — текущая зона, с именем — зона из args[1]. */
  mainObjectsOf: (zoneName?: string) => MainObject[]
}) {
  const { t } = useTranslation()
  // Слаботипизированный файл: селектор биома (и его args) может отсутствовать —
  // показываем пустой FromList («любой»), первое же редактирование материализует поле.
  const sel: BiomeSelector = selector ?? { type: 'FromList', args: [] }
  const args = sel.args ?? []
  return (
    <div className="full">
      <span className="ef__label" title={hint}>
        {label}
      </span>
      <div className="mo__grid">
        <Select
          label={t('zone.biomeTypeLabel')}
          allowBlank={false}
          value={sel.type}
          onChange={(v) => onPatch({ type: v as BiomeSelector['type'], args })}
          options={[
            { value: 'MatchMainObject', label: t('zone.biomeTypes.MatchMainObject') },
            { value: 'FromList', label: t('zone.biomeTypes.FromList') },
            { value: 'MatchZone', label: t('zone.biomeTypes.MatchZone') },
          ]}
        />
        {sel.type === 'MatchZone' && (
          <Select
            label={t('zone.biomeZoneLabel')}
            blankLabel="—"
            hint={t('zone.biomeZoneHint')}
            value={args[0] ?? ''}
            onChange={(v) => onPatch({ ...sel, args: v ? [v] : [] })}
            options={zones.map((z) => ({ value: z }))}
          />
        )}
        {sel.type === 'MatchMainObject' && (
          <MainObjectRefFields
            args={args}
            onArgs={(next) => onPatch({ ...sel, args: next })}
            zones={zones}
            mainObjectsOf={mainObjectsOf}
            indexLabel={t('zone.biomeArgIndexLabel')}
            indexHint={t('zone.biomeArgIndexHint')}
            zoneLabel={t('zone.biomeArgZoneLabel')}
            zoneHint={t('zone.biomeArgZoneHint')}
          />
        )}
        {sel.type === 'FromList' && (
          <>
            <TermChips
              terms={BIOME_NAMES}
              selected={args}
              labelFor={(term) => t(`biomes.${term}`)}
              onToggle={(term, on) =>
                onPatch({
                  ...sel,
                  args: on
                    ? [...args.filter((a) => a !== term), term]
                    : args.filter((a) => a !== term),
                })
              }
            />
            <CommaList
              label={t('zone.restLabel')}
              value={args.filter((a) => !BIOME_NAMES.includes(a))}
              hint={t('zone.biomeRestHint')}
              placeholder="differentFrom: 0 Spawn-A"
              onChange={(rest) =>
                onPatch({ ...sel, args: [...args.filter((a) => BIOME_NAMES.includes(a)), ...rest] })
              }
            />
          </>
        )}
      </div>
    </div>
  )
}

/** Один ярус распределения реакции: Num + мини-бар веса. */
function ReactionRow({
  index,
  value,
  max,
  onCommit,
}: {
  index: number
  value: number
  max: number
  onCommit: (v: number | undefined) => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(String(value))
  const commit = () => {
    const raw = text.trim().replace(',', '.')
    if (raw === '') return onCommit(undefined)
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0) onCommit(Math.trunc(n))
    else setText(String(value))
  }
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="react-dist__row">
      <span className="react-dist__tier">{t('zone.tier', { n: index + 1 })}</span>
      <div className="react-dist__track">
        <div className="react-dist__fill" style={{ width: `${pct}%` }} />
      </div>
      <input
        className="input react-dist__num"
        type="number"
        inputMode="decimal"
        min={0}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </div>
  )
}

/** richer-UI для guardReactionDistribution: 6 ярусов с весами и суммой. */
function ReactionDistributionEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value?: number[]
  onChange: (v: number[] | undefined) => void
}) {
  const { t } = useTranslation()
  const weights = Array.from({ length: 6 }, (_, i) => value?.[i] ?? 0)
  const max = Math.max(...weights, 1)
  const total = weights.reduce((s, w) => s + w, 0)
  const setAt = (i: number, v: number | undefined) => {
    const next = [...weights]
    next[i] = v ?? 0
    onChange(next.every((w) => w === 0) ? undefined : next)
  }
  return (
    <div className="full">
      <div className="ef__label" title={t('zone.reactionTitle')}>
        {label} · {t('zone.tiers6')}
      </div>
      <div className="react-dist">
        {weights.map((w, i) => (
          <ReactionRow key={i} index={i} value={w} max={max} onCommit={(v) => setAt(i, v)} />
        ))}
        <div className="react-dist__sum">
          {t('zone.reactionSum', { total })}
          {total === 0 && <span className="hint"> · {t('fields.notSet')}</span>}
        </div>
      </div>
      <span className="hint full">{t('zone.reactionHint')}</span>
    </div>
  )
}

/** Число ярусов внешнего найма: random_hire_1..7 (формат ждёт массивы длины 7). */
const HIRE_TIERS = 7

function padHire<T>(arr: T[] | undefined, def: T): T[] {
  return Array.from({ length: HIRE_TIERS }, (_, i) => arr?.[i] ?? def)
}

/** Строка таблицы «Внешний найм»: ярус + начальный найм (число) + еженедельный прирост (флаг). */
function RandomHireRow({
  index,
  initial,
  weekly,
  initialDisabled,
  weeklyDisabled,
  onInitial,
  onWeekly,
}: {
  index: number
  initial?: number
  weekly?: boolean
  initialDisabled: boolean
  weeklyDisabled: boolean
  onInitial: (v: number) => void
  onWeekly: (v: boolean) => void
}) {
  const { t } = useTranslation()
  const canonical = String(initial ?? 0)
  const [text, setText] = useState(canonical)
  const [prevCanonical, setPrevCanonical] = useState(canonical)
  if (canonical !== prevCanonical) {
    setPrevCanonical(canonical)
    setText(canonical)
  }
  const commit = () => {
    const raw = text.trim().replace(',', '.')
    if (raw !== '') {
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 0) {
        onInitial(Math.trunc(n))
        return
      }
    }
    setText(canonical)
  }
  return (
    <div className="rh__row">
      <span className="rh__tier" title={`random_hire_${index + 1}`}>
        {t('zone.tier', { n: index + 1 })}
      </span>
      <input
        className="input rh__num"
        type="number"
        inputMode="numeric"
        min={0}
        disabled={initialDisabled}
        aria-label={`${t('zone.randomHireColInitial')} — ${t('zone.tier', { n: index + 1 })}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
      <input
        className="rh__check"
        type="checkbox"
        disabled={weeklyDisabled}
        aria-label={`${t('zone.randomHireColWeekly')} — ${t('zone.tier', { n: index + 1 })}`}
        checked={weekly ?? false}
        onChange={(e) => onWeekly(e.target.checked)}
      />
    </div>
  )
}

/**
 * richer-UI для randomHireInitialUnitIncrement / randomHireEnableWeeklyUnitIncrement:
 * таблица 7 ярусов (random_hire_1..7) × 2 колонки. Колонки включаются независимо:
 * включение записывает массив ровно из 7 значений, выключение — удаляет поле
 * (undefined). Массивы иной длины из файла видны как есть + предупреждение;
 * первая же правка нормализует длину до 7.
 */
export function RandomHireEditor({
  initial,
  weekly,
  onInitialChange,
  onWeeklyChange,
}: {
  initial?: number[]
  weekly?: boolean[]
  onInitialChange: (v: number[] | undefined) => void
  onWeeklyChange: (v: boolean[] | undefined) => void
}) {
  const { t } = useTranslation()
  const initialOn = initial !== undefined
  const weeklyOn = weekly !== undefined
  const [fillText, setFillText] = useState('')
  const fillNum = Number(fillText.trim().replace(',', '.'))
  const fillValid = fillText.trim() !== '' && Number.isFinite(fillNum) && fillNum >= 0
  const setInitialAt = (i: number, v: number) =>
    onInitialChange(padHire(initial, 0).map((x, j) => (j === i ? v : x)))
  const setWeeklyAt = (i: number, v: boolean) =>
    onWeeklyChange(padHire(weekly, false).map((x, j) => (j === i ? v : x)))
  const fillAll = () => {
    if (!fillValid) return
    onInitialChange(Array.from({ length: HIRE_TIERS }, () => Math.trunc(fillNum)))
  }
  const lenWarn = (arr: unknown[] | undefined, field: string) =>
    arr !== undefined && arr.length !== HIRE_TIERS
      ? t('zone.randomHireLenWarn', { field, n: arr.length })
      : null
  const warnInitial = lenWarn(initial, t('zone.randomHireColInitial'))
  const warnWeekly = lenWarn(weekly, t('zone.randomHireColWeekly'))
  return (
    <div className="rh full">
      <div className="rh__toggles">
        <label className="rh__toggle">
          <input
            type="checkbox"
            checked={initialOn}
            onChange={(e) =>
              onInitialChange(e.target.checked ? Array.from({ length: HIRE_TIERS }, () => 0) : undefined)
            }
          />
          {t('zone.randomHireColInitial')}
        </label>
        <label className="rh__toggle">
          <input
            type="checkbox"
            checked={weeklyOn}
            onChange={(e) =>
              onWeeklyChange(e.target.checked ? Array.from({ length: HIRE_TIERS }, () => false) : undefined)
            }
          />
          {t('zone.randomHireColWeekly')}
        </label>
      </div>
      {(warnInitial || warnWeekly) && (
        <span className="rh__warn">{[warnInitial, warnWeekly].filter(Boolean).join(' · ')}</span>
      )}
      <div className="rh__row rh__row--head">
        <span />
        <span className="rh__colhead">{t('zone.randomHireHeadInitial')}</span>
        <span className="rh__colhead">{t('zone.randomHireHeadWeekly')}</span>
      </div>
      {Array.from({ length: HIRE_TIERS }, (_, i) => (
        <RandomHireRow
          key={i}
          index={i}
          initial={initial?.[i]}
          weekly={weekly?.[i]}
          initialDisabled={!initialOn}
          weeklyDisabled={!weeklyOn}
          onInitial={(v) => setInitialAt(i, v)}
          onWeekly={(v) => setWeeklyAt(i, v)}
        />
      ))}
      {initialOn && (
        <div className="rh__bulk">
          <input
            className="input rh__bulk-num"
            type="number"
            inputMode="numeric"
            min={0}
            aria-label={t('zone.randomHireFillAll')}
            placeholder={t('zone.randomHireFillAll')}
            value={fillText}
            onChange={(e) => setFillText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fillAll()
            }}
          />
          <button className="btn" disabled={!fillValid} onClick={fillAll}>
            {t('zone.randomHireApply')}
          </button>
        </div>
      )}
      {weeklyOn && (
        <div className="rh__bulk">
          <button
            className="btn"
            onClick={() => onWeeklyChange(Array.from({ length: HIRE_TIERS }, () => true))}
          >
            {t('zone.randomHireAllOn')}
          </button>
          <button
            className="btn"
            onClick={() => onWeeklyChange(Array.from({ length: HIRE_TIERS }, () => false))}
          >
            {t('zone.randomHireAllOff')}
          </button>
        </div>
      )}
    </div>
  )
}

export function ZoneEditor({ zone }: { zone: Zone }) {
  const { t } = useTranslation()
  const patch = useEditorStore((s) => s.patchZone)
  const renameZone = useEditorStore((s) => s.renameZone)
  const setZoneNote = useEditorStore((s) => s.setZoneNote)
  const note = useEditorStore((s) => s.notes[zone.name])
  const [nameTick, setNameTick] = useState(0)
  const [nameError, setNameError] = useState<string | null>(null)
  const zoneNames = useEditorStore(
    useShallow((s) => s.template.variants[s.activeVariant]?.zones.map((z) => z.name) ?? []),
  )
  // Главные объекты всех зон варианта — для дропдауна «Главный объект» биомов:
  // при заданной args[1]-зоне индекс указывает на объект ЧУЖОЙ зоны.
  const zoneMainObjects = useEditorStore(
    useShallow((s) => {
      const map: Record<string, MainObject[]> = {}
      for (const z of s.template.variants[s.activeVariant]?.zones ?? []) map[z.name] = z.mainObjects ?? NO_MAIN_OBJECTS
      return map
    }),
  )
  const mainObjectsOf = (zoneName?: string) =>
    zoneName == null || zoneName === '' ? zone.mainObjects ?? NO_MAIN_OBJECTS : zoneMainObjects[zoneName] ?? NO_MAIN_OBJECTS
  const layouts = useEditorStore(
    useShallow((s) =>
      (s.template.zoneLayouts ?? []).filter(
        (l): l is ZoneLayout =>
          !!l &&
          typeof l === 'object' &&
          typeof (l as ZoneLayout).name === 'string' &&
          (l as ZoneLayout).name !== '',
      ),
    ),
  )
  const connIds = useEditorStore(
    useShallow((s) =>
      (s.template.variants[s.activeVariant]?.connections ?? []).map((c) => c.name ?? `${c.from}-${c.to}`),
    ),
  )
  const mcItemNames = useEditorStore(
    useShallow((s) => {
      const names: string[] = []
      const seen = new Set<string>()
      for (const g of s.template.mandatoryContent ?? []) {
        const items = g.content
        if (!Array.isArray(items)) continue
        for (const it of items) {
          if (typeof it.name === 'string' && it.name && !seen.has(it.name)) {
            seen.add(it.name)
            names.push(it.name)
          }
        }
      }
      return names
    }),
  )
  const update = (p: Partial<Zone>) => patch(zone.name, p)

  const updateEncounterHoles = (p: Partial<EncounterHolesSettings>) => {
    const next = { ...(zone.encounterHolesSettings ?? {}), ...p }
    update({ encounterHolesSettings: next.affectedEncounters === undefined && next.twoHoleEncounters === undefined ? undefined : next })
  }

  const pct = (v: number) => `${Math.round(v * 100)}%`
  // Сводка «Внешнего найма» для свёрнутой секции: «нач.: 3×7 · еженед.: все».
  const hireSummary = (() => {
    const parts: string[] = []
    const ini = zone.randomHireInitialUnitIncrement
    if (ini !== undefined) {
      const uniform = ini.length === HIRE_TIERS && ini.every((v) => v === ini[0])
      parts.push(
        t('zone.randomHireSumInitial', { v: uniform ? `${ini[0]}×${HIRE_TIERS}` : ini.join(',') }),
      )
    }
    const wk = zone.randomHireEnableWeeklyUnitIncrement
    if (wk !== undefined) {
      const k = wk.filter(Boolean).length
      parts.push(
        t('zone.randomHireSumWeekly', {
          v:
            wk.length === HIRE_TIERS && k === HIRE_TIERS
              ? t('zone.randomHireWeeklyAll')
              : t('zone.randomHireWeeklySome', { k }),
        }),
      )
    }
    return parts.length > 0 ? parts.join(' · ') : t('fields.notSet')
  })()
  const layoutOption = (l: ZoneLayout) => {
    const parts: string[] = []
    if (typeof l.obstaclesFill === 'number') parts.push(t('zone.layoutSumObstacles', { v: pct(l.obstaclesFill) }))
    if (typeof l.lakesFill === 'number') parts.push(t('zone.layoutSumLakes', { v: pct(l.lakesFill) }))
    const modes = l.elevationModes ?? []
    if (modes.length > 0) {
      const active = modes.filter((m) => (m?.weight ?? 0) > 0)
      parts.push(active.length > 0 ? t('zone.layoutSumElev', { count: active.length }) : t('zone.layoutSumElevFlat'))
    }
    const sum = parts.length > 0 ? parts.join(' · ') : t('zone.layoutSumEmpty')
    return { value: l.name, label: `${l.name} — ${sum}` }
  }

  return (
    <div className="editor">
      <Section title={t('zone.sectionLayout')} open persistKey="zone.layout">
        <Text
          key={`zone-name-${zone.name}-${nameTick}`}
          label={t('zone.nameLabel')}
          value={zone.name}
          hint={
            nameError ??
            t('zone.nameHint')
          }
          onChange={(v) => {
            const next = v.trim()
            if (next === zone.name) {
              setNameError(null)
              return
            }
            if (!next) {
              setNameError(t('zone.nameEmptyError'))
              setNameTick((n) => n + 1)
              return
            }
            if (renameZone(zone.name, next)) {
              setNameError(null)
            } else {
              setNameError(t('zone.nameTakenError', { name: next }))
              setNameTick((n) => n + 1)
            }
          }}
        />
        <Num
          label={t('zone.sizeLabel')}
          min={0.15}
          max={2}
          step={0.05}
          hint={t('zone.sizeHint')}
          value={zone.size}
          onChange={(v) => update({ size: v ?? 0.9 })}
        />
        <Select
          label={t('zone.layoutLabel')}
          allowBlank={false}
          hint={t('zone.layoutHint')}
          value={zone.layout}
          onChange={(v) => update({ layout: v })}
          options={layouts.map(layoutOption)}
        />
        <Num
          label={t('zone.crossroadsLabel')}
          min={0}
          max={1}
          step={0.05}
          hint={t('zone.crossroadsHint')}
          value={zone.crossroadsPosition}
          onChange={(v) => update({ crossroadsPosition: v })}
        />
      </Section>

      <Section title={t('zone.sectionBudgets')} open persistKey="zone.budgets">
        <Num label={t('zone.guardedBudgetLabel')} hint={t('zone.guardedBudgetHint')} step={1000} value={zone.guardedContentValue} onChange={(v) => update({ guardedContentValue: v })} />
        <Num label={t('zone.guardedBudgetAreaLabel')} hint={t('zone.guardedBudgetAreaHint')} step={1000} value={zone.guardedContentValuePerArea} onChange={(v) => update({ guardedContentValuePerArea: v })} />
        <Num label={t('zone.unguardedBudgetLabel')} hint={t('zone.unguardedBudgetHint')} step={1000} value={zone.unguardedContentValue} onChange={(v) => update({ unguardedContentValue: v })} />
        <Num label={t('zone.unguardedBudgetAreaLabel')} hint={t('zone.unguardedBudgetAreaHint')} step={1000} value={zone.unguardedContentValuePerArea} onChange={(v) => update({ unguardedContentValuePerArea: v })} />
        <Num label={t('zone.resourcesBudgetLabel')} hint={t('zone.resourcesBudgetHint')} step={1000} value={zone.resourcesValue} onChange={(v) => update({ resourcesValue: v })} />
        <Num label={t('zone.resourcesBudgetAreaLabel')} hint={t('zone.resourcesBudgetAreaHint')} step={1000} value={zone.resourcesValuePerArea} onChange={(v) => update({ resourcesValuePerArea: v })} />
        <div className="hint full">{t('zone.budgetsHint')}</div>
      </Section>

      <Section title={t('zone.sectionPools')} persistKey="zone.pools">
        <PoolListEditor
          label={t('zone.poolGuardedLabel')}
          placeholder="template_pool_…"
          value={zone.guardedContentPool}
          onChange={(v) => update({ guardedContentPool: v })}
        />
        <PoolListEditor
          label={t('zone.poolUnguardedLabel')}
          placeholder="template_pool_…"
          value={zone.unguardedContentPool}
          onChange={(v) => update({ unguardedContentPool: v })}
        />
        <PoolListEditor
          label={t('zone.poolResourcesLabel')}
          placeholder="content_pool_…"
          value={zone.resourcesContentPool}
          onChange={(v) => update({ resourcesContentPool: v })}
        />
      </Section>

      <Section title={t('zone.sectionGuards')} open persistKey="zone.guards">
        <Num label={t('zone.guardCutoffLabel')} hint={t('zone.guardCutoffHint')} step={100} value={zone.guardCutoffValue} onChange={(v) => update({ guardCutoffValue: v })} />
        <Num label={t('zone.guardMultiplierLabel')} hint={t('zone.guardMultiplierHint')} min={0} max={10} step={0.1} value={zone.guardMultiplier} onChange={(v) => update({ guardMultiplier: v })} />
        <Num label={t('zone.guardRandomizationLabel')} hint={t('zone.guardRandomizationHint')} min={0} max={1} step={0.05} value={zone.guardRandomization} onChange={(v) => update({ guardRandomization: v })} />
        <Num label={t('zone.guardWeeklyIncrementLabel')} hint={t('zone.guardWeeklyIncrementHint')} step={0.05} value={zone.guardWeeklyIncrement} onChange={(v) => update({ guardWeeklyIncrement: v })} />
        <ReactionDistributionEditor
          label={t('zone.reactionDistLabel')}
          value={zone.guardReactionDistribution}
          onChange={(v) => update({ guardReactionDistribution: v })}
        />
        <Num label={t('zone.diplomacyLabel')} hint={t('zone.diplomacyHint')} step={0.05} value={zone.diplomacyModifier} onChange={(v) => update({ diplomacyModifier: v })} />
      </Section>

      <Section
        title={t('zone.sectionRandomHire')}
        collapsedHint={hireSummary}
        persistKey="zone.randomHire"
      >
        <div className="hint full">
          {t('zone.randomHireHint')}
        </div>
        <RandomHireEditor
          initial={zone.randomHireInitialUnitIncrement}
          weekly={zone.randomHireEnableWeeklyUnitIncrement}
          onInitialChange={(v) => update({ randomHireInitialUnitIncrement: v })}
          onWeeklyChange={(v) => update({ randomHireEnableWeeklyUnitIncrement: v })}
        />
      </Section>

      <Section title={t('zone.sectionHoles')} persistKey="zone.holes">
        <div className="hint full">
          {t('zone.holesHint')}
        </div>
        <Num
          label={t('zone.affectedEncountersLabel')}
          hint={t('zone.affectedEncountersHint')}
          min={0}
          max={1}
          step={0.01}
          value={zone.encounterHolesSettings?.affectedEncounters}
          onChange={(v) => updateEncounterHoles({ affectedEncounters: v })}
        />
        <Num
          label={t('zone.twoHoleEncountersLabel')}
          hint={t('zone.twoHoleEncountersHint')}
          min={0}
          max={1}
          step={0.01}
          value={zone.encounterHolesSettings?.twoHoleEncounters}
          onChange={(v) => updateEncounterHoles({ twoHoleEncounters: v })}
        />
      </Section>

      <Section title={t('zone.sectionBiomes')} persistKey="zone.biomes">
        <BiomeEditor label={t('zone.zoneBiomeLabel')} hint={t('zone.zoneBiomeHint')} selector={zone.zoneBiome} zones={zoneNames} mainObjectsOf={mainObjectsOf} onPatch={(b) => update({ zoneBiome: b })} />
        <BiomeEditor label={t('zone.contentBiomeLabel')} hint={t('zone.contentBiomeHint')} selector={zone.contentBiome} zones={zoneNames} mainObjectsOf={mainObjectsOf} onPatch={(b) => update({ contentBiome: b })} />
        <BiomeEditor label={t('zone.metaObjectsBiomeLabel')} hint={t('zone.metaObjectsBiomeHint')} selector={zone.metaObjectsBiome} zones={zoneNames} mainObjectsOf={mainObjectsOf} onPatch={(b) => update({ metaObjectsBiome: b })} />
      </Section>

      <Section
        title={t('zone.sectionMandatory')}
        persistKey="zone.mandatory"
        collapsedHint={t('zone.sectionMandatorySum', {
          mc: zone.mandatoryContent?.length ?? 0,
          cl: zone.contentCountLimits?.length ?? 0,
        })}
      >
        <GroupRefList label={t('zone.mandatoryContentLabel')} hint={t('zone.mandatoryContentHint')} kind="mc" value={zone.mandatoryContent} onChange={(v) => update({ mandatoryContent: v })} />
        <GroupRefList label={t('zone.contentCountLimitsLabel')} hint={t('zone.contentCountLimitsHint')} kind="cl" value={zone.contentCountLimits} onChange={(v) => update({ contentCountLimits: v })} />
      </Section>

      <Section title={t('zone.sectionMainObjects', { n: zone.mainObjects?.length ?? 0 })} persistKey="zone.mainObjects">
        <MainObjectsEditor zone={zone} update={update} zones={zoneNames} mainObjectsOf={mainObjectsOf} />
      </Section>

      <Section title={t('zone.sectionRoads', { n: zone.roads?.length ?? 0 })} persistKey="zone.roads">
        <RoadsEditor
          roads={zone.roads ?? []}
          mainObjects={zone.mainObjects ?? []}
          connIds={connIds}
          mcItemNames={mcItemNames}
          onPatch={update}
        />
      </Section>

      <Section title={t('zone.sectionNotes')} persistKey="zone.notes">
        <NoteArea
          value={note}
          onChange={(v) => setZoneNote(zone.name, v)}
          placeholder={t('zone.notesPlaceholder')}
          hint={t('zone.notesHint')}
        />
      </Section>
    </div>
  )
}