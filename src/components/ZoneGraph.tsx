import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../store/editorStore'
import { buildGraph, mergeEdges, mergeNodes, type Point } from '../utils/graph'
import { BIOME_LAYERS, nodeFillForView } from '../utils/viewModes'
import type { BudgetMetric, BudgetTarget, ViewMode } from '../types/viewMode'
import type { ZoneEdgeModel, ZoneNodeModel } from '../types/rf'
import type { Connection as TemplateConnection } from '../types/rmg'
import { RoadLayer } from './RoadLayer'
import { MandatoryLayer } from './MandatoryLayer'
import { ZoneEdge } from './ZoneEdge'
import { ZoneNode } from './ZoneNode'
import { ConfirmDialog } from './ConfirmDialog'
import { ContextMenu, type ContextMenuState } from './ContextMenu'

/** Минимальный структурный тип события ПКМ (React.MouseEvent или нативный MouseEvent). */
type CtxEvent = { preventDefault(): void; clientX: number; clientY: number }

const nodeTypes = { zone: ZoneNode } satisfies NodeTypes
const edgeTypes = { 'zone-edge': ZoneEdge } satisfies EdgeTypes

const connId = (c: Pick<TemplateConnection, 'name' | 'from' | 'to'>): string =>
  c.name ?? `${c.from}-${c.to}`

const VIEW_MODE_IDS: ViewMode[] = ['overview', 'budget', 'guard', 'biome', 'road', 'mandatory']

const BUDGET_METRICS: BudgetMetric[] = ['total', 'guarded', 'unguarded', 'resources']

const BUDGET_TARGETS: BudgetTarget[] = ['abs', 'perArea']

export function ZoneGraph() {
  return (
    <ReactFlowProvider>
      <ZoneGraphInner />
    </ReactFlowProvider>
  )
}

