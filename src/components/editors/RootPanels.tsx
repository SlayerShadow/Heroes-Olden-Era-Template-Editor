import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../store/editorStore'
import { sidHint, sidNameLang, sidOptions, type SidNameLang } from '../../data/sidCatalog'
import { ConfirmDialog } from '../ConfirmDialog'
import { RulesEditor } from './McRulesEditor'
import type {
  ContentCountLimit,
  ContentCountLimitGroup,
  MandatoryContentGroup,
  MandatoryContentItem,
  McContentVariant,
  McRuleType,
} from '../../types/rmg'
import { CommaList, ComboInput, Label, Num, Select, Text, TriSelect, type ComboSuggestion } from './fields'
import { humanPoolName } from '../pools/tagLabels'

const RULE_TYPE_OPTIONS: McRuleType[] = ['Road', 'MainObject', 'Crossroads', 'Sid', 'Connection']

const PLAYER_OPTIONS = Array.from({ length: 8 }, (_, i) => ({
  value: `Player${i + 1}`,
  label: `Player ${i + 1}`,
}))

function newItem(): MandatoryContentItem {
  return {
    sid: 'random_item_legendary',
    isGuarded: true,
    isMine: false,
    rules: [{ type: 'Road', args: [], targetMin: 0, targetMax: 0.4, weight: 1 }],
  }
}

function newVariant(): McContentVariant {
  return { sid: 'pandora_box' }
}

function newLimit(): ContentCountLimit {
  return { sid: 'pandora_box', variant: -1, maxCount: 1 }
}

/**
 * Пара подписей для summary: читаемое имя основным, сырой ключ вторичным
 * (паттерн PoolBrowser). secondary=undefined — имя неизвестно, показываем сырой ключ.
 */
function sidLabelParts(sid: string, lang: SidNameLang): { main: string; secondary?: string } {
  const main = sidHint(sid, lang) ?? sid
  return { main, secondary: main === sid ? undefined : sid }
}

/** Полный текст tooltip'а: main, затем secondary через «·». */
function labelTitle(main: string, secondary?: string): string {
  return secondary ? `${main} · ${secondary}` : main
}

export function SidText({
  label,
  value,
  hint,
  suggestions,
  onChange,
  showHint,
  sub,
}: {
  label: string
  value?: string
  hint?: string
  /** Подсказки выпадающего списка ComboInput (вместо нативного datalist). */
  suggestions: ComboSuggestion[]
  onChange: (v: string | undefined) => void
  /** Показывать hint (локализованное имя) видимой подписью у поля, а не только tooltip'ом. */
  showHint?: boolean
  /** Явная подпись у label (читаемое имя); по умолчанию — hint при showHint. */
  sub?: string
}) {
  const [text, setText] = useState(value ?? '')
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(value ?? '')
  }
  const commit = (v: string) => onChange(v.trim() || undefined)
  const autoSub = showHint && hint && hint !== value ? hint : undefined
  return (
    <Label label={label} hint={hint} sub={sub ?? autoSub}>
      <ComboInput text={text} onText={setText} onCommit={commit} suggestions={suggestions} />
    </Label>
  )
}

function VariantsEditor({
  value,
  onChange,
  showWeight = true,
}: {
  value: McContentVariant[]
  onChange: (v: McContentVariant[]) => void
  showWeight?: boolean
}) {
  const patch = (i: number, p: Partial<McContentVariant>) =>
    onChange(value.map((v, j) => (j === i ? { ...v, ...p } : v)))
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  const sidOpts = sidOptions(lang)
  return (
    <div className="full">
      <span className="ef__label">{t('rootPanels.variantsTitle')}</span>
      {value.map((cv, i) => (
        <div key={i} className="mc-rule">
          <div className="full mc-rule__head">
            <span>{t('rootPanels.variantItem', { n: i + 1 })}</span>
            <button type="button" className="icon-btn" onClick={() => onChange(value.filter((_, j) => j !== i))} title={t('rootPanels.variantDeleteTitle')}>
              <X size={12} />
            </button>
          </div>
          <SidText label={t('rootPanels.sidLabel')} value={cv.sid} hint={sidHint(cv.sid, lang)} suggestions={sidOpts} onChange={(v) => patch(i, { sid: v })} />
          <Num
            label={t('rootPanels.variantLabel')}
            hint={t('rootPanels.variantHint')}
            value={cv.variant}
            onChange={(v) => patch(i, { variant: v })}
          />
          {showWeight && (
            <Num
              label={t('rootPanels.weightLabel')}
              hint={t('rootPanels.weightHint')}
              step={1}
              value={cv.weight}
              onChange={(v) => patch(i, { weight: v })}
            />
          )}
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...value, newVariant()])}>
        <Plus size={12} /> {t('rootPanels.addVariant')}
      </button>
    </div>
  )
}

