import { create } from 'zustand'
import i18n from '../i18n'
import type { RmgTemplate } from '../types/rmg'
import type { Connection as TemplateConnection, Variant, Zone } from '../types/rmg'
import type { BiomeLayer, BudgetMetric, BudgetTarget, ViewMode } from '../types/viewMode'
import { completePositions, type Point } from '../utils/graph'
import type { JsonDraftError } from '../utils/jsonEdit'
import { renameZoneInTemplate, renameZoneNotes, renameZonePositions } from '../utils/renameZone'
import type { SidecarData } from '../utils/fsAccess'
import { parseSnapshot, serializeSnapshot } from '../utils/sessionSnapshot'

export interface Selection {
  kind: 'zone' | 'connection' | null
  id: string | null
}

export type InspectorTab = 'inspector' | 'content' | 'limits' | 'root' | 'variant'

/**
 * Цель навигации «зона → корневая группа»: kind — какая панель
 * ('mc' — вкладка «Контент», 'cl' — «Лимиты»), name — точное имя группы в
 * .rmg.json (ссылки зон совпадают с ним строкой). seq — монотонный счётчик:
 * повторный переход к той же группе снова прокручивает и подсвечивает её.
 */
export interface GroupTarget {
  kind: 'mc' | 'cl'
  name: string
  seq: number
}

/** Уведомление-тост (замена нативных alert). Персистентное: закрывается только кликом. */
export interface ToastMessage {
  id: number
  kind: 'error' | 'info'
  /** Готовый переведённый текст (собирает вызывающий код через t()). */
  text: string
}

/**
 * Слепок состояния для undo/redo. Хранит только «редактируемые» поля.
 * Ссылки безопасны: все мутации в сторе создают новые объекты, старые не меняются.
 */
export interface HistorySnapshot {
  template: RmgTemplate
  positions: Record<string, Point>[]
  activeVariant: number
  selection: Selection
  /** Заметки по зонам (sidecar) — редактируются как состояние шаблона, участвуют в undo/redo. */
  notes: Record<string, string>
}

/** Максимальная глубина истории отмены. */
const MAX_HISTORY = 100

/** Пустой шаблон «с нуля»: стартовое состояние редактора (dev и release) и action newTemplate. */
function makeEmptyTemplate(name: string): RmgTemplate {
  return {
    name,
    gameMode: 'Classic',
    description: '',
    displayWinCondition: 'win_condition_1',
    sizeX: 128,
    sizeZ: 128,
    valueOverrides: [],
    gameRules: {},
    zoneLayouts: [{ name: 'zone_layout_default' }],
    mandatoryContent: [],
    contentCountLimits: [],
    contentPools: [],
    contentLists: [],
    variants: [{ zones: [], connections: [] }],
  }
}

/** Монотонный счётчик id тостов (уникальность в рамках сессии). */
let toastSeq = 0

/** Монотонный счётчик запросов навигации к корневой группе (см. GroupTarget.seq). */
let groupSeq = 0

/** Ключ localStorage, под которым хранится раскладка свёрнутых/развёрнутых блоков редакторов. */
const SECTIONS_KEY = 'oe-editor:sections'

