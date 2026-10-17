import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { sidHint, sidNameLang, type SidNameLang } from '../../data/sidCatalog'
import { useEditorStore } from '../../store/editorStore'
import type { ContentCountLimit, MandatoryContentItem } from '../../types/rmg'
import { ComboInput, type ComboSuggestion } from './fields'

/** «Ящик Пандоры (pandora_box)» — читаемое имя каталога + технический sid; без имени — просто sid. */
function sidLabel(sid: string | undefined, lang: SidNameLang): string | undefined {
  if (!sid) return undefined
  const hint = sidHint(sid, lang)
  return hint && hint !== sid ? `${hint} (${sid})` : sid
}

/**
 * Ссылки зоны на корневые группы: обязательного контента (kind="mc",
 * template.mandatoryContent) или лимитов количества (kind="cl",
 * template.contentCountLimits).
 *
 * Вместо сырых имён через запятую — чипы с локализованной сводкой и
 * tooltip-расшифровкой содержимого группы (имена sid активной локали каталога через sidHint).
 * Клик по чипу найденной группы — переход к ней в корневой панели
 * (store.goToGroup переключает вкладку, карточка группы прокручивается в вид
 * и подсвечивается); у битой ссылки кнопки перехода нет.
 * Имя группы на чипе — оригинальный идентификатор из .rmg.json без
 * «очеловечивания»: имена групп кастомные (игра резолвит ссылки точным
 * совпадением строки; на них ссылаются также roads и rules), префиксы
 * mandatory_content_ и content_limits_ — лишь конвенция штатных шаблонов.
 *
 * Добавляется любое непустое имя: битые ссылки игра молча переносит,
 * поэтому не ужесточаем — отсутствующая в корне группа лишь помечается
 * бейджем «не найдена» (валидатор отдельно даёт zoneMcGroupMissing).
 */
export function GroupRefList({
  label,
  hint,
  kind,
  value,
  onChange,
  placeholder,
}: {
  label: string
  hint?: string
  kind: 'mc' | 'cl'
  value?: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  const list = value ?? []
  const [draft, setDraft] = useState('')
  const mcGroups = useEditorStore(useShallow((s) => (kind === 'mc' ? s.template.mandatoryContent ?? [] : [])))
  const clGroups = useEditorStore(useShallow((s) => (kind === 'cl' ? s.template.contentCountLimits ?? [] : [])))
  const goToGroup = useEditorStore((s) => s.goToGroup)

  const mcLine = (it: MandatoryContentItem): string => {
    const sl = sidLabel(it.sid, lang)
    let base: string
    if (it.name && sl) base = `${it.name} · ${sl}`
    else if (it.name) base = it.name
    else if (sl) base = sl
    else if (it.includeLists?.length) base = t('zone.mcGroupTipChoice', { list: it.includeLists.join(', ') })
    else if (it.content?.length)
      base = t('zone.mcGroupTipVariantSet', { items: it.content.map((v) => sidLabel(v.sid, lang) ?? '?').join(', ') })
    else base = t('zone.mcGroupTipUnknown')
    return it.isMine ? `${base} · ${t('rootPanels.mineBadge')}` : base
  }

  const clLine = (lim: ContentCountLimit): string => {
    const sl = sidLabel(lim.sid, lang)
    const base =
      sl ??
      (lim.includeLists?.length
        ? t('rootPanels.limitGroupLabel', { list: lim.includeLists.join(', ') })
        : t('zone.clGroupTipUnknown'))
    return t('zone.clGroupTipLine', { item: base, n: lim.maxCount })
  }

  // Имя группы → локализованная сводка + построчная расшифровка (tooltip).
  const info = new Map<string, { summary: string; lines: string[] }>()
  if (kind === 'mc') {
    for (const g of mcGroups) {
      if (!g || typeof g.name !== 'string' || !g.name) continue
      const items = Array.isArray(g.content) ? g.content : []
      info.set(g.name, { summary: t('zone.mcGroupSum', { n: items.length }), lines: items.map(mcLine) })
    }
  } else {
    for (const g of clGroups) {
      if (!g || typeof g.name !== 'string' || !g.name) continue
      const lims = Array.isArray(g.limits) ? g.limits : []
      info.set(g.name, { summary: t('zone.clGroupSum', { n: lims.length }), lines: lims.map(clLine) })
    }
  }

  const available = [...info.keys()].filter((n) => !list.includes(n))

  const add = (name: string) => {
    const n = name.trim()
    setDraft('')
    if (!n || list.includes(n)) return
    onChange([...list, n])
  }

  // Подсказки ComboInput — оригинальное имя (value) + сводка содержимого (label).
  const options: ComboSuggestion[] = available.map((n) => ({
    value: n,
    label: info.get(n)?.summary ?? '',
  }))

  // ВАЖНО: обёртка — div, а не label (как в PoolListEditor): <label> «привязывается»
  // к первому labelable-потомку, а это кнопка «✕» первого чипа (button — labelable
  // element), и клик по подписи поля сработал бы как удаление. Доступное имя
  // поля — aria-label на input.
  return (
    <div className="full pb-field" title={hint}>
      <span className="ef__label">{label}</span>
      {list.length ? (
        <span className="pb-field__chips">
          {list.map((n) => {
            const gi = info.get(n)
            return (
              <span
                key={n}
                className={gi ? 'pb-field__chip' : 'pb-field__chip pb-field__chip--missing'}
                title={gi ? (gi.lines.length ? `${n}\n${gi.lines.join('\n')}` : n) : t('zone.groupRefMissingTitle', { name: n })}
              >
                {gi ? (
                  // Переход к группе корневой панели (вкладка + прокрутка
                  // + подсветка). Своего title нет намеренно — всплывает tooltip
                  // чипа с расшифровкой содержимого; доступное имя — aria-label.
                  // Битая ссылка кнопки не получает: переходить некуда.
                  <button
                    type="button"
                    className="pb-field__go"
                    aria-label={t('zone.groupRefGoTitle', { name: n })}
                    onClick={() => goToGroup(kind, n)}
                  >
                    <span className="pb-field__chname">{n}</span>
                    <span className="pb-field__chipsum">{gi.summary}</span>
                  </button>
                ) : (
                  <>
                    <span className="pb-field__chname">{n}</span>
                    <span className="pb-field__chipmiss">{t('zone.groupRefMissing')}</span>
                  </>
                )}
                <button
                  type="button"
                  className="pb-field__x"
                  onClick={() => onChange(list.filter((x) => x !== n))}
                  title={t('poolList.removeTitle')}
                >
                  ✕
                </button>
              </span>
            )
          })}
        </span>
      ) : null}
      <span className="pb-field__row">
        <ComboInput
          text={draft}
          onText={setDraft}
          onSelect={(v) => add(v)}
          onCommit={(v) => add(v)}
          suggestions={options}
          ariaLabel={label}
          placeholder={placeholder ?? t('zone.groupRefPlaceholder')}
        />
        <button type="button" className="btn" onClick={() => add(draft)} disabled={!draft.trim()}>
          ＋
        </button>
      </span>
    </div>
  )
}