function ItemCard({
  item,
  onPatch,
  onDelete,
}: {
  item: MandatoryContentItem
  onPatch: (item: MandatoryContentItem) => void
  onDelete: () => void
}) {
  const sync = (p: Partial<MandatoryContentItem>) => onPatch({ ...item, ...p })
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  const sid = item.sid
  const isChoice = !sid
  const list0 = item.includeLists?.[0]
  // Читаемое имя — основная подпись, сырой ключ (sid / имя пула) — вторичная.
  let main: string
  let secondary: string | undefined
  if (sid) {
    ;({ main, secondary } = sidLabelParts(sid, lang))
  } else if (list0 != null) {
    const multi = (item.includeLists?.length ?? 0) > 1
    const human = humanPoolName(list0, t, lang)
    main = human ?? list0
    if (multi) main += ' …'
    secondary = human ? list0 : undefined
  } else {
    main = t('rootPanels.choiceLabel')
  }
  const title = labelTitle(main, secondary)

  return (
    <details className="mo mc-item">
      <summary>
        <span className="mc-item__kind">{isChoice ? t('rootPanels.kindChoice') : t('rootPanels.kindObject')}</span>
        <span className="mc-item__label" title={title}>
          {main}
          {secondary && <span className="mc-item__sid">{secondary}</span>}
        </span>
        {item.isMine === true && (
          <span className="mo__spawn" style={{ background: 'rgba(212,175,55,0.25)' }}>
            {t('rootPanels.mineBadge')}
          </span>
        )}
        <span className="mo__hint">{t('rootPanels.rulesCount', { n: item.rules?.length ?? 0 })}</span>
        <button
          type="button"
          className="mo__del"
          onClick={(e) => {
            e.preventDefault()
            onDelete()
          }}
          title={t('rootPanels.itemDeleteTitle')}
        >
          ✕
        </button>
      </summary>
      <div className="mo__grid">
        <SidText label={t('rootPanels.sidLabel')} value={item.sid} hint={sidHint(item.sid, lang)} suggestions={sidOptions(lang)} onChange={(v) => sync({ sid: v })} showHint />
        <Text
          label={t('rootPanels.nameLabel')}
          hint={t('rootPanels.nameHint')}
          value={item.name}
          onChange={(v) => sync({ name: v || undefined })}
        />
        <Num label={t('rootPanels.variantLabel')} hint={t('rootPanels.variantHint')} value={item.variant} onChange={(v) => sync({ variant: v })} />
        <TriSelect label={t('rootPanels.mineLabel')} hint={t('rootPanels.mineHint')} value={item.isMine} onChange={(v) => sync({ isMine: v })} />
        <TriSelect label={t('rootPanels.guardedLabel')} hint={t('rootPanels.guardedHint')} value={item.isGuarded} onChange={(v) => sync({ isGuarded: v })} />
        <TriSelect label={t('rootPanels.noRoadLabel')} hint={t('rootPanels.noRoadHint')} value={item.road} onChange={(v) => sync({ road: v })} />
        <TriSelect label={t('rootPanels.soloLabel')} hint={t('rootPanels.soloHint')} value={item.soloEncounter} onChange={(v) => sync({ soloEncounter: v })} />
        <TriSelect label={t('rootPanels.designatedLabel')} hint={t('rootPanels.designatedHint')} value={item.designatedEncounter} onChange={(v) => sync({ designatedEncounter: v })} />
        <Select
          label={t('rootPanels.ownerLabel')}
          blankLabel="—"
          value={item.owner}
          onChange={(v) => sync({ owner: v || undefined })}
          options={PLAYER_OPTIONS}
        />
        <Num label={t('rootPanels.guardValueLabel')} hint={t('rootPanels.guardValueHint')} step={100} value={item.guardValue} onChange={(v) => sync({ guardValue: v })} />
        <CommaList
          label={t('rootPanels.listsLabel')}
          hint={t('rootPanels.listsHint')}
          placeholder="basic_content_list_..."
          value={item.includeLists}
          onChange={(v) => sync({ includeLists: v.length > 0 ? v : undefined })}
        />
        <VariantsEditor
          value={item.content ?? []}
          onChange={(content) => sync({ content: content.length > 0 ? content : undefined })}
        />
        <RulesEditor value={item.rules ?? []} onChange={(rules) => sync({ rules: rules.length > 0 ? rules : undefined })} label={t('rootPanels.rulesLabel')} typeOptions={RULE_TYPE_OPTIONS} />
      </div>
    </details>
  )
}