/** Локальные предпочтения пользователя по раскладке секций (без открытого шаблона). */
function readSectionStates(): Record<string, boolean> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(SECTIONS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

/** Сохранить полную раскладку секций в localStorage (недоступен — тихо пропускаем). */
function writeSectionStates(states: Record<string, boolean>): void {
  try {
    localStorage.setItem(SECTIONS_KEY, JSON.stringify(states))
  } catch {
    /* localStorage недоступен — раскладка не переживёт перезапуск */
  }
}

/**
 * Ключ localStorage, под которым живёт аварийный снапшот сессии (см. utils/sessionSnapshot.ts).
 * Снапшот зеркалит текущее состояние на каждом изменении (с дебаунсом) и молча
 * восстанавливается при следующем запуске — работа продолжается, как будто не прерывалась.
 */
const SESSION_KEY = 'oe-editor:session'

/** Прочитать снапшот сессии из localStorage; null — нет/битый/localStorage недоступен. */
function readSessionSnapshot(): ReturnType<typeof parseSnapshot> {
  try {
    if (typeof localStorage === 'undefined') return null
    return parseSnapshot(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

/** Снапшот прошлой сессии, восстановленный при старте модуля (в node/без localStorage — null). */
const restoredSession = readSessionSnapshot()

/** Стартовый шаблон: снапшот прошлой сессии или пустой «Новый шаблон». */
const initialTemplate = restoredSession?.template ?? makeEmptyTemplate(i18n.t('store.newTemplateName'))

/** ЧЧ:ММ момента записи снапшота в активной локали; null — время неизвестно или не форматируется. */
function formatSnapshotTime(savedAt: number | null | undefined): string | null {
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null
  try {
    return new Date(savedAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return null
  }
}

/**
 * Info-тост о восстановлении прошлой сессии: сообщает факт восстановления и
 * момент записи снапшота (если известен). Без него откат к устаревшей копии
 * состояния невидим — пользователь узнаёт о потере постфактум.
 */
function makeSessionRestoredToast(savedAt: number | null | undefined): ToastMessage {
  const time = formatSnapshotTime(savedAt)
  return {
    id: ++toastSeq,
    kind: 'info',
    text: time !== null ? i18n.t('store.sessionRestoredAt', { time }) : i18n.t('store.sessionRestored'),
  }
}

export interface EditorState {
  /** История отмены: состояние до каждого изменения (память-стек). */
  past: HistorySnapshot[]
  /** История повтора: состояния, отменённые через undo. */
  future: HistorySnapshot[]
  /** Отменить последнее изменение. */
  undo: () => void
  /** Повторить отменённое изменение. */
  redo: () => void
  template: RmgTemplate
  /**
   * Есть несохранённые на диск изменения (относительно последнего сохранения/загрузки).
   * Любой commit()/undo/redo выставляет true; loadTemplate/newTemplate/markSaved — false.
   * Гейтит модалку-предупреждение «изменения будут утеряны» при Новом/Открытии файла/папки.
   */
  dirty: boolean
  sourceName: string | null
  rootName: string | null
  dirHandle: FileSystemDirectoryHandle | null
  activeVariant: number
  /**
   * Индекс варианта B для режима сравнения (null — сравнение выключено).
   * UI-состояние: шаблон не мутируется, в историю (commit) не попадает.
   */
  compareWith: number | null
  /**
   * Активные уведомления-тосты (замена window.alert). UI-состояние: шаблон
   * не мутируется, в историю (commit) не попадает, при load/new не сбрасывается.
   */
  toasts: ToastMessage[]
  positions: Record<string, Point>[]
  selection: Selection
  /**
   * Пользовательские заметки по зонам (ключ — имя зоны). Живут в sidecar `.editor.json`,
   * в `.rmg.json` не попадают; входят в undo-снапшот (редактируются как состояние шаблона).
   */
  notes: Record<string, string>
  /** Записать заметку зоны; пустой текст удаляет ключ. No-op при том же значении. */
  setZoneNote: (zoneName: string, text: string) => void
  /**
   * Раскладка свёрнутых секций инспектора (persistKey → развёрнут). UI-состояние:
   * в историю не коммитится, но пишется в localStorage и путешествует с sidecar шаблона.
   */
  sectionStates: Record<string, boolean>
  /** Запомнить состояние секции (стора + localStorage). */
  setSectionState: (key: string, open: boolean) => void
  /** Монотонный счётчик запросов «навести камеру канвы на selection» (из дерева). */
  focusSeq: number
  inspectorTab: InspectorTab
  /**
   * Запрос перехода к корневой группе mandatoryContent / contentCountLimits
   * (навигация зона→группа). UI-состояние: шаблон не мутируется, в
   * историю (commit) не попадает; null — запроса нет. Карточка группы
   * (RootPanels.tsx) отрабатывает его прокруткой+подсветкой и гасит.
   */
  groupTarget: GroupTarget | null
  loadSeq: number
  /**
   * Ошибки черновиков «умного» JSON-редактора: ключ → ошибка (null — черновик
   * валиден). Ключи: `zone:<имя>`, `conn:<id>`, `root`. Пока есть хотя бы одна
   * ошибка, сохранение шаблона заблокировано (App.tsx), а ValidatorPanel
   * показывает их в списке замечаний.
   */
  jsonDraftErrors: Record<string, JsonDraftError | null>
  setJsonDraftError: (key: string, error: JsonDraftError | null) => void
  /** Полная замена зоны (JSON-черновик); null — успех, иначе код ошибки. */
  replaceZone: (oldName: string, next: Zone) => JsonDraftError | null
  /** Полная замена связи (JSON-черновик); null — успех, иначе код ошибки. */
  replaceConnection: (id: string, next: TemplateConnection) => JsonDraftError | null
  /** Замена шаблона из корневого JSON-черновика (зоны/связи уже слиты). */
  applyRootJson: (next: RmgTemplate) => void
  viewMode: ViewMode
  biomeLayer: BiomeLayer
  budgetMetric: BudgetMetric
  budgetTarget: BudgetTarget
  setActiveVariant: (index: number) => void
  setCompareWith: (index: number | null) => void
  /** Показать тост (персистентный до клика); kind по умолчанию — 'error'. */
  pushToast: (text: string, kind?: 'error' | 'info') => void
  /** Закрыть тост по id. */
  dismissToast: (id: number) => void
  /** focus=true — дополнительно запросить навигацию камеры к выбранному элементу. */
  select: (kind: Selection['kind'], id: string | null, focus?: boolean) => void
  setInspectorTab: (tab: InspectorTab) => void
  /**
   * Перейти к корневой группе: переключает вкладку инспектора («Контент» для mc,
   * «Лимиты» для cl) и запрашивает прокрутку+подсветку карточки группы.
   * Выбор зоны/связи не сбрасывается — можно вернуться на вкладку «Инспектор».
   */
  goToGroup: (kind: GroupTarget['kind'], name: string) => void
  /** Снять запрос подсветки (вызывает карточка группы, отработав прокрутку). */
  clearGroupTarget: () => void
  setViewMode: (mode: ViewMode) => void
  setBiomeLayer: (layer: BiomeLayer) => void
  setBudgetMetric: (metric: BudgetMetric) => void
  setBudgetTarget: (target: BudgetTarget) => void
  setZonePosition: (zoneName: string, pos: Point) => void
  /** Оптовая запись позиций (мульти-перетаскивание) — один коммит в историю. */
  setZonePositions: (updates: Record<string, Point>) => void
  loadTemplate: (template: RmgTemplate, sourceName: string, sidecar?: SidecarData | null) => void
  setDirectory: (rootName: string, dirHandle: FileSystemDirectoryHandle) => void
  findZone: (id: string) => Zone | undefined
  findConnection: (id: string) => TemplateConnection | undefined
  patchZone: (id: string, patch: Partial<Zone>) => void
  /** Каскадное переименование зоны со всеми ссылками. false — имя пустое/занято/зона не найдена. */
  renameZone: (oldName: string, newName: string) => boolean
  patchConnection: (id: string, patch: Partial<TemplateConnection>) => void
  patchRoot: (patch: Partial<RmgTemplate>) => void
  patchActiveVariant: (patch: Partial<Variant>) => void
  renameMandatoryGroup: (oldName: string, newName: string) => void
  renameContentLimitGroup: (oldName: string, newName: string) => void
  /** Удаляет корневую группу и каскадно вычищает её имя из ссылок зон (все варианты). No-op, если группы нет. */
  deleteMandatoryGroup: (name: string) => void
  deleteContentLimitGroup: (name: string) => void
  addZone: (pos?: Point) => void
  removeZone: (name: string) => void
  /** Дублирует зону активного варианта: полная копия полей, новое уникальное имя, позиция со сдвигом. Связи и заметка не копируются. No-op, если зоны нет. */
  duplicateZone: (name: string) => void
  /** Создаёт связь. Повторный драг между той же парой создаёт ещё одну параллельную связь (как в JebusCross): первая остаётся безымянной, следующим присваивается уникальное имя `From-To-N`. */
  addConnection: (from: string, to: string) => void
  removeConnection: (id: string) => void
  /** Дублирует связь активного варианта: полная копия полей с новым уникальным именем (`id-N`), вставляется сразу за оригиналом и выделяется. No-op, если связи нет. */
  duplicateConnection: (id: string) => void
  duplicateVariant: () => void
  removeVariant: () => void
  newTemplate: () => void
  /** Отметить состояние как сохранённое на диск (сбрасывает dirty); вызывает успешное сохранение. */
  markSaved: () => void
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  // При старте восстанавливаем снапшот прошлой сессии (если есть), иначе —
  // пустой «Новый шаблон» (dev и release одинаково). Восстановление бесшовное,
  // но не невидимое: info-тост сообщает факт и момент последней записи снапшота.
  template: initialTemplate,
  sourceName: restoredSession?.sourceName ?? null,
  rootName: null,
  dirHandle: null,
  activeVariant: restoredSession?.activeVariant ?? 0,
  compareWith: null,
  toasts: restoredSession ? [makeSessionRestoredToast(restoredSession.savedAt)] : [],
  positions: normalizePositions(initialTemplate, restoredSession?.positions),
  notes: restoredSession?.notes ?? {},
  sectionStates: restoredSession?.sectionStates ?? readSectionStates(),
  selection: { kind: null, id: null },
  focusSeq: 0,
  // История undo/redo намеренно не сохраняется — при восстановлении сбрасывается.
  past: [],
  future: [],
  dirty: restoredSession?.dirty ?? false,
  inspectorTab: 'inspector',
  groupTarget: null,
  loadSeq: 0,
  jsonDraftErrors: {},
  viewMode: 'overview',
  biomeLayer: 'zone',
  budgetMetric: 'total',
  budgetTarget: 'abs',

  setActiveVariant: (index) => {
    const { positions, template } = get()
    if (index < 0 || index >= template.variants.length) return
    const next = [...positions]
    if (!next[index]) next[index] = {}
    set({ activeVariant: index, selection: { kind: null, id: null }, positions: next })
  },

  setCompareWith: (index) => set({ compareWith: index }),

  pushToast: (text, kind = 'error') =>
    set((state) => ({ toasts: [...state.toasts, { id: ++toastSeq, kind, text }] })),

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  setZoneNote: (zoneName, text) => {
    const { notes } = get()
    const value = text.trim() === '' ? undefined : text
    if ((notes[zoneName] ?? undefined) === value) return
    const next = { ...notes }
    if (value === undefined) delete next[zoneName]
    else next[zoneName] = value
    commit(set, get, { notes: next })
  },

  setSectionState: (key, open) => {
    const { sectionStates } = get()
    if (sectionStates[key] === open) return
    const next = { ...sectionStates, [key]: open }
    writeSectionStates(next)
    set({ sectionStates: next })
  },

  select: (kind, id, focus) =>
    set((state) =>
      id
        ? {
            selection: { kind, id },
            inspectorTab: 'inspector',
            focusSeq: focus ? state.focusSeq + 1 : state.focusSeq,
          }
        : { selection: { kind, id } },
    ),

  setInspectorTab: (tab) => set({ inspectorTab: tab }),

  goToGroup: (kind, name) =>
    set({
      inspectorTab: kind === 'mc' ? 'content' : 'limits',
      groupTarget: { kind, name, seq: ++groupSeq },
    }),

  clearGroupTarget: () => set({ groupTarget: null }),

  setViewMode: (viewMode) => set({ viewMode }),

  setBiomeLayer: (biomeLayer) => set({ biomeLayer }),

  setBudgetMetric: (budgetMetric) => set({ budgetMetric }),

  setBudgetTarget: (budgetTarget) => set({ budgetTarget }),

  undo: () => {
    const state = get()
    if (state.past.length === 0) return
    const snapshot = state.past[state.past.length - 1]
    set({
      template: snapshot.template,
      positions: snapshot.positions,
      activeVariant: snapshot.activeVariant,
      selection: snapshot.selection,
      notes: snapshot.notes,
      past: state.past.slice(0, -1),
      future: [...state.future, makeSnapshot(state)],
      dirty: true,
    })
  },

  redo: () => {
    const state = get()
    if (state.future.length === 0) return
    const snapshot = state.future[state.future.length - 1]
    set({
      template: snapshot.template,
      positions: snapshot.positions,
      activeVariant: snapshot.activeVariant,
      selection: snapshot.selection,
      notes: snapshot.notes,
      past: [...state.past, makeSnapshot(state)],
      future: state.future.slice(0, -1),
      dirty: true,
    })
  },

  setZonePosition: (zoneName, pos) => {
    const { activeVariant, positions } = get()
    const next = [...positions]
    next[activeVariant] = { ...(next[activeVariant] ?? {}), [zoneName]: pos }
    commit(set, get, { positions: next })
  },

  setZonePositions: (updates) => {
    const { activeVariant, positions } = get()
    const next = [...positions]
    next[activeVariant] = { ...(next[activeVariant] ?? {}), ...updates }
    commit(set, get, { positions: next })
  },

  loadTemplate: (template, sourceName, sidecar) => {
    set((state) => ({
      template,
      sourceName,
      activeVariant: 0,
      compareWith: null,
      positions: normalizePositions(template, sidecar?.positions),
      notes: { ...(sidecar?.notes ?? {}) },
      // Раскладка секций — из sidecar шаблона; минимальный sidecar (только позиции)
      // её не содержит — тогда локальные предпочтения пользователя (localStorage).
      sectionStates: hasKeys(sidecar?.sectionStates)
        ? { ...sidecar?.sectionStates }
        : readSectionStates(),
      selection: { kind: null, id: null },
      // Запрос навигации к группе относится к прежнему шаблону — гасим.
      groupTarget: null,
      loadSeq: state.loadSeq + 1,
      jsonDraftErrors: {},
      past: [],
      future: [],
      dirty: false,
    }))
  },

  setDirectory: (rootName, dirHandle) => set({ rootName, dirHandle }),

  findZone: (id) => {
    const { template, activeVariant } = get()
    return template.variants[activeVariant]?.zones?.find((z) => z.name === id)
  },

  findConnection: (id) => {
    const { template, activeVariant } = get()
    return template.variants[activeVariant]?.connections?.find(
      (c) => (c.name ?? `${c.from}-${c.to}`) === id,
    )
  },

  patchZone: (id, patch) => {
    const state = get()
    const variant = state.template.variants[state.activeVariant]
    if (!variant) return
    const zones = variant.zones.map((z) => (z.name === id ? { ...z, ...patch } : z))
    const template = updateVariant(state.template, state.activeVariant, (v) => ({ ...v, zones }))
    commit(set, get, { template })
  },

  renameZone: (oldName, newName) => {
    const name = newName.trim()
    if (!name || name === oldName) return false
    const { template, positions, notes, selection } = get()
    const affected = template.variants.filter((v) => (v.zones ?? []).some((z) => z.name === oldName))
    if (affected.length === 0) return false
    for (const v of affected) {
      if ((v.zones ?? []).some((z) => z.name === name)) return false
    }
    const next: RmgTemplate = renameZoneInTemplate(template, oldName, name)
    const nextPositions = renameZonePositions(positions, oldName, name)
    const nextNotes = renameZoneNotes(notes, oldName, name)
    const nextSelection: Selection =
      selection.kind === 'zone' && selection.id === oldName
        ? { kind: 'zone', id: name }
        : selection
    commit(set, get, { template: next, positions: nextPositions, notes: nextNotes, selection: nextSelection })
    return true
  },

  patchConnection: (id, patch) => {
    const state = get()
    const variant = state.template.variants[state.activeVariant]
    if (!variant) return
    let renamed: string | null = null
    const connections = variant.connections.map((c) => {
      const cid = c.name ?? `${c.from}-${c.to}`
      if (cid !== id) return c
      const next = { ...c, ...patch }
      const nid = next.name ?? `${next.from}-${next.to}`
      if (nid !== cid) renamed = nid
      return next
    })
    const template = updateVariant(state.template, state.activeVariant, (v) => ({ ...v, connections }))
    if (renamed) commit(set, get, { template, selection: { kind: 'connection', id: renamed } })
    else commit(set, get, { template })
  },

  patchRoot: (patch) =>
    commit(set, get, { template: { ...get().template, ...patch } }),

  patchActiveVariant: (patch) => {
    const state = get()
    const active = state.activeVariant
    if (!state.template.variants[active]) return
    const template = {
      ...state.template,
      variants: state.template.variants.map((v, i) => (i === active ? { ...v, ...patch } : v)),
    }
    commit(set, get, { template })
  },

  renameMandatoryGroup: (oldName, newName) =>
    renameGroup(set, get, 'mandatoryContent', oldName, newName),

  deleteMandatoryGroup: (name) => deleteGroup(set, get, 'mandatoryContent', name),

  setJsonDraftError: (key, error) => {
    const cur = get().jsonDraftErrors[key]
    // Защита от «бесконечного» ре-рендера: новый объект с теми же code/detail — no-op.
    if (cur === error) return
    if (cur?.code === error?.code && cur?.detail === error?.detail) return
    set((s) => ({ jsonDraftErrors: { ...s.jsonDraftErrors, [key]: error } }))
  },

  replaceZone: (oldName, next) => {
    const state = get()
    const { template, positions, notes, selection, activeVariant } = state
    const variant = template.variants[activeVariant]
    if (!variant || !(variant.zones ?? []).some((z) => z.name === oldName)) {
      return { code: 'zoneNameMissing' }
    }
    const name = typeof next.name === 'string' ? next.name.trim() : ''
    if (!name) return { code: 'zoneNameMissing' }
    if (name !== oldName) {
      const affected = template.variants.filter((v) => (v.zones ?? []).some((z) => z.name === oldName))
      for (const v of affected) {
        if ((v.zones ?? []).some((z) => z.name === name)) return { code: 'zoneNameTaken', detail: name }
      }
    }
    let nextTemplate = updateVariant(template, activeVariant, (v) => ({
      ...v,
      zones: v.zones.map((z) => (z.name === oldName ? { ...next, name } : z)),
    }))
    let nextPositions = positions
    let nextNotes = notes
    let nextSelection = selection
    if (name !== oldName) {
      // Каскад как в renameZone: ссылки, неявные id связей, позиции, заметки, selection.
      nextTemplate = renameZoneInTemplate(nextTemplate, oldName, name)
      nextPositions = renameZonePositions(positions, oldName, name)
      nextNotes = renameZoneNotes(notes, oldName, name)
      if (selection.kind === 'zone' && selection.id === oldName) {
        nextSelection = { kind: 'zone', id: name }
      }
    }
    commit(set, get, { template: nextTemplate, positions: nextPositions, notes: nextNotes, selection: nextSelection })
    return null
  },

  replaceConnection: (id, next) => {
    const state = get()
    const variant = state.template.variants[state.activeVariant]
    if (!variant) return { code: 'connNotFound', detail: id }
    const idx = variant.connections.findIndex((c) => (c.name ?? `${c.from}-${c.to}`) === id)
    if (idx < 0) return { code: 'connNotFound', detail: id }
    const connections = variant.connections.map((c, i) => (i === idx ? next : c))
    const template = updateVariant(state.template, state.activeVariant, (v) => ({ ...v, connections }))
    const newId = next.name ?? `${next.from}-${next.to}`
    const selection =
      newId !== id && state.selection.kind === 'connection' && state.selection.id === id
        ? { kind: 'connection' as const, id: newId }
        : state.selection
    commit(set, get, { template, selection })
    return null
  },

  applyRootJson: (next) => {
    commit(set, get, { template: next })
  },

  renameContentLimitGroup: (oldName, newName) =>
    renameGroup(set, get, 'contentCountLimits', oldName, newName),

  deleteContentLimitGroup: (name) => deleteGroup(set, get, 'contentCountLimits', name),

  addZone: (pos) => {
    const { template, activeVariant, positions } = get()
    const variant = template.variants[activeVariant]
    if (!variant) return
    const name = uniqueZoneName((variant.zones ?? []).map((z) => z.name))
    const firstLayout = Array.isArray(template.zoneLayouts) ? (template.zoneLayouts[0] as { name?: string } | undefined)?.name : undefined
    const zone: Zone = {
      name,
      size: 0.9,
      layout: firstLayout ?? 'zone_layout_empty',
      mainObjects: [],
      zoneBiome: { type: 'FromList', args: [] },
      contentBiome: { type: 'FromList', args: [] },
      metaObjectsBiome: { type: 'FromList', args: [] },
      guardReactionDistribution: [1, 1, 1, 1, 1, 1],
    }
    const nextPositions = setVariantPositions(positions, activeVariant, name, pos ?? { x: 240 + Math.random() * 120, y: 200 + Math.random() * 120 })
    const template2 = updateVariant(template, activeVariant, (v) => ({ ...v, zones: [...(v.zones ?? []), zone] }))
    commit(set, get, { template: template2, positions: nextPositions, selection: { kind: 'zone', id: name } })
  },

  removeZone: (name) => {
    const { template, activeVariant, positions, notes } = get()
    const variant = template.variants[activeVariant]
    if (!variant) return
    const zones = (variant.zones ?? []).filter((z) => z.name !== name)
    const connections = (variant.connections ?? []).filter((c) => c.from !== name && c.to !== name)
    const template2 = updateVariant(template, activeVariant, (v) => ({ ...v, zones, connections }))
    const nextPositions = positions.map((slot, i) =>
      i === activeVariant ? omitPosition(slot, name) : slot,
    )
    const nextNotes = { ...notes }
    delete nextNotes[name]
    commit(set, get, {
      template: template2,
      positions: nextPositions,
      notes: nextNotes,
      selection: { kind: 'zone', id: null },
    })
  },

  duplicateZone: (name) => {
    const { template, activeVariant, positions } = get()
    const variant = template.variants[activeVariant]
    if (!variant) return
    const source = variant.zones?.find((z) => z.name === name)
    if (!source) return
    const newName = uniqueZoneName((variant.zones ?? []).map((z) => z.name))
    const copy: Zone = { ...structCopy(source), name: newName }
    const srcPos = positions[activeVariant]?.[name]
    const nextPos = srcPos
      ? { x: srcPos.x + 48, y: srcPos.y + 48 }
      : { x: 240 + Math.random() * 120, y: 200 + Math.random() * 120 }
    const nextPositions = setVariantPositions(positions, activeVariant, newName, nextPos)
    const template2 = updateVariant(template, activeVariant, (v) => ({ ...v, zones: [...(v.zones ?? []), copy] }))
    commit(set, get, { template: template2, positions: nextPositions, selection: { kind: 'zone', id: newName } })
  },

  addConnection: (from, to) => {
    if (!from || !to || from === to) return
    const { template, activeVariant } = get()
    const variant = template.variants[activeVariant]
    if (!variant) return
    // Параллельные связи между одной парой зон легальны (официальный JebusCross:
    // по 5 связей Center↔Spawn/Side). Каждой нужен уникальный эффективный id
    // (`name ?? from-to`) — иначе выделение/удаление спутает двойняшек.
    // Правило имён при создании драгом: первая связь пары остаётся безымянной
    // (авто-имя From-To); каждая следующая — с явным именем НЕЗАВИСИМО от
    // направления драга: в ту же сторону — `from-to-N` (авто-имя занято
    // двойняшкой), в обратную — собственное `from-to`. Без второй ветви поле
    // «Имя связи» инспектора у обратной параллели оставалось пустым при
    // заполненном у прямой — прецедент штатного Shamrock: безымянная
    // Center→Side-A при именованной Side-A-Center (имя = собственный from-to).
    const base = `${from}-${to}`
    const conns = variant.connections ?? []
    const used = new Set(conns.map((c) => c.name ?? `${c.from}-${c.to}`))
    const pairBusy = conns.some(
      (c) => (c.from === from && c.to === to) || (c.from === to && c.to === from),
    )
    const conn: TemplateConnection = {
      connectionType: 'Direct',
      from,
      to,
      road: true,
      guardValue: 8000,
      guardWeeklyIncrement: 0.1,
    }
    if (used.has(base) || pairBusy) {
      conn.name = used.has(base) ? nextConnectionName(conns, base) : base
    }
    const template2 = updateVariant(template, activeVariant, (v) => ({ ...v, connections: [...(v.connections ?? []), conn] }))
    commit(set, get, { template: template2, selection: { kind: 'connection', id: conn.name ?? base } })
  },

  removeConnection: (id) => {
    const { template, activeVariant } = get()
    const variant = template.variants[activeVariant]
    if (!variant) return
    // Удаляем ровно одну (первую) связь: в рукописном JSON возможны двойняшки
    // с совпадающим id — filter вычистил бы их все разом.
    const idx = variant.connections.findIndex((c) => (c.name ?? `${c.from}-${c.to}`) === id)
    if (idx < 0) return
    const connections = variant.connections.filter((_, i) => i !== idx)
    const template2 = updateVariant(template, activeVariant, (v) => ({ ...v, connections }))
    commit(set, get, { template: template2, selection: { kind: 'connection', id: null } })
  },

  duplicateConnection: (id) => {
    const { template, activeVariant } = get()
    const variant = template.variants[activeVariant]
    if (!variant) return
    const idx = variant.connections.findIndex((c) => (c.name ?? `${c.from}-${c.to}`) === id)
    if (idx < 0) return
    const name = nextConnectionName(variant.connections, id)
    const copy: TemplateConnection = { ...structCopy(variant.connections[idx]), name }
    const connections = [...variant.connections]
    connections.splice(idx + 1, 0, copy)
    const template2 = updateVariant(template, activeVariant, (v) => ({ ...v, connections }))
    commit(set, get, { template: template2, selection: { kind: 'connection', id: name } })
  },

  duplicateVariant: () => {
    const { template, activeVariant, positions } = get()
    if (!template.variants[activeVariant]) return
    const copy = structCopy(template.variants[activeVariant])
    const slots = positions.map((s) => structCopy(s))
    slots.push(structCopy(slots[activeVariant] ?? {}))
    const next = {
      ...template,
      variants: [...template.variants.map((v) => structCopy(v)), copy],
    }
    commit(set, get, {
      template: next,
      activeVariant: next.variants.length - 1,
      positions: slots,
      selection: { kind: null, id: null },
    })
  },

  removeVariant: () => {
    const { template, activeVariant, positions } = get()
    if (template.variants.length <= 1) return
    const variants = template.variants.filter((_, i) => i !== activeVariant)
    const nextIndex = Math.min(activeVariant, variants.length - 1)
    commit(set, get, {
      template: { ...template, variants },
      activeVariant: nextIndex,
      positions: positions.filter((_, i) => i !== activeVariant),
      selection: { kind: null, id: null },
    })
    // Индексы вариантов съехали — пару сравнения сбрасываем (UI-состояние, вне снапшота).
    set({ compareWith: null })
  },

  newTemplate: () => {
    const tpl = makeEmptyTemplate(i18n.t('store.newTemplateName'))
    set({
      template: tpl,
      sourceName: null,
      activeVariant: 0,
      compareWith: null,
      positions: normalizePositions(tpl, null),
      notes: {},
      sectionStates: readSectionStates(),
      selection: { kind: null, id: null },
      groupTarget: null,
      loadSeq: get().loadSeq + 1,
      jsonDraftErrors: {},
      past: [],
      future: [],
      dirty: false,
    })
  },

  markSaved: () => set({ dirty: false }),
}))

/**
 * Автосохранение снапшота сессии в localStorage (только браузер).
 *
 * Каждое изменение персистируемых полей (template/positions/notes/sectionStates/
 * activeVariant/sourceName/dirty) планирует запись с дебаунсом — чтобы не
 * сериализовать ~200 КБ на каждое нажатие клавиши. Дополнительно пишем синхронно
 * на `pagehide` и при скрытии вкладки (`visibilitychange → hidden`): эти события
 * надёжно срабатывают при перезагрузке/закрытии/навигации, поэтому работа не
 * теряется даже без beforeunload-диалога.
 *
 * beforeunload-подтверждение намеренно НЕ ставим — по продуктовому решению
 * защита от потери данных обеспечивается исключительно снапшотом и его
 * восстановлением при следующем запуске.
 *
 * В node (unit-тесты) блок не подключается: window/localStorage отсутствуют.
 */
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  const SAVE_DEBOUNCE_MS = 250
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let pending = false
  let quotaWarned = false

  const flushSave = (): void => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (!pending) return
    pending = false
    const s = useEditorStore.getState()
    try {
      localStorage.setItem(
        SESSION_KEY,
        serializeSnapshot({
          template: s.template,
          positions: s.positions,
          notes: s.notes,
          sectionStates: s.sectionStates,
          activeVariant: s.activeVariant,
          sourceName: s.sourceName,
          dirty: s.dirty,
          savedAt: Date.now(),
        }),
      )
      quotaWarned = false
    } catch (err) {
      // Обязательно логируем: тост ниже показывается лишь раз за эпизод сбоев,
      // и без следа в консоли молчаливую остановку записи снапшотов не диагностировать.
      console.error('[oe-editor] не удалось записать снапшот сессии:', err)
      // localStorage переполнен/недоступен — предупреждаем один раз, не спамя.
      if (!quotaWarned) {
        quotaWarned = true
        s.pushToast(i18n.t('app.autosaveFailed'))
      }
    }
  }

  const scheduleSave = (): void => {
    pending = true
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS)
  }

  useEditorStore.subscribe((state, prev) => {
    if (
      state.template !== prev.template ||
      state.positions !== prev.positions ||
      state.notes !== prev.notes ||
      state.sectionStates !== prev.sectionStates ||
      state.activeVariant !== prev.activeVariant ||
      state.sourceName !== prev.sourceName ||
      state.dirty !== prev.dirty
    ) {
      scheduleSave()
    }
  })

  window.addEventListener('pagehide', flushSave)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave()
  })
}

