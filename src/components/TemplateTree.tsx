import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import { FileJson, GitBranch, Layers, LayoutGrid, Search } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import type { RmgTemplate, Zone } from '../types/rmg'
import { PLAYER_COLORS, formatNum, isConnectorZone, zoneBudget } from '../utils/zoneStyle'
import { gameModeLabel } from '../utils/labels'
import { ContextMenu, type ContextMenuState } from './ContextMenu'

const connId = (c: { name?: string; from: string; to: string }): string =>
  c.name ?? `${c.from}-${c.to}`

const connTypes: Set<string> = new Set(['Direct', 'Default', 'Portal', 'Proximity', 'GladiatorArena'])

function PlayerDot({ zone }: { zone: Zone }) {
  const spawn = zone.mainObjects?.find((m) => m.type === 'Spawn' && m.spawn)
  if (!spawn?.spawn) return null
  return (
    <i
      className="tree__dot"
      style={{ background: PLAYER_COLORS[spawn.spawn] }}
      title={`${spawn.spawn} · Spawn`}
    />
  )
}

interface TreeNodeProps {
  zone: Zone
  onSelect: () => void
  onContextMenu: (e: ReactMouseEvent<HTMLButtonElement>) => void
}

function ZoneRow({ zone, onSelect, onContextMenu }: TreeNodeProps) {
  const { t } = useTranslation()
  const isSelected = useEditorStore(
    useShallow((s) => s.selection.kind === 'zone' && s.selection.id === zone.name),
  )
  const isConn = isConnectorZone(zone)
  const objects = zone.mainObjects?.length ?? 0
  const connCount = zone.roads?.length ?? 0
  const hint = [
    isConn ? t('zoneNode.connector') : null,
    isConn ? null : formatNum(zoneBudget(zone)),
    objects ? t('tree.objects', { count: objects }) : null,
    connCount ? t('tree.roadsShort', { n: connCount }) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      type="button"
      className={`tree-row tree-row--zone${isSelected ? ' is-selected' : ''}`}
      title={zone.name}
      data-sel-kind="zone"
      data-sel-id={zone.name}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      <span className="tree-row__name">{zone.name}</span>
      <PlayerDot zone={zone} />
      <span className="tree-row__meta">{hint}</span>
    </button>
  )
}

interface ConnNodeProps {
  conn: { name?: string; from: string; to: string; connectionType: string; guardValue?: number; road?: boolean }
  onSelect: () => void
  onContextMenu: (e: ReactMouseEvent<HTMLButtonElement>) => void
}

function ConnRow({ conn, onSelect, onContextMenu }: ConnNodeProps) {
  const { t } = useTranslation()
  const id = connId(conn)
  const isSelected = useEditorStore(
    useShallow((s) => s.selection.kind === 'connection' && s.selection.id === id),
  )
  const type = connTypes.has(conn.connectionType) ? conn.connectionType : '?'
  const hint = [
    type,
    typeof conn.guardValue === 'number' ? formatNum(conn.guardValue) : null,
    conn.road === true ? t('tree.road') : conn.road === false ? t('tree.noRoad') : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      type="button"
      className={`tree-row tree-row--conn${isSelected ? ' is-selected' : ''}`}
      title={`${conn.from} → ${conn.to}`}
      data-sel-kind="connection"
      data-sel-id={id}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      <span className="tree-row__name">{id}</span>
      <span className="tree-row__meta">{hint}</span>
    </button>
  )
}