/** Время подсветки группы-цели при переходе из инспектора зоны, мс. */
export const GROUP_FLASH_MS = 1500

/** id якоря карточки корневой группы: mcg-<имя> / clg-<имя>. */
function groupAnchorId(kind: 'mc' | 'cl', name: string): string {
  return `${kind === 'mc' ? 'mcg' : 'clg'}-${name}`
}

function GroupCard({
  group,
  kind,
  children,
  summaryExtra,
  refCount,
  onDelete,
}: {
  group: MandatoryContentGroup | ContentCountLimitGroup
  kind: 'mc' | 'cl'
  children: React.ReactNode
  summaryExtra: React.ReactNode
  /** Число зон, ссылающихся на группу (для текста подтверждения удаления). */
  refCount: number
  onDelete: () => void
}) {
  const rename = useEditorStore((s) =>
    kind === 'mc' ? s.renameMandatoryGroup : s.renameContentLimitGroup,
  )
  const target = useEditorStore((s) => s.groupTarget)
  const clearTarget = useEditorStore((s) => s.clearGroupTarget)
  const { t } = useTranslation()
  const [nameText, setNameText] = useState(group.name)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const anchorId = groupAnchorId(kind, group.name)
  // Эта карточка — цель навигации «зона → группа». Подсветка
  // выводится из запроса стора, а не из локального state: запрос гаснет по
  // таймеру (эффект ниже) — и класс гаснет вместе с ним, без setState в effect.
  const isTarget = target !== null && target.kind === kind && target.name === group.name

  // Навигация зона→группа: карточка-цель раскрывается и
  // прокручивается в вид. Вкладка переключается тем же действием стора
  // (goToGroup), поэтому эффект срабатывает уже при монтировании панели.
  // Запрос гасится через GROUP_FLASH_MS — повторный вход во вкладку не
  // прокручивает; новый переход к той же группе (seq вырос) прокручивает снова.
  useEffect(() => {
    if (!target || !isTarget) return
    const el = document.getElementById(anchorId)
    // Цель могла быть свёрнута пользователем — раскрываем (React-проп open и так true).
    if (el instanceof HTMLDetailsElement) el.open = true
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const timer = window.setTimeout(clearTarget, GROUP_FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [target, isTarget, anchorId, clearTarget])

  // Текст подтверждения: состав группы (элементы/лимиты) и число ссылающихся зон.
  const itemCount = 'content' in group ? group.content.length : group.limits.length
  const deleteMessage =
    kind === 'mc'
      ? t('rootPanels.groupDeleteConfirmMc', { name: group.name, items: itemCount, zones: refCount })
      : t('rootPanels.groupDeleteConfirmCl', { name: group.name, limits: itemCount, zones: refCount })

  return (
    <>
      <details className={isTarget ? 'mc-group mc-group--flash' : 'mc-group'} id={anchorId} open>
        <summary>
          <span className="mc-group__tag">{kind === 'mc' ? 'MC' : 'CC'}</span>
          <input
            className="input mc-group__name"
            value={nameText}
            title={t('rootPanels.groupNameTitle')}
            onChange={(e) => setNameText(e.target.value)}
            onBlur={() => rename(group.name, nameText)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
          />
          {summaryExtra}
          <button
            type="button"
            className="mo__del"
            onClick={(e) => {
              // preventDefault — клик по содержимому <summary> не должен сворачивать группу.
              e.preventDefault()
              setConfirmOpen(true)
            }}
            title={t('rootPanels.groupDeleteTitle')}
          >
            ✕
          </button>
        </summary>
        <div className="mc-group__body">{children}</div>
      </details>
      <ConfirmDialog
        open={confirmOpen}
        title={t('rootPanels.groupDeleteConfirmTitle')}
        message={deleteMessage}
        confirmLabel={t('confirm.delete')}
        cancelLabel={t('confirm.cancel')}
        hint={t('confirm.deleteHint')}
        danger
        onConfirm={() => {
          setConfirmOpen(false)
          onDelete()
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

/**
 * Уникальные имена зон (по всем вариантам), ссылающихся на группу по имени.
 * Имена групп — произвольные авторские идентификаторы: зоны ссылаются
 * на них точным совпадением строки, поэтому список зон — проверяемый факт,
 * а не догадка о смысле имени.
 */
function refZoneNames(
  variants: Array<{
    zones: Array<{ name?: unknown; mandatoryContent?: unknown; contentCountLimits?: unknown }>
  }>,
  key: 'mandatoryContent' | 'contentCountLimits',
  name: string,
): string[] {
  const out: string[] = []
  for (const v of variants) {
    for (const z of v.zones) {
      const refs = z[key]
      const zname = z.name
      if (
        typeof zname === 'string' &&
        Array.isArray(refs) &&
        (refs as unknown as string[]).includes(name) &&
        !out.includes(zname)
      ) {
        out.push(zname)
      }
    }
  }
  return out
}

/** Кликабельные ссылки группы на зоны: клик — переход к зоне (навигация группа→зоны). */
function ZoneRefs({ names }: { names: string[] }) {
  const select = useEditorStore((s) => s.select)
  const { t } = useTranslation()
  if (names.length === 0) return null
  return (
    <span className="mc-group__zones">
      {names.map((z) => (
        <button
          key={z}
          type="button"
          className="mc-group__zone"
          title={t('rootPanels.zoneRefTitle', { zone: z })}
          onClick={(e) => {
            // Клик по содержимому <summary> свернул бы группу — гасим действие по умолчанию.
            e.preventDefault()
            e.stopPropagation()
            select('zone', z)
          }}
        >
          {z}
        </button>
      ))}
    </span>
  )
}

export function MandatoryContentPanel() {
  const groups = useEditorStore((s) => s.template.mandatoryContent)
  const variants = useEditorStore((s) => s.template.variants)
  const patchRoot = useEditorStore((s) => s.patchRoot)
  const deleteGroup = useEditorStore((s) => s.deleteMandatoryGroup)
  const { t } = useTranslation()
  const lines = groups ?? []

  const setGroups = (next: MandatoryContentGroup[]) => patchRoot({ mandatoryContent: next })

  const addGroup = () => {
    let i = 1
    const used = new Set(lines.map((g) => g.name))
    let name = `group_${lines.length + i}`
    while (used.has(name)) {
      i++
      name = `group_${lines.length + i}`
    }
    setGroups([...lines, { name, content: [] }])
  }

  return (
    <div className="rootpanel">
      <div className="rootpanel__bar">
        <span className="rootpanel__title">{t('rootPanels.panelMcTitle')}</span>
          <button type="button" className="btn" onClick={addGroup}>
            <Plus size={12} /> {t('rootPanels.addGroup')}
          </button>
        </div>
        <div className="hint">{t('rootPanels.mcHint')}</div>
        <div className="hint">{t('rootPanels.mcNamesNote')}</div>
        {lines.length === 0 && <div className="rootpanel__empty">{t('rootPanels.emptyGroups')}</div>}
        {lines.map((g, i) => {
          const refs = refZoneNames(variants, 'mandatoryContent', g.name)
          return (
            <GroupCard
              key={g.name}
              group={g}
              kind="mc"
              refCount={refs.length}
              onDelete={() => deleteGroup(g.name)}
              summaryExtra={
                <>
                  <span className="mc-group__count">
                    {t('rootPanels.mcCount', { items: g.content.length, zones: refs.length })}
                  </span>
                  <ZoneRefs names={refs} />
                </>
              }
            >
            {g.content.map((item, ii) => (
              <ItemCard
                key={ii}
                item={item}
                onPatch={(next) =>
                  setGroups(lines.map((x, j) => (j === i ? { ...x, content: x.content.map((y, k) => (k === ii ? next : y)) } : x)))
                }
                onDelete={() =>
                  setGroups(lines.map((x, j) => (j === i ? { ...x, content: x.content.filter((_, k) => k !== ii) } : x)))
                }
              />
            ))}
            <button
              type="button"
              className="btn"
              onClick={() =>
                setGroups(lines.map((x, j) => (j === i ? { ...x, content: [...x.content, newItem()] } : x)))
              }
            >
              <Plus size={12} /> {t('rootPanels.addObject')}
            </button>
            </GroupCard>
          )
        })}
      </div>
  )
}

function LimitCard({
  limit,
  onPatch,
  onDelete,
}: {
  limit: ContentCountLimit
  onPatch: (limit: ContentCountLimit) => void
  onDelete: () => void
}) {
  const sync = (p: Partial<ContentCountLimit>) => onPatch({ ...limit, ...p })
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  const sid = limit.sid
  const isGroup = !sid
  const list0 = limit.includeLists?.[0]
  // Читаемое имя — основная подпись, сырой ключ (sid / имя списка) — вторичная.
  let main: string
  let secondary: string | undefined
  if (sid) {
    ;({ main, secondary } = sidLabelParts(sid, lang))
  } else if (list0 != null) {
    const human = humanPoolName(list0, t, lang)
    main = t('rootPanels.limitGroupLabel', { list: human ?? list0 })
    secondary = human ? list0 : undefined
  } else {
    main = t('rootPanels.limitGroupType')
  }
  const title = labelTitle(main, secondary)

  return (
    <details className="mo mc-item">
      <summary>
        <span className="mc-item__kind">{isGroup ? t('rootPanels.kindGroup') : 'sid'}</span>
        <span className="mc-item__label" title={title}>
          {main}
          {secondary && <span className="mc-item__sid">{secondary}</span>}
        </span>
        <span className="mo__hint">max {limit.maxCount}</span>
        <button
          type="button"
          className="mo__del"
          onClick={(e) => {
            e.preventDefault()
            onDelete()
          }}
          title={t('rootPanels.limitDeleteTitle')}
        >
          ✕
        </button>
      </summary>
      <div className="mo__grid">
        <SidText label={t('rootPanels.sidLabel')} value={limit.sid} hint={sidHint(limit.sid, lang)} suggestions={sidOptions(lang)} onChange={(v) => sync({ sid: v })} showHint />
        <Num label={t('rootPanels.variantLabel')} hint={t('rootPanels.variantHintAll')} value={limit.variant} onChange={(v) => sync({ variant: v })} />
        <Num label={t('rootPanels.maxCountLabel')} hint={t('rootPanels.maxCountHint')} min={0} value={limit.maxCount} onChange={(v) => sync({ maxCount: v ?? 0 })} />
        <CommaList
          label={t('rootPanels.listsLabel')}
          hint={t('rootPanels.limitListsHint')}
          value={limit.includeLists}
          onChange={(v) => sync({ includeLists: v.length > 0 ? v : undefined })}
        />
        <VariantsEditor
          value={limit.content ?? []}
          onChange={(content) => sync({ content: content.length > 0 ? content : undefined })}
          showWeight={false}
        />
      </div>
    </details>
  )
}

export function ContentLimitsPanel() {
  const groups = useEditorStore((s) => s.template.contentCountLimits)
  const variants = useEditorStore((s) => s.template.variants)
  const patchRoot = useEditorStore((s) => s.patchRoot)
  const deleteGroup = useEditorStore((s) => s.deleteContentLimitGroup)
  const { t } = useTranslation()
  const lines = groups ?? []

  const setGroups = (next: ContentCountLimitGroup[]) => patchRoot({ contentCountLimits: next })

  const addGroup = () => {
    let i = 1
    const used = new Set(lines.map((g) => g.name))
    let name = `content_limits_${lines.length + i}`
    while (used.has(name)) {
      i++
      name = `content_limits_${lines.length + i}`
    }
    setGroups([...lines, { name, limits: [] }])
  }

  return (
    <div className="rootpanel">
      <div className="rootpanel__bar">
          <span className="rootpanel__title">{t('rootPanels.panelClTitle')}</span>
          <button type="button" className="btn" onClick={addGroup}>
            <Plus size={12} /> {t('rootPanels.addGroup')}
          </button>
        </div>
        <div className="hint">{t('rootPanels.clHint')}</div>
        <div className="hint">{t('rootPanels.clNamesNote')}</div>
        {lines.length === 0 && <div className="rootpanel__empty">{t('rootPanels.emptyGroups')}</div>}
        {lines.map((g, i) => {
          const refs = refZoneNames(variants, 'contentCountLimits', g.name)
          return (
            <GroupCard
              key={g.name}
              group={g}
              kind="cl"
              refCount={refs.length}
              onDelete={() => deleteGroup(g.name)}
              summaryExtra={
                <>
                  <span className="mc-group__count">
                    {t('rootPanels.clCount', { limits: g.limits.length, zones: refs.length })}
                  </span>
                  <ZoneRefs names={refs} />
                </>
              }
            >
            {g.limits.map((l, li) => (
              <LimitCard
                key={li}
                limit={l}
                onPatch={(next) =>
                  setGroups(lines.map((x, j) => (j === i ? { ...x, limits: x.limits.map((y, k) => (k === li ? next : y)) } : x)))
                }
                onDelete={() =>
                  setGroups(lines.map((x, j) => (j === i ? { ...x, limits: x.limits.filter((_, k) => k !== li) } : x)))
                }
              />
            ))}
            <button
              type="button"
              className="btn"
              onClick={() =>
                setGroups(lines.map((x, j) => (j === i ? { ...x, limits: [...x.limits, newLimit()] } : x)))
              }
            >
              <Plus size={12} /> {t('rootPanels.addLimit')}
            </button>
            </GroupCard>
          )
        })}
    </div>
  )
}