function renameGroup(
  set: (partial: Partial<EditorState>) => void,
  get: () => EditorState,
  rootKey: 'mandatoryContent' | 'contentCountLimits',
  oldName: string,
  newName: string,
): void {
  const name = newName.trim()
  if (!name || name === oldName) return
  const { template } = get()
  const groups = template[rootKey] ?? []
  if (groups.some((g) => g.name === name)) return
  const nextRoot = groups.map((g) => (g.name === oldName ? { ...g, name } : g))
  const variants = template.variants.map((v) => ({
    ...v,
    zones: (v.zones ?? []).map((z) => {
      const refs: unknown = z[rootKey]
      const nextRefs = Array.isArray(refs)
        ? refs.map((ref) => (ref === oldName ? name : ref))
        : refs
      return { ...z, [rootKey]: nextRefs }
    }),
  }))
  const next: RmgTemplate = {
    ...template,
    [rootKey]: nextRoot,
    variants,
  }
  commit(set, get, { template: next })
}

/**
 * Удаление корневой группы с каскадной вычисткой ссылок зон (все варианты) —
 * симметрично renameGroup, одним commit (undo возвращает и группу, и ссылки).
 * Опустевший список ссылок зоны убирается целиком: отсутствующий ключ
 * эквивалентен пустому (zoneNoMc), а пустой массив contentCountLimits
 * валидатор дополнительно помечает zoneCclEmpty.
 */
