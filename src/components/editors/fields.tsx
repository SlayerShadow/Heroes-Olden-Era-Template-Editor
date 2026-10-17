import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../store/editorStore'

export interface SelectOption {
  value: string
  label?: string
}

export interface ComboSuggestion {
  value: string
  label?: string
}

/**
 * Input с кастомным выпадающим списком — замена нативного `<datalist>`.
 * У нативного datalist два дефекта: popup фильтрует подсказки текущим значением поля
 * (с непустым значением полный список не виден, пока поле не очистят) и Chromium
 * неверно якорит popup внутри скролл-контейнеров инспектора. ComboInput:
 * при открытии (focus/клик/ArrowDown) список ПОЛНЫЙ, фильтрация включается только
 * пока пользователь печатает; список рисуется в portal с position:fixed по rect поля —
 * не зависит от overflow:hidden у предков. Значение остаётся свободным текстом:
 * Enter/blur коммитят как есть, Escape закрывает список.
 */
export function ComboInput({
  text,
  onText,
  onCommit,
  onSelect,
  suggestions,
  placeholder,
  onOpen,
  className = 'input',
  ariaLabel,
}: {
  text: string
  onText: (v: string) => void
  /** Коммит свободного ввода (blur/Enter). */
  onCommit?: (v: string) => void
  /** Выбор опции списка; по умолчанию — onText + onCommit. */
  onSelect?: (v: string) => void
  suggestions: ComboSuggestion[]
  placeholder?: string
  /** Ленивая подгрузка каталога к моменту открытия (см. PoolListEditor). */
  onOpen?: () => void
  className?: string
  ariaLabel?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  // Фильтрация — только пока печатают; открытие списка сбрасывает её (полный список).
  const [filtering, setFiltering] = useState(false)
  const [active, setActive] = useState(0)
  const [style, setStyle] = useState<CSSProperties | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const query = text.trim().toLowerCase()
  const shown =
    filtering && query
      ? suggestions.filter((s) => s.value.toLowerCase().includes(query) || (s.label ?? '').toLowerCase().includes(query))
      : suggestions

  const place = () => {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const maxH = 244
    const up = r.bottom + maxH + 8 > window.innerHeight && r.top > maxH + 8
    setStyle(
      up
        ? { left: r.left, width: Math.max(r.width, 200), bottom: window.innerHeight - r.top + 4 }
        : { left: r.left, width: Math.max(r.width, 200), top: r.bottom + 4 },
    )
  }

  const openList = () => {
    if (open) return
    setOpen(true)
    setFiltering(false)
    setActive(0)
    place()
    onOpen?.()
  }

  useEffect(() => {
    if (!open) return
    const onScroll = () => place()
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (inputRef.current?.contains(target) || popRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('mousedown', onDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- place стабилен по смыслу (читает ref)
  }, [open])

  const pick = (v: string) => {
    if (onSelect) onSelect(v)
    else {
      onText(v)
      onCommit?.(v)
    }
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <>
      <input
        ref={inputRef}
        className={className}
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onChange={(e) => {
          onText(e.target.value)
          if (!open) openList()
          // setFiltering ПОСЛЕ openList: открытие сбрасывает фильтрацию (полный список),
          // но набор текста с закрытого поля должен сразу фильтровать подсказки.
          setFiltering(true)
        }}
        onFocus={openList}
        onClick={openList}
        onBlur={() => onCommit?.(text)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!open) openList()
            else setActive((a) => Math.min(a + 1, Math.max(shown.length - 1, 0)))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (open) setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            if (open && shown[active]) {
              e.preventDefault()
              pick(shown[active].value)
            } else {
              ;(e.target as HTMLInputElement).blur()
            }
          } else if (e.key === 'Escape' && open) {
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
          }
        }}
      />
      {open &&
        createPortal(
          <div ref={popRef} className="combo__pop" style={style ?? undefined} role="listbox">
            {shown.length === 0 ? (
              <div className="combo__empty">{t('fields.comboNoMatches')}</div>
            ) : (
              shown.map((s, i) => (
                <div
                  key={s.value}
                  role="option"
                  aria-selected={i === active}
                  className={`combo__opt${i === active ? ' combo__opt--active' : ''}`}
                  title={s.label && s.label !== s.value ? `${s.label} · ${s.value}` : s.value}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(s.value)}
                >
                  {s.label && s.label !== s.value ? <span className="combo__opt-label">{s.label}</span> : null}
                  <span className="combo__opt-value">{s.value}</span>
                </div>
              ))
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

export function Label({
  label,
  hint,
  required,
  sub,
  className,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  /** Читаемая подпись рядом с названием поля (напр., официальное имя объекта для sid). */
  sub?: string
  /** Допкласс обёртки поля (напр. `ef--wide` — поле во всю строку сетки). */
  className?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <label className={className ? `ef ${className}` : 'ef'} title={hint}>
      <span className="ef__label">
        {label}
        {required && <span className="ef__req" title={t('fields.requiredTitle')}>*</span>}
        {sub && <span className="ef__sub">{sub}</span>}
      </span>
      {children}
    </label>
  )
}

export function Num({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
  required,
}: {
  label: string
  value?: number
  onChange: (v: number | undefined) => void
  min?: number
  max?: number
  step?: number
  hint?: string
  required?: boolean
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  // Ресинхронизация при внешнем изменении value (например, после «Применить» в JSON-редакторе):
  // render-phase паттерн «предыдущее значение в состоянии» — пока пользователь печатает,
  // value не меняется и текст не затирается.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(value == null ? '' : String(value))
  }
  const commit = () => {
    const t = text.trim().replace(',', '.')
    if (t === '') return onChange(undefined)
    const n = Number(t)
    if (Number.isFinite(n)) onChange(n)
    else setText(value == null ? '' : String(value))
  }
  return (
    <Label label={label} hint={hint} required={required}>
      <input
        className="input"
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </Label>
  )
}

export function Text({
  label,
  value,
  onChange,
  placeholder,
  hint,
  disabled,
  required,
}: {
  label: string
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  hint?: string
  disabled?: boolean
  required?: boolean
}) {
  const [text, setText] = useState(value ?? '')
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(value ?? '')
  }
  const commit = () => onChange?.(text.trim())
  return (
    <Label label={label} hint={hint} required={required}>
      <input
        className="input"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </Label>
  )
}

export function Select({
  label,
  value,
  onChange,
  options,
  hint,
  blankLabel = '—',
  allowBlank = true,
}: {
  label: string
  value?: string
  onChange: (v: string) => void
  options: SelectOption[]
  hint?: string
  blankLabel?: string
  /** false для обязательных полей: blank-опция «—» не рендерится, '' выбрать нельзя. */
  allowBlank?: boolean
}) {
  return (
    <Label label={label} hint={hint}>
      <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {allowBlank && <option value="">{blankLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label ?? o.value}
          </option>
        ))}
      </select>
    </Label>
  )
}

/**
 * Поле-дропдаун с каталогом пресетов (ComboInput) и статус-бейджем:
 * красный «не в каталоге», оранжевый «известная битая ссылка (штатные)»,
 * зелёный «в каталоге» (когда значение задано и валидно).
 */
export function PresetSelect({
  label,
  value,
  onChange,
  dataList,
  broken,
  hint,
  placeholder,
}: {
  label: string
  value?: string
  onChange: (v: string | undefined) => void
  /** Все допустимые значения (показываются в списке подсказок). */
  dataList: readonly string[]
  /** Известные битые ссылки штатных шаблонов — подсветка отдельным бейджем. */
  broken?: ReadonlySet<string>
  hint?: string
  placeholder?: string
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(value ?? '')
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(value ?? '')
  }
  const v = value ?? ''
  const isBroken = broken?.has(v) ?? false
  const isMissing = !!value && !dataList.includes(value)
  let badge: string | null = null
  let badgeCls = ''
  if (value && isBroken) {
    badge = t('fields.badgeBroken')
    badgeCls = 'preset__badge preset__badge--broken'
  } else if (isMissing) {
    badge = t('fields.badgeMissing')
    badgeCls = 'preset__badge preset__badge--missing'
  } else if (value) {
    badge = t('fields.badgeOk')
    badgeCls = 'preset__badge preset__badge--ok'
  }
  return (
    <Label label={label} hint={hint}>
      <div className="preset">
        <ComboInput
          text={text}
          onText={setText}
          onCommit={(next) => onChange(next.trim() ? next.trim() : undefined)}
          suggestions={dataList.map((p) => ({ value: p }))}
          placeholder={placeholder}
        />
        {badge && <span className={badgeCls}>{badge}</span>}
      </div>
    </Label>
  )
}

export function TriSelect({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value?: boolean
  onChange: (v: boolean | undefined) => void
  hint?: string
}) {
  const { t } = useTranslation()
  return (
    <Select
      label={label}
      hint={hint}
      blankLabel={t('fields.notSet')}
      value={value == null ? '' : String(value)}
      onChange={(v) => onChange(v === '' ? undefined : v === 'true')}
      options={[
        { value: 'true', label: 'true' },
        { value: 'false', label: 'false' },
      ]}
    />
  )
}

export function CommaList({
  label,
  value,
  onChange,
  hint,
  placeholder,
  rows = 2,
}: {
  label: string
  value?: string[]
  onChange: (v: string[]) => void
  hint?: string
  placeholder?: string
  rows?: number
}) {
  const textValue = (value ?? []).join(', ')
  const [text, setText] = useState(textValue)
  // Сравнение по каноническому тексту (не идентичности массива): коммит создаёт новый массив,
  // но текст сбрасывается только когда содержимое действительно изменилось извне.
  const [prevTextValue, setPrevTextValue] = useState(textValue)
  if (textValue !== prevTextValue) {
    setPrevTextValue(textValue)
    setText(textValue)
  }
  const commit = () => onChange(text.split(',').map((s) => s.trim()).filter(Boolean))
  return (
    <Label label={label} hint={hint} className="ef--wide">
      <textarea
        className="input"
        value={text}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            commit()
            ;(e.target as HTMLTextAreaElement).blur()
          }
        }}
      />
    </Label>
  )
}