export function TemplateTree() {
  const { t } = useTranslation()
  const template = useEditorStore((s) => s.template)
  const variants = useEditorStore((s) => s.template.variants)
  const activeVariant = useEditorStore((s) => s.activeVariant)
  const select = useEditorStore((s) => s.select)
  const selection = useEditorStore((s) => s.selection)
  const setActiveVariant = useEditorStore((s) => s.setActiveVariant)
  const setInspectorTab = useEditorStore((s) => s.setInspectorTab)
  const duplicateZone = useEditorStore((s) => s.duplicateZone)
  const removeZone = useEditorStore((s) => s.removeZone)
  const removeConnection = useEditorStore((s) => s.removeConnection)
  const duplicateConnection = useEditorStore((s) => s.duplicateConnection)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<number>>(() => new Set([activeVariant]))
  // Ветки, вручную свёрнутые пользователем — оверрайд над автораскрытием ветки с активным выделением.
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set())

  // Ветка варианта с активным выделением раскрывается по умолчанию — производное от selection,
  // вместо setState в эффекте (правило react/set-state-in-effect).
  const selectedVariant = useMemo(() => {
    if (!selection.kind || !selection.id) return -1
    return variants.findIndex((v) =>
      selection.kind === 'zone'
        ? (v.zones ?? []).some((z) => z.name === selection.id)
        : (v.connections ?? []).some((c) => connId(c) === selection.id),
    )
  }, [selection, variants])

  // (Производное) эффективно раскрытые ветки: раскрытые вручную + ветка выделения, если её не свернули.
  const effectiveOpen = (i: number): boolean =>
    open.has(i) || (i === selectedVariant && !collapsed.has(i))

  // Подводим строку выделения к видимой части дерева (после смены выделения или разворота ветки).
  // Эффект не сетит state — только синхронизирует DOM (scroll), поэтому react/set-state-in-effect не применимо.
  useEffect(() => {
    if (!selection.kind || !selection.id) return
    const sel = `[data-sel-kind="${selection.kind}"][data-sel-id="${CSS.escape(selection.id)}"]`
    document.querySelector(`.tree__scroll ${sel}`)?.scrollIntoView({ block: 'nearest' })
  }, [selection, selectedVariant, open, collapsed])

  const q = query.trim().toLowerCase()

  const counts = useMemo(() => {
    let zones = 0
    let conns = 0
    for (const v of variants) {
      zones += v.zones?.length ?? 0
      conns += v.connections?.length ?? 0
    }
    return { zones, conns }
  }, [variants])

  const matchZone = (z: Zone) => !q || z.name.toLowerCase().includes(q)
  const matchConn = (c: RmgTemplate['variants'][number]['connections'][number]) =>
    !q || connId(c).toLowerCase().includes(q)

  const toggleVariant = (i: number) => {
    // Для ветки с активным выделением автораскрытие производное — ручной клик переключает оверрайд.
    if (i === selectedVariant) {
      setCollapsed((prev) => {
        const next = new Set(prev)
        if (next.has(i)) next.delete(i)
        else next.add(i)
        return next
      })
      return
    }
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const ensureOpen = (i: number) => {
    if (i === selectedVariant) {
      setCollapsed((prev) => {
        if (!prev.has(i)) return prev
        const next = new Set(prev)
        next.delete(i)
        return next
      })
      return
    }
    setOpen((prev) => (prev.has(i) ? prev : new Set(prev).add(i)))
  }

  const selectVariant = (i: number) => {
    ensureOpen(i)
    setActiveVariant(i)
    setInspectorTab('variant')
  }

  const selectZone = (i: number, name: string) => {
    ensureOpen(i)
    setActiveVariant(i)
    select('zone', name, true)
  }

  const selectConn = (i: number, id: string) => {
    ensureOpen(i)
    setActiveVariant(i)
    select('connection', id, true)
  }

  const selectRoot = () => {
    select(null, null)
    setInspectorTab('root')
  }

  // Контекстное меню (ПКМ) по строкам дерева: те же пункты, что на канве.
  // Дерево показывает строки всех вариантов, а actions store работают с активным,
  // поэтому перед действием переключаем активный вариант на вариант строки
  // (так же, как это делает выбор строки кликом).
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  const openZoneMenu = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>, i: number, name: string) => {
      e.preventDefault()
      setCtxMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            label: t('graph.ctx.duplicateZone'),
            onSelect: () => {
              setActiveVariant(i)
              duplicateZone(name)
            },
          },
          {
            label: t('graph.ctx.deleteZone'),
            danger: true,
            onSelect: () => {
              setActiveVariant(i)
              removeZone(name)
            },
          },
        ],
      })
    },
    [t, setActiveVariant, duplicateZone, removeZone],
  )

  const openConnMenu = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>, i: number, id: string) => {
      e.preventDefault()
      setCtxMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            label: t('graph.ctx.duplicateConnection'),
            onSelect: () => {
              setActiveVariant(i)
              duplicateConnection(id)
            },
          },
          {
            label: t('graph.ctx.deleteConnection'),
            danger: true,
            onSelect: () => {
              setActiveVariant(i)
              removeConnection(id)
            },
          },
        ],
      })
    },
    [t, setActiveVariant, duplicateConnection, removeConnection],
  )

  const zonesTotal = counts.zones
  const connsTotal = counts.conns

  return (
    <div className="tree">
      <div className="tree__head">{t('tree.title')}</div>
      <div className="tree__search">
        <Search size={12} />
        <input
          className="input"
          placeholder={t('tree.filterPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="tree__scroll">
        <button type="button" className="tree-row tree-row--root" onClick={selectRoot} title={t('tree.rootTitle')}>
          <FileJson size={13} className="tree-row__icon" />
          <span className="tree-row__name">{template.name}</span>
          <span className="tree-row__meta">
            {gameModeLabel(template.gameMode, t)} · {template.sizeX ?? '?'}×{template.sizeZ ?? '?'}
          </span>
        </button>
        <div className="tree-group">
          <span className="tree-group__label">
            {t('tree.variantsCount', { count: variants.length })} · {t('tree.zonesCount', { count: zonesTotal })} ·{' '}
            {t('tree.connsCount', { count: connsTotal })}
          </span>
        </div>

        {variants.map((v, i) => {
          const isActive = i === activeVariant
          const zones = v.zones ?? []
          const conns = v.connections ?? []
          const zMatch = zones.filter(matchZone)
          const cMatch = conns.filter(matchConn)
          const hasMatch = zMatch.length > 0 || cMatch.length > 0
          const isOpen = q ? hasMatch : effectiveOpen(i)

          return (
            <div key={`${i}-${zones.length}`} className={`tree-variant${isActive ? ' is-active' : ''}`}>
              <div className="tree-row tree-row--variant" onClick={() => selectVariant(i)}>
                <LayoutGrid size={12} className="tree-row__icon" />
                <span className="tree-row__name">V{i + 1}</span>
                <span className="tree-row__meta">
                  {zones.length && conns.length
                    ? t('tree.variantZonesConns', { zones: zones.length, conns: conns.length })
                    : t('tree.variantElems', { n: zones.length || conns.length })}
                </span>
                <button
                  type="button"
                  className="tree-row__chev"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleVariant(i)
                  }}
                  title={isOpen ? t('tree.collapse') : t('tree.expand')}
                >
                  {isOpen ? '▾' : '▸'}
                </button>
              </div>

              {isOpen && (
                <div className="tree__branch">
                  <div className="tree-group">
                    <span className="tree-group__label">
                      <Layers size={11} /> {t('tree.zonesLabel')} {q ? `(${zMatch.length}/${zones.length})` : `(${zones.length})`}
                    </span>
                    {zMatch.length === 0 && <div className="tree-group__empty">{t('tree.noZones')}</div>}
                    {zMatch.map((z) => (
                      <ZoneRow
                        key={z.name}
                        zone={z}
                        onSelect={() => selectZone(i, z.name)}
                        onContextMenu={(e) => openZoneMenu(e, i, z.name)}
                      />
                    ))}
                  </div>
                  <div className="tree-group">
                    <span className="tree-group__label">
                      <GitBranch size={11} /> {t('tree.connsLabel')} {q ? `(${cMatch.length}/${conns.length})` : `(${conns.length})`}
                    </span>
                    {cMatch.length === 0 && <div className="tree-group__empty">{t('tree.noConns')}</div>}
                    {cMatch.map((c, ci) => (
                      <ConnRow
                        key={`${connId(c)}-${ci}`}
                        conn={c}
                        onSelect={() => selectConn(i, connId(c))}
                        onContextMenu={(e) => openConnMenu(e, i, connId(c))}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ContextMenu state={ctxMenu} onClose={closeCtxMenu} />
    </div>
  )
}