function deleteGroup(
  set: (partial: Partial<EditorState>) => void,
  get: () => EditorState,
  rootKey: 'mandatoryContent' | 'contentCountLimits',
  name: string,
): void {
  const { template, groupTarget } = get()
  const groups = template[rootKey] ?? []
  if (!groups.some((g) => g.name === name)) return
  const nextRoot = groups.filter((g) => g.name !== name)
  const variants = template.variants.map((v) => ({
    ...v,
    zones: (v.zones ?? []).map((z) => {
      const refs: unknown = z[rootKey]
      if (!Array.isArray(refs) || !refs.includes(name)) return z
      const nextRefs = refs.filter((ref) => ref !== name)
      return { ...z, [rootKey]: nextRefs.length > 0 ? nextRefs : undefined }
    }),
  }))
  const next: RmgTemplate = {
    ...template,
    [rootKey]: nextRoot,
    variants,
  }
  commit(set, get, { template: next })
  // цель навигации «зона → группа» на удалённую группу больше не имеет смысла
  // (groupTarget — UI-состояние, в историю не входит)
  const kind = rootKey === 'mandatoryContent' ? 'mc' : 'cl'
  if (groupTarget?.kind === kind && groupTarget.name === name) {
    set({ groupTarget: null })
  }
}

function structCopy<T>(v: T): T {
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v))
}

