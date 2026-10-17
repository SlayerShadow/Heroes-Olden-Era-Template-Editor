import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { loadCatalog, type Catalog } from '../../data/catalog'
import { sidHint, sidNameLang } from '../../data/sidCatalog'
import type { ContentList, ContentPool } from '../../data/poolCatalog'
import {
  comparePools,
  formatWeight,
  groupWeightTotal,
  listRefCount,
  parsePoolName,
  poolNamesByList,
  poolTags,
  poolValueBins,
  POOL_PROFILES,
  POOL_TIERS,
  type PoolGuard,
  type PoolKind,
  type PoolProfile,
} from '../../utils/pools'
import { humanPoolName, translatePoolTags } from './tagLabels'
import { ComboInput } from '../editors/fields'

type BrowserMode = 'pools' | 'lists' | 'compare'

type SortKey = 'name' | 'total' | 'lists'

const SORT_OPTIONS: SortKey[] = ['name', 'total', 'lists']

type ListSortKey = 'name' | 'usage'

const LIST_SORT_OPTIONS: ListSortKey[] = ['name', 'usage']

type KindFilter = PoolKind | 'all'

const KIND_OPTIONS: KindFilter[] = ['all', 'random', 'classic', 'template', 'content', 'other']

/** сохранение фильтров/сравнения между открытиями каталога */
const PREFS_KEY = 'hooe.poolBrowser.prefs.v1'
const MAX_COMPARE = 6

interface BrowserPrefs {
  mode: BrowserMode
  search: string
  kind: KindFilter
  guard: PoolGuard | 'all'
  tiers: string[]
  profiles: PoolProfile[]
  sortBy: SortKey
  listSort: ListSortKey
  compare: string[]
}

const DEFAULT_PREFS: BrowserPrefs = {
  mode: 'pools',
  search: '',
  kind: 'all',
  guard: 'all',
  tiers: [],
  profiles: [],
  sortBy: 'name',
  listSort: 'name',
  compare: [],
}

function isKind(v: unknown): v is KindFilter {
  return v === 'all' || v === 'random' || v === 'classic' || v === 'template' || v === 'content' || v === 'other'
}

function readPrefs(): BrowserPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const p: unknown = JSON.parse(raw)
    if (!p || typeof p !== 'object') return DEFAULT_PREFS
    const o = p as Partial<Record<keyof BrowserPrefs, unknown>>
    const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)
    const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
    return {
      mode: o.mode === 'lists' || o.mode === 'compare' ? o.mode : 'pools',
      search: str(o.search, ''),
      kind: isKind(o.kind) ? o.kind : 'all',
      guard: o.guard === 'guarded' || o.guard === 'unguarded' ? o.guard : 'all',
      tiers: strArr(o.tiers),
      profiles: strArr(o.profiles).filter((x): x is PoolProfile => (POOL_PROFILES as readonly string[]).includes(x)),
      sortBy: o.sortBy === 'total' || o.sortBy === 'lists' ? o.sortBy : 'name',
      listSort: o.listSort === 'usage' ? o.listSort : 'name',
      compare: strArr(o.compare).slice(0, MAX_COMPARE),
    }
  } catch {
    return DEFAULT_PREFS
  }
}

const shortName = (n: string) => (n.length > 26 ? `${n.slice(0, 24)}…` : n)