function ZoneGraphInner() {
  const { t } = useTranslation()
  const activeVariant = useEditorStore((s) => s.activeVariant)
  const template = useEditorStore((s) => s.template)
  const positions = useEditorStore((s) => s.positions)
  const select = useEditorStore((s) => s.select)
  const setZonePositions = useEditorStore((s) => s.setZonePositions)
  const addZone = useEditorStore((s) => s.addZone)
  const removeZone = useEditorStore((s) => s.removeZone)
  const duplicateZone = useEditorStore((s) => s.duplicateZone)
  const addConnection = useEditorStore((s) => s.addConnection)
  const removeConnection = useEditorStore((s) => s.removeConnection)
  const duplicateConnection = useEditorStore((s) => s.duplicateConnection)
  const viewMode = useEditorStore((s) => s.viewMode)
  const biomeLayer = useEditorStore((s) => s.biomeLayer)
  const budgetMetric = useEditorStore((s) => s.budgetMetric)
  const budgetTarget = useEditorStore((s) => s.budgetTarget)
  const focusSeq = useEditorStore((s) => s.focusSeq)
  const selection = useEditorStore((s) => s.selection)
  const setViewMode = useEditorStore((s) => s.setViewMode)
  const setBiomeLayer = useEditorStore((s) => s.setBiomeLayer)
  const setBudgetMetric = useEditorStore((s) => s.setBudgetMetric)
  const setBudgetTarget = useEditorStore((s) => s.setBudgetTarget)
  const { setCenter, getZoom, screenToFlowPosition } = useReactFlow()

  const variant = template.variants[activeVariant]
  const zones = variant?.zones ?? []

  const initial = useMemo(
    () => buildGraph(variant, positions[activeVariant] ?? {}),
    [variant, positions, activeVariant],
  )

  const focusRef = useRef(focusSeq)
  useEffect(() => {
    if (focusSeq === focusRef.current) return
    focusRef.current = focusSeq
    if (selection.kind === 'zone' && selection.id) {
      const node = initial.nodes.find((n) => n.id === selection.id)
      if (!node) return
      void setCenter(node.position.x, node.position.y, { zoom: getZoom(), duration: 320 })
      return
    }
    if (selection.kind === 'connection' && selection.id) {
      const edge = initial.edges.find(
        (e) => e.id === selection.id || (e.data ? connId(e.data.connection) === selection.id : false),
      )
      if (!edge) return
      const a = initial.nodes.find((n) => n.id === edge.source)
      const b = initial.nodes.find((n) => n.id === edge.target)
      const x = a && b ? (a.position.x + b.position.x) / 2 : (a ?? b)?.position.x
      const y = a && b ? (a.position.y + b.position.y) / 2 : (a ?? b)?.position.y
      if (x === undefined || y === undefined) return
      void setCenter(x, y, { zoom: getZoom(), duration: 320 })
    }
  }, [focusSeq, selection, initial, setCenter, getZoom])

  const [nodes, setNodes, onNodesChange] = useNodesState<ZoneNodeModel>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<ZoneEdgeModel>(initial.edges)

  /** Открытый диалог подтверждения удаления (null — закрыт); resolve — ответ ожидающему onBeforeDelete. */
  const [confirmDelete, setConfirmDelete] = useState<{
    message: string
    resolve: (ok: boolean) => void
  } | null>(null)

  useEffect(() => {
    // Слияние, а не замена целиком: сохраняет идентичность неизменённых узлов/рёбер
    // и служебные поля React Flow (measured/selected/dragging). Wholesale-замена
    // новыми объектами сбрасывала measured, и узлы на каждый коммит шаблона
    // уходили в visibility:hidden до повторного обмера ResizeObserver'ом
    // (в headless-гонках обмер мог не доставляться — узлы залипали скрытыми,
    // рёбра не рисовались). Детали — mergeNodes/mergeEdges в utils/graph.ts.
    setNodes((prev) => mergeNodes(prev, initial.nodes))
    setEdges((prev) => mergeEdges(prev, initial.edges))
  }, [initial, setNodes, setEdges])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (e.key < '1' || e.key > '6') return
      const target = e.target as HTMLElement | null
      if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) return
      setViewMode(VIEW_MODE_IDS[Number(e.key) - 1])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setViewMode])

  const onConnect: OnConnect = useCallback(
    (conn) => {
      if (conn.source && conn.target) addConnection(conn.source, conn.target)
    },
    [addConnection],
  )

  const onNodesDelete = useCallback(
    (deleted: ZoneNodeModel[]) => {
      for (const n of deleted) {
        const zone = n.data?.zone
        if (zone) removeZone(zone.name)
      }
    },
    [removeZone],
  )

  const onEdgesDelete = useCallback(
    (deleted: ZoneEdgeModel[]) => {
      for (const e of deleted) {
        const c = e.data?.connection
        removeConnection(c ? connId(c) : e.id)
      }
    },
    [removeConnection],
  )

  /** Подтверждение перед удалением с канвы (Backspace/Delete) — защита от случайного. */
  const onBeforeDelete = useCallback(
    async ({ nodes: delNodes, edges: delEdges }: { nodes: ZoneNodeModel[]; edges: ZoneEdgeModel[] }) => {
      if (delNodes.length === 0 && delEdges.length === 0) return true
      const zoneName = (n: ZoneNodeModel) => n.data?.zone.name ?? n.id
      let msg: string
      if (delNodes.length === 0 && delEdges.length === 1) {
        const c = delEdges[0].data?.connection
        msg = t('graph.confirmDelete.connection', { from: c?.from ?? '?', to: c?.to ?? '?' })
      } else if (delNodes.length === 1 && delEdges.length === 0) {
        msg = t('graph.confirmDelete.zone', { zone: zoneName(delNodes[0]) })
      } else if (delNodes.length === 1) {
        msg = t('graph.confirmDelete.zoneWithConnections', {
          zone: zoneName(delNodes[0]),
          connections: t('graph.connections', { count: delEdges.length }),
        })
      } else {
        const parts: string[] = []
        if (delNodes.length > 0) parts.push(t('graph.zones', { count: delNodes.length }))
        if (delEdges.length > 0) parts.push(t('graph.connections', { count: delEdges.length }))
        msg = t('graph.confirmDelete.multiple', { items: parts.join(', ') })
      }
      // Нативный window.confirm заменён модалкой: промис резолвится ответом диалога.
      // Повторное открытие (пока диалог висит) отменяет предыдущее ожидание.
      return new Promise<boolean>((resolve) => {
        setConfirmDelete((prev) => {
          prev?.resolve(false)
          return { message: msg, resolve }
        })
      })
    },
    [t, setConfirmDelete],
  )

  const handleAddZone = useCallback(() => {
    let cx = 0
    let cy = 0
    if (nodes.length > 0) {
      const xs = nodes.map((n) => n.position.x)
      const ys = nodes.map((n) => n.position.y)
      cx = (Math.min(...xs) + Math.max(...xs)) / 2 + 140
      cy = (Math.min(...ys) + Math.max(...ys)) / 2
    }
    addZone({ x: cx, y: cy })
  }, [nodes, addZone])

  /** Контекстное меню (ПКМ): канва — создать зону; зона — дублировать/удалить; связь — дублировать/удалить. */
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  const openPaneMenu = useCallback(
    (event: CtxEvent) => {
      event.preventDefault()
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setCtxMenu({
        x: event.clientX,
        y: event.clientY,
        items: [{ label: t('graph.ctx.createZone'), onSelect: () => addZone({ x: point.x, y: point.y }) }],
      })
    },
    [screenToFlowPosition, addZone, t],
  )

  const openNodeMenu = useCallback(
    (event: CtxEvent, node: ZoneNodeModel) => {
      event.preventDefault()
      const name = node.data?.zone.name
      if (!name) return
      setCtxMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          { label: t('graph.ctx.duplicateZone'), onSelect: () => duplicateZone(name) },
          { label: t('graph.ctx.deleteZone'), danger: true, onSelect: () => removeZone(name) },
        ],
      })
    },
    [t, duplicateZone, removeZone],
  )

  const openEdgeMenu = useCallback(
    (event: CtxEvent, edge: ZoneEdgeModel) => {
      event.preventDefault()
      const c = edge.data?.connection
      const id = c ? connId(c) : edge.id
      setCtxMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          { label: t('graph.ctx.duplicateConnection'), onSelect: () => duplicateConnection(id) },
          { label: t('graph.ctx.deleteConnection'), danger: true, onSelect: () => removeConnection(id) },
        ],
      })
    },
    [t, duplicateConnection, removeConnection],
  )

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      connectionMode={ConnectionMode.Loose}
      onNodesChange={onNodesChange as OnNodesChange<ZoneNodeModel>}
      onEdgesChange={onEdgesChange as OnEdgesChange<ZoneEdgeModel>}
      onConnect={onConnect}
      onNodesDelete={onNodesDelete}
      onEdgesDelete={onEdgesDelete}
      onBeforeDelete={onBeforeDelete}
      deleteKeyCode={['Backspace', 'Delete']}
      onNodeClick={(_, node) => {
        const z = (node as unknown as ZoneNodeModel).data?.zone
        select('zone', z ? z.name : node.id)
      }}
      onEdgeClick={(_, edge) => {
        const c = (edge as unknown as ZoneEdgeModel).data?.connection
        select('connection', c ? connId(c) : edge.id)
      }}
      onPaneClick={() => select(null, null)}
      onPaneContextMenu={openPaneMenu}
      onNodeContextMenu={(event, node) => openNodeMenu(event, node as unknown as ZoneNodeModel)}
      onEdgeContextMenu={(event, edge) => openEdgeMenu(event, edge as unknown as ZoneEdgeModel)}
      onNodeDragStop={(_, _node, draggedNodes) => {
        const updates: Record<string, Point> = {}
        for (const n of draggedNodes) {
          const z = (n as unknown as ZoneNodeModel).data?.zone
          if (z) updates[z.name] = { x: n.position.x, y: n.position.y }
        }
        if (Object.keys(updates).length > 0) setZonePositions(updates)
      }}
      nodeOrigin={[0.5, 0.5]}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      minZoom={0.2}
      maxZoom={2.5}
      colorMode="dark"
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#262c37" />
      {viewMode === 'road' && <RoadLayer />}
      {viewMode === 'mandatory' && <MandatoryLayer />}
      <Controls showInteractive={false} />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        nodeStrokeWidth={2}
        maskColor="rgba(0,0,0,0.55)"
        nodeColor={(n) => {
          const zone = (n as ZoneNodeModel).data?.zone
          if (!zone) return '#3a3f4d'
          return nodeFillForView(zone, viewMode, biomeLayer, zones, budgetMetric, budgetTarget).background
        }}
      />
      <Panel position="top-center" className="vm-bar">
        <div className="vm-modes">
          {VIEW_MODE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`vm-mode${viewMode === id ? ' is-on' : ''}`}
              title={t(`graph.modes.${id}.hint`)}
              onClick={() => setViewMode(id)}
            >
              {t(`graph.modes.${id}.label`)}
            </button>
          ))}
        </div>
        {viewMode === 'biome' && (
          <div className="vm-sub">
            <span className="vm-sub__label">{t('graph.biomeLayer')}</span>
            {BIOME_LAYERS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`vm-chip${biomeLayer === l.id ? ' is-on' : ''}`}
                title={l.field}
                onClick={() => setBiomeLayer(l.id)}
              >
                {t(`biomes.layers.${l.id}`)}
              </button>
            ))}
          </div>
        )}
        {viewMode === 'budget' && (
          <div className="vm-sub">
            <span className="vm-sub__label">{t('graph.metric')}</span>
            {BUDGET_METRICS.map((m) => (
              <button
                key={m}
                type="button"
                className={`vm-chip${budgetMetric === m ? ' is-on' : ''}`}
                title={t(`graph.metrics.${m}.title`)}
                onClick={() => setBudgetMetric(m)}
              >
                {t(`graph.metrics.${m}.label`)}
              </button>
            ))}
            <span className="vm-sub__sep" />
            {BUDGET_TARGETS.map((bt) => (
              <button
                key={bt}
                type="button"
                className={`vm-chip${budgetTarget === bt ? ' is-on' : ''}`}
                onClick={() => setBudgetTarget(bt)}
              >
                {t(`graph.target.${bt}`)}
              </button>
            ))}
          </div>
        )}
      </Panel>
      <Panel position="top-left" className="rf-panel">
        <span>
          {t('graph.zones', { count: zones.length })} · {t('graph.connections', { count: variant?.connections?.length ?? 0 })}
        </span>
        <button type="button" className="btn" onClick={handleAddZone} title={t('graph.addZoneTitle')}>
          {t('graph.addZone')}
        </button>
      </Panel>
      <Panel position="bottom-left" className="rf-panel rf-hint">{t('graph.hint')}</Panel>
      </ReactFlow>
      <ConfirmDialog
        open={confirmDelete !== null}
        title={t('graph.confirmDelete.title')}
        message={confirmDelete?.message ?? ''}
        confirmLabel={t('confirm.delete')}
        cancelLabel={t('confirm.cancel')}
        hint={t('confirm.deleteHint')}
        danger
        onConfirm={() => {
          confirmDelete?.resolve(true)
          setConfirmDelete(null)
        }}
        onCancel={() => {
          confirmDelete?.resolve(false)
          setConfirmDelete(null)
        }}
      />
      <ContextMenu state={ctxMenu} onClose={closeCtxMenu} />
    </>
  )
}