export function NumList({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string
  value?: number[]
  onChange: (v: number[]) => void
  hint?: string
  placeholder?: string
}) {
  const canonical = (value ?? []).join(', ')
  const [text, setText] = useState(canonical)
  const [prevCanonical, setPrevCanonical] = useState(canonical)
  if (canonical !== prevCanonical) {
    setPrevCanonical(canonical)
    setText(canonical)
  }
  const commit = () =>
    onChange(
      text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number),
    )
  return (
    <Label label={label} hint={hint} className="ef--wide">
      <textarea
        className="input"
        value={text}
        placeholder={placeholder}
        rows={2}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            commit()
            ;(e.target as HTMLTextAreaElement).blur()
          }
        }}
      />
    </Label>
  )
}

/**
 * Сворачиваемый блок редактора.
 * `persistKey` — если задан, состояние «свёрнут/развёрнут» живёт в store
 * (editorStore.sectionStates: локальные предпочтения + sidecar шаблона):
 * переживает переключение выделенного объекта, перезапуск (localStorage) и
 * путешествует с шаблоном (sidecar `.editor.json`).
 * Без `persistKey` поведение прежнее — разворачивается по `open` и сбрасывается при remount.
 */
export function Section({
  title,
  collapsedHint,
  open,
  persistKey,
  children,
}: {
  title: string
  /** Краткая сводка содержимого — видна в заголовке только когда секция свёрнута. */
  collapsedHint?: string
  open?: boolean
  persistKey?: string
  children: ReactNode
}) {
  const setSectionState = useEditorStore((s) => s.setSectionState)
  const storedOpen = useEditorStore((s) => (persistKey ? s.sectionStates[persistKey] : undefined))
  const isOpen = persistKey ? (storedOpen ?? open) : open
  return (
    <details
      className="editor__sec"
      open={isOpen}
      onToggle={
        persistKey
          ? (e) => {
              const next = e.currentTarget.open
              if (next === isOpen) return
              setSectionState(persistKey, next)
            }
          : undefined
      }
    >
      <summary>
        {title}
        {!isOpen && collapsedHint ? <span className="editor__sec-sum">{collapsedHint}</span> : null}
      </summary>
      <div className="editor__grid">{children}</div>
    </details>
  )
}

/**
 * Многострочное текстовое поле заметки (sidecar `.editor.json`, не часть `.rmg.json`).
 * Коммит по blur или Ctrl/⌘+Enter; Enter внутри — обычный перенос строки.
 */
export function NoteArea({
  value,
  onChange,
  placeholder,
  hint,
  rows = 4,
}: {
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  rows?: number
}) {
  const [text, setText] = useState(value ?? '')
  // Ресинхронизация при внешнем изменении (undo, переименование зоны, загрузка шаблона).
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(value ?? '')
  }
  return (
    <div className="full" title={hint}>
      <textarea
        className="input"
        rows={rows}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            onChange(text)
            ;(e.target as HTMLTextAreaElement).blur()
          }
        }}
      />
    </div>
  )
}