function ListContents({ list }: { list: ContentList }) {
  const { i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  return (
    <ul className="pb-list">
      {list.content.map((c, i) => (
        <li key={i}>
          <span className="pb-list__sid">{c.sid}</span>
          <span className="pb-list__w">{c.weight ?? 1}</span>
          {c.biome ? <span className="pb-list__biome">{c.biome}</span> : null}
          {sidHint(c.sid, lang) ? <span className="pb-list__hint">{sidHint(c.sid, lang)}</span> : null}
        </li>
      ))}
    </ul>
  )
}

function PoolRow({ name, selected, onToggle, catalog }: { name: string; selected: boolean; onToggle: (n: string) => void; catalog: Catalog }) {
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  const pool = catalog.poolMap[name]
  if (!pool) return null
  const tag = parsePoolName(name)
  const tags = poolTags(tag)
  const label = humanPoolName(name, t, lang)
  const bins = poolValueBins(pool)
  const totalW = groupWeightTotal(pool)
  const maxBin = bins.length ? Math.max(...bins.map((b) => b.weight)) : 0
  const maxGroup = Math.max(...pool.groups.map((g) => g.weight))

  return (
    <details className={`pb-row${selected ? ' pb-row--sel' : ''}`}>
      <summary>
        <button
          type="button"
          className={`pb-row__toggle${selected ? ' pb-row__toggle--on' : ''}`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggle(name)
          }}
          title={selected ? t('pools.toggleRemoveTitle') : t('pools.toggleAddTitle')}
        >
          {selected ? '✓' : '+'}
        </button>
        <span className="pb-row__name" title={name}>
          {label ?? name}
        </span>
        {label ? (
          <span className="pb-row__tags">{name}</span>
        ) : tags.length ? (
          <span className="pb-row__tags">{translatePoolTags(tags, t)}</span>
        ) : null}
        {bins.length ? (
          <span className="pb-row__hist">
            {bins.map((b, i) => (
              <span
                key={i}
                className="pb-row__bar"
                style={{ height: `${(b.weight / maxBin) * 100}%` }}
                title={t('pools.binTitle', { label: b.label, weight: b.weight })}
              />
            ))}
          </span>
        ) : null}
        <span className="pb-row__hint">
          {t('pools.rowHint', { total: totalW, lists: listRefCount(pool) })}
        </span>
      </summary>
      <div className="pb-row__body">
        {bins.length ? (
          <div className="pb-vd">
            {bins.map((b, i) => (
              <div key={i} className="pb-vd__bar" style={{ flexGrow: b.weight, minWidth: 2 }} title={`${b.label}: ${b.weight}`}>
                <span className="pb-vd__label">{b.label}</span>
                <span className="pb-vd__val">{b.weight}</span>
              </div>
            ))}
          </div>
        ) : null}
        {pool.bans?.length ? (
          <div className="pb-bans">
            <span className="pb-bans__title">ban:</span>
            {pool.bans.map((b) => (
              <span key={b} className="pb-bans__item">
                {b}
              </span>
            ))}
          </div>
        ) : null}
        <div className="pb-groups">
          {pool.groups.map((g, i) => (
            <div key={i} className="pb-group">
              <div className="pb-group__weight" style={{ '--pbw': `${(g.weight / maxGroup) * 100}%` } as CSSProperties}>
                {formatWeight(g.weight)}
              </div>
              <div className="pb-group__lists">
                {g.lists.length ? (
                  g.lists.map((ln) => {
                    const l = catalog.listMap[ln]
                    return l ? (
                      <details key={ln} className="pb-group__list">
                        <summary>
                          <span className="pb-group__lname" title={ln}>
                            {humanPoolName(ln, t, lang) ?? ln}
                          </span>
                          <span className="pb-group__lcount">{l.content.length}</span>
                        </summary>
                        <ListContents list={l} />
                      </details>
                    ) : (
                      <span key={ln} className="pb-group__list pb-group__list--missing">
                        {ln}
                      </span>
                    )
                  })
                ) : (
                  <span className="hint">—</span>
                )}
                {g.content?.length ? (
                  <span className="pb-group__inline">
                    [{g.content.map((c) => `${c.sid}${c.weight != null ? `:${c.weight}` : ''}`).join(', ')}]
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}

function ListRow({ list, usage }: { list: ContentList; usage: string[] }) {
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  const label = humanPoolName(list.name, t, lang)
  const sidCount = t('pools.listSidCount', { n: list.content.length })
  return (
    <details className="pb-row">
      <summary>
        <span className="pb-row__name" title={list.name}>
          {label ?? list.name}
        </span>
        <span className="pb-row__tags">{label ? `${list.name} · ${sidCount}` : sidCount}</span>
        <span className="pb-row__hint">{t('pools.listUsage', { n: usage.length })}</span>
      </summary>
      <div className="pb-row__body">
        <ListContents list={list} />
        {usage.length ? (
          <div className="pb-lrefs">
            <span className="pb-bans__title">{t('pools.listUsedBy')}</span>
            {usage.map((n) => (
              <span key={n} className="pb-row__tags pb-lref" title={humanPoolName(n, t, lang) ?? n}>
                {n}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  )
}

function CompareTable({ pools, onRemove }: { pools: ContentPool[]; onRemove: (name: string) => void }) {
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  const cmp = useMemo(() => comparePools(pools), [pools])

  const gridStyle = { '--cmpn': pools.length } as CSSProperties

  const headCells = [
    <div key="h0" className="pb-cmp__cell pb-cmp__cell--h">
      {t('pools.cmpPoolHeader')}
    </div>,
    ...pools.map((p) => {
      const lbl = humanPoolName(p.name, t, lang)
      return (
        <div key={`h-${p.name}`} className="pb-cmp__cell pb-cmp__cell--h pb-cmp__cell--pool">
          <span className="pb-cmp__pname" title={lbl ? `${lbl}\n${p.name}` : p.name}>
            {shortName(lbl ?? p.name)}
          </span>
          <button type="button" className="pb-row__toggle" onClick={() => onRemove(p.name)} title={t('pools.cmpRemoveTitle')}>
            ✕
          </button>
        </div>
      )
    }),
  ]

  const metricRow = (label: string, cells: ReactNode[]) => [
    <div key={`${label}-l`} className="pb-cmp__cell">
      {label}
    </div>,
    ...cells,
  ]

  const valueCells = pools.map((p) => {
    const bins = poolValueBins(p)
    if (!bins.length)
      return (
        <div key={p.name} className="pb-cmp__cell">
          —
        </div>
      )
    return (
      <div key={p.name} className="pb-cmp__cell pb-cmp__histrow">
        {bins.map((b, i) => (
          <span key={i} className="pb-vd__bar" style={{ flexGrow: Math.max(1, b.weight) }} title={t('pools.binTitle', { label: b.label, weight: b.weight })}>
            <span className="pb-vd__label">{b.label}</span>
            <span className="pb-vd__val">{formatWeight(b.weight)}</span>
          </span>
        ))}
      </div>
    )
  })

  const matrixCells: ReactNode[] = []
  for (const row of cmp.matrix) {
    matrixCells.push(
      <div
        key={`${row.list}-l`}
        className={`pb-cmp__cell pb-cmp__cell--name${row.differs ? ' pb-cmp__cell--diff' : ''}`}
        title={row.differs ? t('pools.cmpDiffersTitle') : t('pools.cmpSameTitle')}
      >
        {row.list}
      </div>,
    )
    row.weights.forEach((w, i) => {
      matrixCells.push(
        <div
          key={`${row.list}-${i}`}
          className={`pb-cmp__cell pb-cmp__cell--w${w == null ? ' pb-cmp__cell--miss' : row.differs ? ' pb-cmp__cell--diff' : ''}`}
        >
          {w == null ? '—' : formatWeight(w)}
        </div>,
      )
    })
  }

  const uniqueRows = cmp.matrix.filter((r) => r.weights.filter((w) => w != null).length === 1)

  return (
    <div className="pb-cmp__tablewrap">
      <div className="pb-cmp__grid" style={gridStyle}>
        {headCells}
        {metricRow(
          t('pools.cmpTags'),
          pools.map((p) => (
            <div key={p.name} className="pb-cmp__cell">
              {translatePoolTags(poolTags(parsePoolName(p.name)), t) || '—'}
            </div>
          )),
        )}
        {metricRow(
          t('pools.cmpTotalWeight'),
          pools.map((p) => (
            <div key={p.name} className="pb-cmp__cell">
              <span className="pb-cmp__num">{formatWeight(groupWeightTotal(p))}</span>
            </div>
          )),
        )}
        {metricRow(
          t('pools.cmpGroups'),
          pools.map((p) => (
            <div key={p.name} className="pb-cmp__cell">
              {p.groups.length}
            </div>
          )),
        )}
        {metricRow(
          t('pools.cmpLists'),
          pools.map((p) => (
            <div key={p.name} className="pb-cmp__cell">
              {listRefCount(p)}
            </div>
          )),
        )}
        {metricRow(
          'ban',
          pools.map((p) => (
            <div key={p.name} className="pb-cmp__cell">
              {p.bans?.length ? p.bans.join(', ') : '—'}
            </div>
          )),
        )}
        {metricRow(t('pools.cmpValue'), valueCells)}
      </div>

      <div className="pb-cmp__section">
        <div className="pb-cmp__title">
          {t('pools.cmpMatrixTitle', {
            common: cmp.commonLists.length,
            union: cmp.unionLists.length,
            pct: (cmp.jaccard * 100).toFixed(0),
          })}
        </div>
        <div className="pb-cmp__grid pb-cmp__grid--matrix" style={gridStyle}>
          {matrixCells}
        </div>
        {cmp.commonLists.length ? (
          <div className="pb-cmp__chips">
            <span className="pb-bans__title">{t('pools.cmpCommonLabel')}</span>
            {cmp.commonLists.map((l) => (
              <span key={l} className="pb-bans__item pb-cmp__ok">
                {l}
              </span>
            ))}
          </div>
        ) : null}
        {uniqueRows.length
          ? pools.map((p, i) => {
              const lists = uniqueRows.filter((r) => r.weights[i] != null).map((r) => r.list)
              if (!lists.length) return null
              return (
                <div key={p.name} className="pb-cmp__chips">
                  <span className="pb-bans__title">
                    {t('pools.cmpUniqueLabel', { name: shortName(humanPoolName(p.name, t, lang) ?? p.name) })}
                  </span>
                  {lists.map((l) => (
                    <span key={l} className="pb-bans__item" title={humanPoolName(l, t, lang) ?? l}>
                      {l}
                    </span>
                  ))}
                </div>
              )
            })
          : null}
      </div>
    </div>
  )
}

export function PoolBrowser({
  open,
  onClose,
  selected,
  onToggle,
  title,
}: {
  open: boolean
  onClose: () => void
  selected: string[]
  onToggle: (name: string) => void
  title?: string
}) {
  const { t, i18n } = useTranslation()
  const lang = sidNameLang(i18n.language)
  const [prefs0] = useState<BrowserPrefs>(readPrefs)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<BrowserMode>(prefs0.mode)
  const [search, setSearch] = useState(prefs0.search)
  const [kind, setKind] = useState<KindFilter>(prefs0.kind)
  const [guard, setGuard] = useState<PoolGuard | 'all'>(prefs0.guard)
  const [tiers, setTiers] = useState<Set<string>>(() => new Set(prefs0.tiers))
  const [profiles, setProfiles] = useState<Set<PoolProfile>>(() => new Set(prefs0.profiles))
  const [sortBy, setSortBy] = useState<SortKey>(prefs0.sortBy)
  const [listSort, setListSort] = useState<ListSortKey>(prefs0.listSort)
  const [cmpNames, setCmpNames] = useState<string[]>(prefs0.compare)
  const [cmpDraft, setCmpDraft] = useState('')

  function setupCatalog(c: Catalog) {
    setCatalog(c)
    const allTiers = new Set<string>()
    const allProfiles = new Set<PoolProfile>()
    for (const p of c.pools) {
      const tg = parsePoolName(p.name)
      if (tg.tier) allTiers.add(tg.tier)
      if (tg.profile) allProfiles.add(tg.profile)
    }
    // сохраняем только те значения фильтров, что реально существуют в каталоге
    setTiers((prev) => new Set([...prev].filter((t) => allTiers.has(t))))
    setProfiles((prev) => new Set([...prev].filter((pr) => allProfiles.has(pr))))
  }

  useEffect(() => {
    if (!open || catalog || error) return
    loadCatalog()
      .then((c) => setupCatalog(c))
      .catch((e) => setError(String(e)))
  }, [open, catalog, error])

  // человекочитаемые подписи имён пулов/списков — для поиска по переводу и title-подсказок
  const labelOf = useMemo(() => {
    const m = new Map<string, string>()
    if (catalog) {
      for (const n of [...catalog.poolNames, ...catalog.listNames]) {
        const l = humanPoolName(n, t, lang)
        if (l) m.set(n, l)
      }
    }
    return m
  }, [catalog, t, lang])

  const filtered = useMemo(() => {
    if (!catalog) return []
    const q = search.trim().toLowerCase()
    const out = catalog.pools.filter((p) => {
      const tg = parsePoolName(p.name)
      if (kind !== 'all' && tg.kind !== kind) return false
      if (guard !== 'all' && tg.guard !== guard) return false
      // тир/профиль применимы только к рандомным пулам — их фильтры не трогают пулы без тира
      const tiered = tg.kind === 'random' || tg.kind === 'classic'
      if (tiers.size && (!tiered || !(tg.tier && tiers.has(tg.tier)))) return false
      if (profiles.size && (!tiered || !(tg.profile && profiles.has(tg.profile)))) return false
      if (q && !p.name.toLowerCase().includes(q) && !(labelOf.get(p.name) ?? '').toLowerCase().includes(q)) return false
      return true
    })
    if (sortBy === 'total') out.sort((a, b) => groupWeightTotal(b) - groupWeightTotal(a))
    else if (sortBy === 'lists') out.sort((a, b) => listRefCount(b) - listRefCount(a))
    else out.sort((a, b) => a.name.localeCompare(b.name))
    return out
  }, [catalog, search, kind, guard, tiers, profiles, sortBy, labelOf])

  const usageByList = useMemo(() => (catalog ? poolNamesByList(catalog.pools) : null), [catalog])

  const filteredLists = useMemo(() => {
    if (!catalog) return []
    const q = search.trim().toLowerCase()
    const out = catalog.lists.filter((l) => {
      if (!q) return true
      if (l.name.toLowerCase().includes(q)) return true
      if ((labelOf.get(l.name) ?? '').toLowerCase().includes(q)) return true
      return l.content.some((c) => c.sid.toLowerCase().includes(q))
    })
    if (listSort === 'usage') {
      const u = usageByList ?? poolNamesByList(catalog.pools)
      out.sort((a, b) => {
        const ua = u.get(a.name)?.length ?? 0
        const ub = u.get(b.name)?.length ?? 0
        return ua === ub ? a.name.localeCompare(b.name) : ub - ua
      })
    } else out.sort((a, b) => a.name.localeCompare(b.name))
    return out
  }, [catalog, search, listSort, usageByList, labelOf])

  const selSet = useMemo(() => new Set(selected), [selected])
  const cmpSet = useMemo(() => new Set(cmpNames), [cmpNames])
  const cmpPools = useMemo(
    () => (catalog ? cmpNames.map((n) => catalog.poolMap[n]).filter((p): p is ContentPool => !!p) : []),
    [catalog, cmpNames],
  )

  // сохранение фильтров/режима/сравнения между сессиями
  useEffect(() => {
    try {
      const p: BrowserPrefs = {
        mode,
        search,
        kind,
        guard,
        tiers: [...tiers],
        profiles: [...profiles],
        sortBy,
        listSort,
        compare: cmpNames,
      }
      localStorage.setItem(PREFS_KEY, JSON.stringify(p))
    } catch {
      /* localStorage недоступен — просто не сохраняем */
    }
  }, [mode, search, kind, guard, tiers, profiles, sortBy, listSort, cmpNames])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const toggleTier = (t: string) => {
    const next = new Set(tiers)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    setTiers(next)
  }
  const toggleProfile = (p: PoolProfile) => {
    const next = new Set(profiles)
    if (next.has(p)) next.delete(p)
    else next.add(p)
    setProfiles(next)
  }

  const toggleCompare = (name: string) => {
    setCmpNames((prev) =>
      prev.includes(name)
        ? prev.filter((x) => x !== name)
        : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, name],
    )
  }

  const addCompareDraft = (forced?: string) => {
    const n = (forced ?? cmpDraft).trim()
    setCmpDraft('')
    if (!n || !catalog || !catalog.poolNames.includes(n)) return
    toggleCompare(n)
  }

  const resetAll = () => {
    setMode('pools')
    setSearch('')
    setKind('all')
    setGuard('all')
    setTiers(new Set())
    setProfiles(new Set())
    setSortBy('name')
    setListSort('name')
    setCmpNames([])
    setCmpDraft('')
    try {
      localStorage.removeItem(PREFS_KEY)
    } catch {
      /* ignore */
    }
  }

  const showTierProfileUi = (mode === 'pools' || mode === 'compare') && (kind === 'all' || kind === 'random' || kind === 'classic')
  const sortableMode = mode === 'pools' || mode === 'compare'
  const rowsCount = mode === 'lists' ? filteredLists.length : filtered.length

  return createPortal(
    <div className="pb-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb">
        <header className="pb__head">
          <div className="pb__tabs">
            <button type="button" className={`pb-tab${mode === 'pools' ? ' pb-tab--on' : ''}`} onClick={() => setMode('pools')}>
              {t('pools.tabPools')}
            </button>
            <button type="button" className={`pb-tab${mode === 'lists' ? ' pb-tab--on' : ''}`} onClick={() => setMode('lists')}>
              {t('pools.tabLists')}
            </button>
            <button type="button" className={`pb-tab${mode === 'compare' ? ' pb-tab--on' : ''}`} onClick={() => setMode('compare')}>
              {cmpNames.length ? t('pools.tabCompareCount', { n: cmpNames.length }) : t('pools.tabCompare')}
            </button>
          </div>
          <div className="pb__title">{title ?? t('pools.title')}</div>
          <span className="pb__count">
            {catalog ? `${mode === 'compare' ? cmpNames.length : `${rowsCount} / ${mode === 'lists' ? catalog.lists.length : catalog.pools.length}`}` : '…'}
          </span>
          <input
            className="input pb__search"
            autoFocus
            placeholder={
              mode === 'lists'
                ? t('pools.searchLists')
                : mode === 'compare'
                  ? t('pools.searchCompare')
                  : t('pools.searchPools')
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {sortableMode ? (
            <select className="input pb__select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} title={t('pools.sortTitle')}>
              {SORT_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {t(`pools.sort.${o}`)}
                </option>
              ))}
            </select>
          ) : (
            <select className="input pb__select" value={listSort} onChange={(e) => setListSort(e.target.value as ListSortKey)} title={t('pools.sortTitle')}>
              {LIST_SORT_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {t(`pools.listSort.${o}`)}
                </option>
              ))}
            </select>
          )}
          {sortableMode ? (
            <>
              <select className="input pb__select" value={kind} onChange={(e) => setKind(e.target.value as KindFilter)}>
                {KIND_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o === 'all' ? t('pools.kindAll') : t(`poolTags.kind.${o}`)}
                  </option>
                ))}
              </select>
              <select className="input pb__select" value={guard} onChange={(e) => setGuard(e.target.value as PoolGuard | 'all')}>
                <option value="all">{t('pools.guardAll')}</option>
                <option value="guarded">{t('pools.guardGuarded')}</option>
                <option value="unguarded">{t('pools.guardUnguarded')}</option>
              </select>
            </>
          ) : null}
          <button type="button" className="btn" onClick={resetAll} title={t('pools.resetTitle')}>
            {t('pools.reset')}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            {t('pools.close')}
          </button>
        </header>

        {showTierProfileUi && catalog ? (
          <div className="pb__filters">
            <div className="pb__chips">
              {POOL_TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`pb-chip${tiers.has(t) ? ' pb-chip--on' : ''}`}
                  onClick={() => toggleTier(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="pb__chips">
              {POOL_PROFILES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`pb-chip${profiles.has(p) ? ' pb-chip--on' : ''}`}
                  onClick={() => toggleProfile(p)}
                  title={p}
                >
                  {t(`poolTags.profile.${p}`)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="pb__body">
          {error ? <div className="pb__error">{t('pools.loadError', { error })}</div> : null}
          {!catalog && !error ? <div className="pb__loading">{t('pools.loading')}</div> : null}
          {catalog && mode === 'compare' ? (
            <>
              <div className="pb-cmp">
                <div className="pb-cmp__bar">
                  <span className="pb-cmp__label">{t('pools.cmpCount', { n: cmpNames.length, max: MAX_COMPARE })}</span>
                  {cmpNames.map((n) => (
                    <span key={n} className="pb-cmp__chip" title={labelOf.get(n) ? `${labelOf.get(n)}\n${n}` : n}>
                      <span className="pb-cmp__chname">{n}</span>
                      <button type="button" className="pb-field__x" onClick={() => toggleCompare(n)} title={t('pools.cmpRemoveTitle')}>
                        ✕
                      </button>
                    </span>
                  ))}
                  <ComboInput
                    className="input pb-cmp__add"
                    text={cmpDraft}
                    onText={setCmpDraft}
                    onSelect={(v) => addCompareDraft(v)}
                    onCommit={(v) => addCompareDraft(v)}
                    suggestions={catalog.poolNames.map((n) => ({ value: n }))}
                    placeholder={t('pools.cmpAddPlaceholder')}
                  />
                </div>
                {cmpPools.length >= 2 ? (
                  <CompareTable pools={cmpPools} onRemove={toggleCompare} />
                ) : (
                  <div className="pb__empty">{t('pools.cmpEmpty', { max: MAX_COMPARE })}</div>
                )}
              </div>
              <div className="pb-cmp__hint">{t('pools.cmpHint')}</div>
            </>
          ) : null}
          {catalog && !rowsCount ? <div className="pb__empty">{t('pools.empty')}</div> : null}
          {mode === 'pools'
            ? catalog
              ? filtered.map((p) => (
                  <PoolRow key={p.name} name={p.name} selected={selSet.has(p.name)} onToggle={onToggle} catalog={catalog} />
                ))
              : null
            : mode === 'lists'
              ? catalog
                ? filteredLists.map((l) => (
                    <ListRow key={l.name} list={l} usage={usageByList?.get(l.name) ?? []} />
                  ))
                : null
              : catalog
                ? filtered.map((p) => (
                    <PoolRow key={p.name} name={p.name} selected={cmpSet.has(p.name)} onToggle={toggleCompare} catalog={catalog} />
                  ))
                : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}