/** Непустой ли объект (пустая запись = «отсутствует»: минимальный sidecar без секций/заметок). */
function hasKeys(rec: Record<string, unknown> | undefined | null): boolean {
  return !!rec && Object.keys(rec).length > 0
}

/** Слепок текущего состояния для истории. */
function makeSnapshot(state: EditorState): HistorySnapshot {
  return {
    template: state.template,
    positions: state.positions,
    activeVariant: state.activeVariant,
    selection: state.selection,
    notes: state.notes,
  }
}

/**
 * Применить изменение и записать в историю состояние «до» него.
 * Ветка future (отменённые шаги) обрезается — новый коммит становится её концом.
 */
function commit(
  set: (partial: Partial<EditorState>) => void,
  get: () => EditorState,
  patch: Partial<HistorySnapshot>,
): void {
  const state = get()
  const past = [...state.past, makeSnapshot(state)]
  if (past.length > MAX_HISTORY) past.shift()
  set({ ...patch, past, future: [], dirty: true })
}

function normalizePositions(
  template: RmgTemplate,
  positions?: Record<string, Point>[] | null,
): Record<string, Point>[] {
  const count = template.variants.length
  const out: Record<string, Point>[] = []
  for (let i = 0; i < count; i++) {
    const slot = positions?.[i] && typeof positions[i] === 'object' ? positions[i] : {}
    // Дополняем слот до покрытия всех зон варианта (кольцевой фолбэк канвы):
    // sidecar и снапшот сессии могут содержать только перетащенные узлы, а
    // сохранённая раскладка обязана описывать всю картину на экране.
    out.push(completePositions(template.variants[i], slot))
  }
  return out
}

