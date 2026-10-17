import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadCatalog } from '../../data/catalog'
import { sidNameLang } from '../../data/sidCatalog'
import { parsePoolName, poolTags } from '../../utils/pools'
import { ComboInput } from '../editors/fields'
import { PoolBrowser } from './PoolBrowser'
import { humanPoolName, translatePoolTags } from './tagLabels'

export function PoolListEditor({
  label,
  value,
  onChange,
  hint,
  single = false,
  placeholder,
}: {
  label: string
  value?: string[]
  onChange: (v: string[]) => void
  hint?: string
  single?: boolean
  placeholder?: string
}) {
  const list = value ?? []
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  const [draft, setDraft] = useState('')
  const [names, setNames] = useState<string[] | null>(null)
  const [browserOpen, setBrowserOpen] = useState(false)
  const loaded = useRef(false)

  const ensureNames = () => {
    if (loaded.current) return
    loaded.current = true
    void loadCatalog().then((c) => setNames(c.poolNames))
  }

  const add = (name: string) => {
    const n = name.trim()
    if (!n) return
    if (names && !names.includes(n)) return
    if (single) {
      onChange([n])
      setBrowserOpen(false)
    } else if (!list.includes(n)) {
      onChange([...list, n])
    }
    setDraft('')
  }

  const remove = (name: string) => onChange(list.filter((x) => x !== name))

  const toggle = (name: string) => {
    if (single) {
      onChange([name])
      setBrowserOpen(false)
    } else if (list.includes(name)) {
      onChange(list.filter((x) => x !== name))
    } else {
      onChange([...list, name])
    }
  }

  // ВАЖНО: обёртка — div, а не label. <label> привязывается к первому
  // labelable-потомку, а это кнопка «✕» первого чипа (button — labelable element):
  // клик по подписи/неинтерактивной области поля браузер перенаправил бы на неё,
  // молча удаляя первый пул. Доступное имя поля — aria-label на input ( ComboInput),
  // образец — GroupRefList.tsx.
  return (
    <div className="full pb-field" title={hint}>
      <span className="ef__label">{label}</span>
      {list.length ? (
        <span className="pb-field__chips">
          {list.map((n) => {
            const tag = names ? parsePoolName(n) : null
            const tags = tag ? translatePoolTags(poolTags(tag), t) : ''
            const lbl = humanPoolName(n, t, lang)
            return (
              <span key={n} className="pb-field__chip" title={tags ? `${n} · ${tags}` : n}>
                <span className="pb-field__chname">{lbl ?? n}</span>
                <button
                  type="button"
                  className="pb-field__x"
                  onClick={() => remove(n)}
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
          suggestions={(names ?? []).map((n) => ({ value: n }))}
          onOpen={ensureNames}
          ariaLabel={label}
          placeholder={placeholder ?? (single ? t('poolList.placeholderSingle') : t('poolList.placeholderMulti'))}
        />
        <button type="button" className="btn" onClick={() => add(draft)} disabled={!draft.trim()}>
          ＋
        </button>
        <button type="button" className="btn" onClick={() => setBrowserOpen(true)}>
          {t('poolList.catalog')}
        </button>
      </span>
      <PoolBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        selected={list}
        onToggle={toggle}
        title={t('poolList.catalogTitle', { label })}
      />
    </div>
  )
}