function setVariantPositions(
  positions: Record<string, Point>[],
  variantIndex: number,
  zoneName: string,
  pos: Point,
): Record<string, Point>[] {
  const next = [...positions]
  if (!next[variantIndex]) next[variantIndex] = {}
  next[variantIndex] = { ...next[variantIndex], [zoneName]: pos }
  return next
}

function omitPosition(slot: Record<string, Point>, zoneName: string): Record<string, Point> {
  const next = { ...slot }
  delete next[zoneName]
  return next
}

function uniqueZoneName(used: string[]): string {
  const set = new Set(used)
  let i = 1
  let name = 'Zone-1'
  while (set.has(name)) {
    i++
    name = `Zone-${i}`
  }
  return name
}

/** Уникальное имя связи: `base-N` (N ≥ 1), минимальное свободное среди эффективных id (name ?? from-to). */
function nextConnectionName(connections: TemplateConnection[], base: string): string {
  const used = new Set(connections.map((c) => c.name ?? `${c.from}-${c.to}`))
  let n = 1
  let name = `${base}-${n}`
  while (used.has(name)) {
    n++
    name = `${base}-${n}`
  }
  return name
}

function updateVariant(
  template: RmgTemplate,
  variantIndex: number,
  mutate: (v: Variant) => Variant,
): RmgTemplate {
  return {
    ...template,
    variants: template.variants.map((v, i) => (i === variantIndex ? mutate(v) : v)),
  }
}