import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import type { RmgTemplate, Zone } from '../types/rmg'
import { useEditorStore } from './editorStore'

const st = () => useEditorStore.getState()

function makeZone(name: string): Zone {
  return {
    name,
    size: 0.5,
    layout: 'zone_layout_empty',
    mainObjects: [],
    zoneBiome: { type: 'FromList', args: [] },
    contentBiome: { type: 'FromList', args: [] },
    metaObjectsBiome: { type: 'FromList', args: [] },
    roads: [],
  }
}

function makeTemplate(): RmgTemplate {
  return {
    name: 'Undo Test',
    gameMode: 'Classic',
    sizeX: 64,
    sizeZ: 64,
    variants: [
      {
        zones: [makeZone('A'), makeZone('B')],
        connections: [
          {
            name: 'c1',
            from: 'A',
            to: 'B',
            connectionType: 'Direct',
            road: true,
            guardValue: 1000,
          },
        ],
      },
      {
        zones: [makeZone('B')],
        connections: [],
      },
    ],
    zoneLayouts: [{ name: 'zone_layout_empty' }],
    valueOverrides: [],
    gameRules: {},
    globalBans: {},
    contentPools: [],
    contentLists: [],
  }
}

/** Загрузить базовый шаблон (сбрасывает историю) с позициями на 2 варианта. */
function loadBase(): void {
  st().loadTemplate(makeTemplate(), 'undo.rmg.json', {
    positions: [
      { A: { x: 10, y: 20 }, B: { x: 30, y: 40 } },
      { B: { x: 5, y: 5 } },
    ],
    sectionStates: {},
    notes: {},
  })
}

describe('undo/redo в editorStore', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState())
  })

  it('новая загрузка шаблона сбрасывает историю; undo/redo на пустой истории — no-op', () => {
    loadBase()
    expect(st().past).toEqual([])
    expect(st().future).toEqual([])
    st().undo()
    expect(st().template.name).toBe('Undo Test')
    st().redo()
    expect(st().template.name).toBe('Undo Test')
  })

  it('patchZone: undo возвращает прежнее значение, redo применяет снова', () => {
    loadBase()
    st().patchZone('A', { size: 0.9 })
    expect(st().template.variants[0].zones.find((z) => z.name === 'A')?.size).toBe(0.9)
    st().undo()
    expect(st().template.variants[0].zones.find((z) => z.name === 'A')?.size).toBe(0.5)
    expect(st().past).toEqual([])
    st().redo()
    expect(st().template.variants[0].zones.find((z) => z.name === 'A')?.size).toBe(0.9)
    expect(st().future).toEqual([])
  })

  it('несколько шагов откатываются в обратном порядке', () => {
    loadBase()
    st().patchRoot({ sizeX: 100 })
    st().patchZone('A', { size: 1 })
    expect(st().template.variants[0].zones.find((z) => z.name === 'A')?.size).toBe(1)
    expect(st().template.sizeX).toBe(100)
    st().undo()
    // Откатился только последний шаг (patchZone)
    expect(st().template.variants[0].zones.find((z) => z.name === 'A')?.size).toBe(0.5)
    expect(st().template.sizeX).toBe(100)
    st().undo()
    expect(st().template.sizeX).toBe(64)
    st().redo()
    expect(st().template.sizeX).toBe(100)
  })

  it('новый коммит после undo обрезает future (redo становится недоступным)', () => {
    loadBase()
    st().patchZone('A', { size: 0.9 })
    st().patchZone('A', { size: 1 })
    st().undo()
    st().patchZone('A', { size: 0.6 })
    expect(st().future).toEqual([])
    st().redo()
    // redo не должен вернуть прежнюю ветку { size: 1 }
    expect(st().template.variants[0].zones.find((z) => z.name === 'A')?.size).toBe(0.6)
  })

  it('setZonePosition (перетаскивание): undo возвращает прежнюю позицию', () => {
    loadBase()
    st().setZonePosition('A', { x: 111, y: 222 })
    expect(st().positions[0].A).toEqual({ x: 111, y: 222 })
    st().undo()
    expect(st().positions[0].A).toEqual({ x: 10, y: 20 })
    st().redo()
    expect(st().positions[0].A).toEqual({ x: 111, y: 222 })
  })

  it('addZone: undo удаляет зону и позицию, redo возвращает', () => {
    loadBase()
    st().addZone({ x: 50, y: 50 })
    expect(st().template.variants[0].zones).toHaveLength(3)
    expect(st().positions[0].A).toBeDefined()
    const name = st().template.variants[0].zones[2].name
    expect(st().positions[0][name]).toEqual({ x: 50, y: 50 })
    st().undo()
    expect(st().template.variants[0].zones).toHaveLength(2)
    expect(st().positions[0][name]).toBeUndefined()
    st().redo()
    expect(st().template.variants[0].zones).toHaveLength(3)
  })

  it('removeZone: undo возвращает зону, связи и позицию', () => {
    loadBase()
    st().removeZone('A')
    const s0 = st().template.variants[0]
    expect(s0.zones.map((z) => z.name)).toEqual(['B'])
    expect(s0.connections).toHaveLength(0)
    expect(st().positions[0].A).toBeUndefined()
    st().undo()
    const s1 = st().template.variants[0]
    expect(s1.zones.map((z) => z.name)).toEqual(['A', 'B'])
    expect(s1.connections).toHaveLength(1)
    expect(st().positions[0].A).toEqual({ x: 10, y: 20 })
  })

  it('duplicateZone: копия с уникальным именем и сдвигом позиции, без связей; undo/redo', () => {
    loadBase()
    st().duplicateZone('A')
    const s = st().template.variants[0]
    expect(s.zones.map((z) => z.name)).toEqual(['A', 'B', 'Zone-1'])
    expect(s.connections).toHaveLength(1) // связи исходной зоны не дублируются
    const copy = s.zones[2]
    expect(copy.size).toBe(0.5)
    expect(copy.layout).toBe('zone_layout_empty')
    expect(copy.mainObjects).not.toBe(s.zones[0].mainObjects) // глубокая копия, не ссылка
    expect(st().positions[0]['Zone-1']).toEqual({ x: 58, y: 68 }) // 10+48, 20+48
    expect(st().selection).toEqual({ kind: 'zone', id: 'Zone-1' })
    st().undo()
    expect(st().template.variants[0].zones.map((z) => z.name)).toEqual(['A', 'B'])
    expect(st().positions[0]['Zone-1']).toBeUndefined()
    st().redo()
    expect(st().template.variants[0].zones.map((z) => z.name)).toEqual(['A', 'B', 'Zone-1'])
    expect(st().positions[0]['Zone-1']).toEqual({ x: 58, y: 68 })
  })

  it('duplicateZone: no-op для несуществующей зоны (без шага истории)', () => {
    loadBase()
    st().duplicateZone('X')
    expect(st().template.variants[0].zones).toHaveLength(2)
    expect(st().past).toEqual([])
  })

  it('addConnection: undo убирает связь, redo возвращает; повторный драг создаёт параллельную', () => {
    const tpl = makeTemplate()
    tpl.variants[0].connections = [] // пара A-B ещё не связана
    st().loadTemplate(tpl, 'undo.rmg.json', null)
    st().addConnection('B', 'A')
    expect(st().template.variants[0].connections).toHaveLength(1)
    st().addConnection('B', 'A') // эффективный id 'B-A' занят → явное имя 'B-A-1'
    const conns = st().template.variants[0].connections
    expect(conns).toHaveLength(2)
    expect(conns[0].name).toBeUndefined()
    expect(conns[1].name).toBe('B-A-1')
    expect(st().past).toHaveLength(2)
    st().undo()
    expect(st().template.variants[0].connections).toHaveLength(1)
    st().redo()
    expect(st().template.variants[0].connections).toHaveLength(2)
  })

  it('removeConnection: undo возвращает связь по неявному id', () => {
    loadBase()
    st().patchConnection('c1', { name: undefined })
    // теперь у связи неявный id 'A-B'
    st().removeConnection('A-B')
    expect(st().template.variants[0].connections).toHaveLength(0)
    st().undo()
    expect(st().template.variants[0].connections).toHaveLength(1)
    expect(st().template.variants[0].connections[0].from).toBe('A')
  })

  it('renameZone: undo возвращает имя и переименованные ссылки', () => {
    loadBase()
    expect(st().renameZone('A', 'Zone-New')).toBe(true)
    const s = st().template.variants[0]
    expect(s.zones.map((z) => z.name)).toContain('Zone-New')
    expect(s.connections[0].from).toBe('Zone-New')
    expect(st().positions[0]['Zone-New']).toEqual({ x: 10, y: 20 })
    st().undo()
    const s0 = st().template.variants[0]
    expect(s0.zones.map((z) => z.name)).toContain('A')
    expect(s0.connections[0].from).toBe('A')
    expect(st().positions[0].A).toEqual({ x: 10, y: 20 })
  })

  it('patchRoot / patchActiveVariant / patchConnection попадают в историю', () => {
    loadBase()
    st().patchRoot({ name: 'Renamed' })
    st().patchActiveVariant({ orientation: { mode: 'MinimalBoundingSquare' } })
    st().patchConnection('c1', { guardValue: 5000 })
    expect(st().template.name).toBe('Renamed')
    expect(st().template.variants[0].orientation?.mode).toBe('MinimalBoundingSquare')
    expect(st().template.variants[0].connections[0].guardValue).toBe(5000)
    st().undo()
    expect(st().template.variants[0].connections[0].guardValue).toBe(1000)
    st().undo()
    expect(st().template.variants[0].orientation?.mode).toBeUndefined()
    st().undo()
    expect(st().template.name).toBe('Undo Test')
    expect(st().past).toEqual([])
  })

  it('duplicateVariant: undo возвращает число вариантов и активный вариант', () => {
    loadBase()
    st().duplicateVariant()
    expect(st().template.variants).toHaveLength(3)
    expect(st().activeVariant).toBe(2)
    st().undo()
    expect(st().template.variants).toHaveLength(2)
    expect(st().activeVariant).toBe(0)
    st().redo()
    expect(st().template.variants).toHaveLength(3)
    expect(st().activeVariant).toBe(2)
  })

  it('removeVariant: undo возвращает удалённый вариант и активный индекс', () => {
    loadBase()
    st().setActiveVariant(1)
    st().removeVariant()
    expect(st().template.variants).toHaveLength(1)
    expect(st().activeVariant).toBe(0)
    st().undo()
    expect(st().template.variants).toHaveLength(2)
    expect(st().activeVariant).toBe(1)
  })

  it('renameMandatoryGroup: undo возвращает имя группы и ссылки зон', () => {
    const tpl = makeTemplate()
    tpl.mandatoryContent = [{ name: 'mc_first', content: [{ sid: 'town_hall' }] }]
    tpl.variants[0].zones[0] = { ...tpl.variants[0].zones[0], mandatoryContent: ['mc_first'] }
    st().loadTemplate(tpl, 'undo.rmg.json', null)

    st().renameMandatoryGroup('mc_first', 'mc_renamed')
    expect(st().template.mandatoryContent?.[0]?.name).toBe('mc_renamed')
    expect(st().template.variants[0].zones[0].mandatoryContent).toEqual(['mc_renamed'])
    st().undo()
    expect(st().template.mandatoryContent?.[0]?.name).toBe('mc_first')
    expect(st().template.variants[0].zones[0].mandatoryContent).toEqual(['mc_first'])
  })

  it('deleteMandatoryGroup: каскадно чистит ссылки зон всех вариантов, undo возвращает', () => {
    const tpl = makeTemplate()
    tpl.mandatoryContent = [
      { name: 'mc_first', content: [{ sid: 'town_hall' }] },
      { name: 'mc_second', content: [] },
    ]
    tpl.variants[0].zones[0] = {
      ...tpl.variants[0].zones[0],
      mandatoryContent: ['mc_first', 'mc_second'],
    }
    tpl.variants[1].zones[0] = { ...tpl.variants[1].zones[0], mandatoryContent: ['mc_first'] }
    st().loadTemplate(tpl, 'undo.rmg.json', null)

    st().deleteMandatoryGroup('mc_first')
    expect(st().template.mandatoryContent?.map((g) => g.name)).toEqual(['mc_second'])
    expect(st().template.variants[0].zones[0].mandatoryContent).toEqual(['mc_second'])
    // единственная ссылка зоны опустела — ключ убран (пустой [] zoneNoMc не отличается,
    // а для contentCountLimits пустой массив дал бы лишний zoneCclEmpty)
    expect(st().template.variants[1].zones[0].mandatoryContent).toBeUndefined()
    // зона без ссылки не пересоздаётся (ссылочная идентичность сохраняется)
    expect(st().template.variants[0].zones[1]).toBe(tpl.variants[0].zones[1])

    st().undo()
    expect(st().template.mandatoryContent?.map((g) => g.name)).toEqual(['mc_first', 'mc_second'])
    expect(st().template.variants[0].zones[0].mandatoryContent).toEqual(['mc_first', 'mc_second'])
    expect(st().template.variants[1].zones[0].mandatoryContent).toEqual(['mc_first'])
  })

  it('deleteContentLimitGroup: удаляет группу и ссылки; несуществующая группа — no-op без истории', () => {
    const tpl = makeTemplate()
    tpl.contentCountLimits = [{ name: 'cl_first', limits: [{ sid: 'pandora_box', maxCount: 1 }] }]
    tpl.variants[0].zones[0] = { ...tpl.variants[0].zones[0], contentCountLimits: ['cl_first'] }
    st().loadTemplate(tpl, 'undo.rmg.json', null)

    st().deleteContentLimitGroup('cl_missing')
    expect(st().past).toEqual([])
    expect(st().template.contentCountLimits).toHaveLength(1)

    st().deleteContentLimitGroup('cl_first')
    expect(st().template.contentCountLimits).toEqual([])
    expect(st().template.variants[0].zones[0].contentCountLimits).toBeUndefined()
    st().undo()
    expect(st().template.contentCountLimits?.map((g) => g.name)).toEqual(['cl_first'])
    expect(st().template.variants[0].zones[0].contentCountLimits).toEqual(['cl_first'])
  })

  it('undo/redo восстанавливают selection', () => {
    const tpl = makeTemplate()
    tpl.variants[0].connections = [] // чистый лист: addConnection создаёт связь 'B-A'
    st().loadTemplate(tpl, 'undo.rmg.json', null)
    st().addConnection('B', 'A') // select новая связь 'B-A'
    expect(st().selection).toEqual({ kind: 'connection', id: 'B-A' })
    st().undo()
    expect(st().selection.kind).toBeNull()
    st().redo()
    expect(st().selection).toEqual({ kind: 'connection', id: 'B-A' })
  })

  it('newTemplate сбрасывает историю', () => {
    loadBase()
    st().patchZone('A', { size: 0.9 })
    expect(st().past.length).toBeGreaterThan(0)
    st().newTemplate()
    expect(st().past).toEqual([])
    expect(st().future).toEqual([])
    // Имя берётся из активной локали (в node-тестах детект даёт en) — сверяем с i18n
    expect(st().template.name).toBe(i18n.t('store.newTemplateName'))
  })

  it('newTemplate: пустая структура шаблона (фабрика — она же старт release-сборки)', () => {
    st().newTemplate()
    const t = st().template
    expect(t.variants).toEqual([{ zones: [], connections: [] }])
    expect(t.zoneLayouts).toEqual([{ name: 'zone_layout_default' }])
    expect(t.sizeX).toBe(128)
    expect(t.sizeZ).toBe(128)
    expect(t.mandatoryContent).toEqual([])
    expect(t.contentCountLimits).toEqual([])
    expect(st().positions).toEqual([{}])
  })

  it('история ограничена MAX_HISTORY (не растёт без предела)', () => {
    loadBase()
    for (let i = 0; i < 150; i++) {
      st().patchRoot({ sizeX: 64 + (i % 2) })
    }
    expect(st().past.length).toBeLessThanOrEqual(100)
  })
})

describe('compareWith: пара сравнения вариантов (UI-состояние вне истории)', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState())
  })

  it('начальное значение — null; setCompareWith устанавливает пару без записи в историю', () => {
    expect(useEditorStore.getInitialState().compareWith).toBeNull()
    loadBase()
    st().setCompareWith(1)
    expect(st().compareWith).toBe(1)
    // UI-состояние: commit не вызывался, undo недоступен
    expect(st().past).toEqual([])
    expect(st().future).toEqual([])
  })

  it('undo/redo не восстанавливают и не затирают compareWith', () => {
    loadBase()
    st().setCompareWith(1)
    st().patchZone('A', { size: 0.9 })
    st().undo()
    expect(st().compareWith).toBe(1)
    st().redo()
    expect(st().compareWith).toBe(1)
  })

  it('loadTemplate сбрасывает compareWith в null', () => {
    loadBase()
    st().setCompareWith(1)
    st().loadTemplate(makeTemplate(), 'other.rmg.json', null)
    expect(st().compareWith).toBeNull()
  })

  it('newTemplate сбрасывает compareWith в null', () => {
    loadBase()
    st().setCompareWith(1)
    st().newTemplate()
    expect(st().compareWith).toBeNull()
  })

  it('removeVariant сбрасывает compareWith в null (индексы вариантов съехали)', () => {
    loadBase()
    st().setActiveVariant(1)
    st().setCompareWith(0) // сравнивали с вариантом 0, но съезжают все индексы
    st().removeVariant()
    expect(st().compareWith).toBeNull()
  })

  it('duplicateVariant не сбрасывает compareWith (индексы существующих не сместились)', () => {
    loadBase()
    st().setCompareWith(1)
    st().duplicateVariant() // 3 варианта, activeVariant = 2
    expect(st().compareWith).toBe(1)
  })
})

describe('groupTarget: навигация зона→группа (UI-состояние вне истории)', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState())
  })

  it('начальное значение — null; goToGroup(mc) переключает вкладку на «Контент»', () => {
    expect(useEditorStore.getInitialState().groupTarget).toBeNull()
    loadBase()
    st().goToGroup('mc', 'mandatory_content_center')
    expect(st().inspectorTab).toBe('content')
    expect(st().groupTarget).toMatchObject({ kind: 'mc', name: 'mandatory_content_center' })
    // UI-состояние: commit не вызывался, история пуста
    expect(st().past).toEqual([])
    expect(st().future).toEqual([])
  })

  it('goToGroup(cl) переключает вкладку на «Лимиты»', () => {
    loadBase()
    st().goToGroup('cl', 'content_limits_1')
    expect(st().inspectorTab).toBe('limits')
    expect(st().groupTarget).toMatchObject({ kind: 'cl', name: 'content_limits_1' })
  })

  it('seq растёт при повторном переходе (в т.ч. к той же группе) — подсветка срабатывает снова', () => {
    loadBase()
    st().goToGroup('mc', 'g1')
    const first = st().groupTarget?.seq ?? 0
    st().goToGroup('mc', 'g1')
    const second = st().groupTarget?.seq ?? 0
    st().goToGroup('cl', 'g2')
    const third = st().groupTarget?.seq ?? 0
    expect(second).toBeGreaterThan(first)
    expect(third).toBeGreaterThan(second)
  })

  it('goToGroup не сбрасывает selection — зона остаётся выбранной', () => {
    loadBase()
    st().select('zone', 'A')
    st().goToGroup('mc', 'g1')
    expect(st().selection).toEqual({ kind: 'zone', id: 'A' })
  })

  it('clearGroupTarget гасит запрос без записи в историю', () => {
    loadBase()
    st().goToGroup('mc', 'g1')
    st().clearGroupTarget()
    expect(st().groupTarget).toBeNull()
    expect(st().past).toEqual([])
  })

  it('loadTemplate и newTemplate гасят запрос (группы прежнего шаблона уже не те)', () => {
    loadBase()
    st().goToGroup('mc', 'g1')
    st().loadTemplate(makeTemplate(), 'other.rmg.json', null)
    expect(st().groupTarget).toBeNull()
    st().goToGroup('cl', 'g2')
    st().newTemplate()
    expect(st().groupTarget).toBeNull()
  })

  it('undo/redo не восстанавливают и не затирают groupTarget', () => {
    loadBase()
    st().goToGroup('mc', 'g1')
    st().patchZone('A', { size: 0.9 })
    st().undo()
    expect(st().groupTarget).toMatchObject({ kind: 'mc', name: 'g1' })
    st().redo()
    expect(st().groupTarget).toMatchObject({ kind: 'mc', name: 'g1' })
  })
})

describe('селекторы канонических id связей', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState())
  })

  it('findConnection работает до и после undo', () => {
    loadBase()
    const before = st().findConnection('A-B')
    expect(before).toBeUndefined() // у связи есть name c1
    st().patchConnection('c1', { name: undefined })
    st().findConnection('A-B')
    expect(st().findConnection('A-B')?.from).toBe('A')
    st().undo()
    expect(st().findConnection('c1')?.from).toBe('A')
  })
})

describe('notes: заметки по зонам (sidecar, undo-снапшот)', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState())
  })

  it('setZoneNote создаёт, обновляет и удаляет заметку; пустой текст удаляет ключ', () => {
    loadBase()
    st().setZoneNote('A', 'первая заметка')
    expect(st().notes['A']).toBe('первая заметка')
    st().setZoneNote('A', 'обновлено')
    expect(st().notes['A']).toBe('обновлено')
    st().setZoneNote('A', '   ')
    expect(st().notes['A']).toBeUndefined()
    expect(Object.keys(st().notes)).toHaveLength(0)
  })

  it('setZoneNote — no-op при том же значении (не портит историю)', () => {
    loadBase()
    st().setZoneNote('A', 'текст')
    expect(st().past).toHaveLength(1)
    st().setZoneNote('A', 'текст')
    expect(st().past).toHaveLength(1) // то же значение — без нового коммита
    st().setZoneNote('A', '')
    expect(st().notes['A']).toBeUndefined()
    expect(st().past).toHaveLength(2)
  })

  it('undo/redo восстанавливают заметки', () => {
    loadBase()
    st().setZoneNote('A', 'заметка A')
    st().setZoneNote('B', 'заметка B')
    st().undo()
    expect(st().notes['A']).toBe('заметка A')
    expect(st().notes['B']).toBeUndefined()
    st().redo()
    expect(st().notes['B']).toBe('заметка B')
  })

  it('renameZone переносит заметку на новое имя', () => {
    loadBase()
    st().setZoneNote('A', 'еду с заметкой')
    expect(st().renameZone('A', 'C')).toBe(true)
    expect(st().notes['C']).toBe('еду с заметкой')
    expect(st().notes['A']).toBeUndefined()
    st().undo()
    expect(st().notes['A']).toBe('еду с заметкой')
  })

  it('removeZone удаляет заметку (undo возвращает)', () => {
    loadBase()
    st().setZoneNote('A', 'не потеряться')
    st().removeZone('A')
    expect(st().notes['A']).toBeUndefined()
    st().undo()
    expect(st().notes['A']).toBe('не потеряться')
  })

  it('loadTemplate восстанавливает notes из sidecar; сбрасывает при его отсутствии', () => {
    loadBase()
    st().setZoneNote('A', 'старая')
    st().loadTemplate(makeTemplate(), 'other.rmg.json', {
      positions: [],
      sectionStates: {},
      notes: { B: 'из sidecar' },
    })
    expect(st().notes).toEqual({ B: 'из sidecar' })
    st().loadTemplate(makeTemplate(), 'plain.rmg.json', null)
    expect(st().notes).toEqual({})
  })

  it('newTemplate сбрасывает notes', () => {
    loadBase()
    st().setZoneNote('A', 'забыть')
    st().newTemplate()
    expect(st().notes).toEqual({})
  })
})

describe('sectionStates: раскладка секций (UI-состояние + sidecar)', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState())
  })

  it('setSectionState обновляет поле без записи в историю; повтор — no-op', () => {
    loadBase()
    st().setSectionState('zone.layout', false)
    expect(st().sectionStates['zone.layout']).toBe(false)
    expect(st().past).toEqual([])
    st().setSectionState('zone.layout', false)
    expect(st().sectionStates['zone.layout']).toBe(false)
  })

  it('loadTemplate берёт sectionStates из sidecar; без них — локальные prefs (пусто в node)', () => {
    loadBase()
    st().setSectionState('zone.layout', false)
    st().loadTemplate(makeTemplate(), 'with-sc.rmg.json', {
      positions: [],
      sectionStates: { 'conn.main': false },
      notes: {},
    })
    expect(st().sectionStates).toEqual({ 'conn.main': false })
    st().loadTemplate(makeTemplate(), 'minimal.rmg.json', {
      positions: [],
      sectionStates: {},
      notes: {},
    })
    // минимальный sidecar без раскладки → локальные prefs (в node localStorage нет → пусто)
    expect(st().sectionStates).toEqual({})
  })

  it('undo/redo не трогают sectionStates', () => {
    loadBase()
    st().setSectionState('zone.budgets', false)
    st().patchZone('A', { size: 0.9 })
    st().undo()
    expect(st().sectionStates['zone.budgets']).toBe(false)
  })
})

describe('toasts в editorStore', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState())
  })

  it('pushToast добавляет тост с kind=error по умолчанию', () => {
    st().pushToast('ошибка записи')
    expect(st().toasts).toEqual([{ id: expect.any(Number), kind: 'error', text: 'ошибка записи' }])
  })

  it('pushToast принимает kind=info и складывает тосты в стек', () => {
    st().pushToast('нет шаблонов', 'info')
    st().pushToast('сбой')
    const toasts = st().toasts
    expect(toasts).toHaveLength(2)
    expect(toasts[0]).toMatchObject({ kind: 'info', text: 'нет шаблонов' })
    expect(toasts[1]).toMatchObject({ kind: 'error', text: 'сбой' })
  })

  it('id тостов уникальны и монотонны', () => {
    st().pushToast('a')
    st().pushToast('b')
    st().pushToast('c')
    const ids = st().toasts.map((toast) => toast.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids).toEqual([...ids].sort((x, y) => x - y))
  })

  it('dismissToast удаляет только указанный тост', () => {
    st().pushToast('a')
    st().pushToast('b')
    const first = st().toasts[0].id
    st().dismissToast(first)
    expect(st().toasts.map((toast) => toast.text)).toEqual(['b'])
    st().dismissToast(999999)
    expect(st().toasts).toHaveLength(1)
  })

  it('тосты переживают loadTemplate (UI-состояние, не часть шаблона)', () => {
    st().pushToast('важное сообщение', 'info')
    loadBase()
    expect(st().toasts.map((toast) => toast.text)).toEqual(['важное сообщение'])
    expect(st().toasts[0].kind).toBe('info')
  })
})

describe('dirty: флаг несохранённых изменений (гейт модалки «изменения будут утеряны»)', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState())
  })

  it('старт (node, без снапшота) — не грязный; loadTemplate сбрасывает dirty', () => {
    expect(useEditorStore.getInitialState().dirty).toBe(false)
    loadBase()
    expect(st().dirty).toBe(false)
  })

  it('любой commit выставляет dirty=true', () => {
    loadBase()
    expect(st().dirty).toBe(false)
    st().patchZone('A', { size: 0.9 })
    expect(st().dirty).toBe(true)
  })

  it('undo/redo оставляют dirty=true (данные меняются относительно диска)', () => {
    loadBase()
    st().patchZone('A', { size: 0.9 })
    st().undo()
    expect(st().dirty).toBe(true)
    st().redo()
    expect(st().dirty).toBe(true)
  })

  it('markSaved сбрасывает dirty (успешное сохранение на диск)', () => {
    loadBase()
    st().patchZone('A', { size: 0.9 })
    expect(st().dirty).toBe(true)
    st().markSaved()
    expect(st().dirty).toBe(false)
    // Правка после сохранения снова делает грязным
    st().patchZone('A', { size: 0.7 })
    expect(st().dirty).toBe(true)
  })

  it('newTemplate сбрасывает dirty', () => {
    loadBase()
    st().patchZone('A', { size: 0.9 })
    expect(st().dirty).toBe(true)
    st().newTemplate()
    expect(st().dirty).toBe(false)
  })

  it('loadTemplate после правок сбрасывает dirty (состояние = диск)', () => {
    loadBase()
    st().patchZone('A', { size: 0.9 })
    expect(st().dirty).toBe(true)
    st().loadTemplate(makeTemplate(), 'other.rmg.json', null)
    expect(st().dirty).toBe(false)
  })

  it('UI-навигация (setActiveVariant/setSectionState/select) НЕ делает грязным', () => {
    loadBase()
    st().setActiveVariant(1)
    st().setSectionState('zone.layout', false)
    st().select('zone', 'A')
    expect(st().dirty).toBe(false)
  })

  it('заметка зоны (commit через setZoneNote) делает грязным', () => {
    loadBase()
    st().setZoneNote('A', 'текст')
    expect(st().dirty).toBe(true)
  })
})

describe('addConnection: параллельные связи; duplicateConnection; replaceConnection: коды ошибок', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState())
  })

  it('пара уже связана — повторный драг создаёт параллельную связь с уникальным авто-именем', () => {
    loadBase() // c1: именованная A→B
    st().addConnection('A', 'B') // пара занята, base 'A-B' свободен (c1 занимает 'c1') → явное имя 'A-B'
    expect(st().template.variants[0].connections).toHaveLength(2)
    expect(st().template.variants[0].connections[1].name).toBe('A-B')
    expect(st().selection).toEqual({ kind: 'connection', id: 'A-B' })
    expect(st().past).toHaveLength(1)
    st().addConnection('A', 'B') // 'A-B' занят → 'A-B-1'
    st().addConnection('A', 'B') // → 'A-B-2'
    const conns = st().template.variants[0].connections
    expect(conns).toHaveLength(4)
    expect(conns.map((c) => c.name ?? `${c.from}-${c.to}`)).toEqual(['c1', 'A-B', 'A-B-1', 'A-B-2'])
    expect(st().selection).toEqual({ kind: 'connection', id: 'A-B-2' })
  })

  it('обратный драг между связанной парой — явное имя from-to: поле «Имя связи» заполнено в обе стороны', () => {
    loadBase() // c1: именованная A→B
    st().addConnection('B', 'A') // пара занята, base 'B-A' свободен → явное имя 'B-A' (прецедент Shamrock)
    let conns = st().template.variants[0].connections
    expect(conns).toHaveLength(2)
    expect(conns[1].name).toBe('B-A')
    expect(conns[1].from).toBe('B')
    expect(conns[1].to).toBe('A')
    expect(st().selection).toEqual({ kind: 'connection', id: 'B-A' })
    st().addConnection('B', 'A') // 'B-A' занят → 'B-A-1'
    conns = st().template.variants[0].connections
    expect(conns[2].name).toBe('B-A-1')
  })

  it('пара не связана — новая связь безымянная (авто-имя From-To)', () => {
    const tpl = makeTemplate()
    tpl.variants[0].connections = []
    st().loadTemplate(tpl, 'undo.rmg.json', null)
    st().addConnection('A', 'B')
    const conn = st().template.variants[0].connections[0]
    expect(conn.name).toBeUndefined()
    expect(st().selection).toEqual({ kind: 'connection', id: 'A-B' })
  })

  it('чужое имя «C-D» занимает id — новая связь C→D получает имя «C-D-1»', () => {
    const tpl = makeTemplate()
    tpl.variants[0].zones.push(makeZone('C'), makeZone('D'))
    tpl.variants[0].connections = [
      { name: 'C-D', from: 'A', to: 'C', connectionType: 'Direct', road: true, guardValue: 1000 },
    ]
    st().loadTemplate(tpl, 'undo.rmg.json', null)
    st().addConnection('C', 'D')
    const conns = st().template.variants[0].connections
    expect(conns).toHaveLength(2)
    expect(conns[1].name).toBe('C-D-1')
    expect(conns[1].from).toBe('C')
    expect(conns[1].to).toBe('D')
    expect(st().selection).toEqual({ kind: 'connection', id: 'C-D-1' })
  })

  it('duplicateConnection: копия полей, следующее уникальное имя, вставка за оригиналом, выделение копии', () => {
    loadBase() // c1: A→B, Direct, road, guardValue 1000
    st().duplicateConnection('c1')
    let conns = st().template.variants[0].connections
    expect(conns).toHaveLength(2)
    expect(conns[1]).toMatchObject({
      name: 'c1-1',
      from: 'A',
      to: 'B',
      connectionType: 'Direct',
      road: true,
      guardValue: 1000,
    })
    expect(st().selection).toEqual({ kind: 'connection', id: 'c1-1' })
    expect(st().past).toHaveLength(1)
    st().duplicateConnection('c1') // вторая копия c1: имя 'c1-2', вставка снова за оригиналом (idx 1)
    conns = st().template.variants[0].connections
    expect(conns.map((c) => c.name)).toEqual(['c1', 'c1-2', 'c1-1'])
    st().undo()
    expect(st().template.variants[0].connections.map((c) => c.name)).toEqual(['c1', 'c1-1'])
  })

  it('duplicateConnection: безымянный оригинал дублируется по эффективному id; неизвестный id — no-op без истории', () => {
    loadBase()
    st().patchConnection('c1', { name: undefined }) // эффективный id 'A-B'
    st().duplicateConnection('A-B')
    const conns = st().template.variants[0].connections
    expect(conns).toHaveLength(2)
    expect(conns[0].name).toBeUndefined()
    expect(conns[1].name).toBe('A-B-1')
    const before = st().past.length
    st().duplicateConnection('missing')
    expect(st().template.variants[0].connections).toHaveLength(2)
    expect(st().past).toHaveLength(before)
  })

  it('removeConnection: двойняшки с совпадающим id — удаляется ровно одна', () => {
    const tpl = makeTemplate()
    tpl.variants[0].connections = [
      { from: 'A', to: 'B', connectionType: 'Direct' },
      { from: 'A', to: 'B', connectionType: 'Direct', guardValue: 500 },
    ] // рукописный JSON: обе с эффективным id 'A-B'
    st().loadTemplate(tpl, 'undo.rmg.json', null)
    st().removeConnection('A-B')
    const conns = st().template.variants[0].connections
    expect(conns).toHaveLength(1)
    expect(conns[0].guardValue).toBe(500) // удалена первая, вторая цела
  })

  it('replaceConnection: замена возвращает null, попадает в историю и переносит selection при смене id', () => {
    loadBase()
    st().select('connection', 'c1')
    const err = st().replaceConnection('c1', {
      name: 'c2',
      from: 'A',
      to: 'B',
      connectionType: 'Direct',
      road: true,
      guardValue: 2000,
    })
    expect(err).toBeNull()
    const conns = st().template.variants[0].connections
    expect(conns).toHaveLength(1)
    expect(conns[0].name).toBe('c2')
    expect(conns[0].guardValue).toBe(2000)
    expect(st().selection).toEqual({ kind: 'connection', id: 'c2' })
    expect(st().past).toHaveLength(1)
    st().undo()
    expect(st().template.variants[0].connections[0].name).toBe('c1')
  })

  it('replaceConnection: неизвестный id — connNotFound с detail, без шага истории, шаблон цел', () => {
    loadBase()
    const err = st().replaceConnection('missing', {
      name: 'x',
      from: 'A',
      to: 'B',
      connectionType: 'Direct',
    })
    expect(err).toEqual({ code: 'connNotFound', detail: 'missing' })
    expect(st().past).toEqual([])
    expect(st().template.variants[0].connections).toHaveLength(1)
    expect(st().template.variants[0].connections[0].name).toBe('c1')
  })
})

describe('позиции: слоты дополняются до покрытия всех зон варианта', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState())
  })

  it('loadTemplate: частичный sidecar дополняется кольцевым фолбэком (сохранённые точки целы)', () => {
    st().loadTemplate(makeTemplate(), 'undo.rmg.json', {
      positions: [{ A: { x: 10, y: 20 } }], // один слот на два варианта: второй дополнится
      sectionStates: {},
      notes: {},
    })
    expect(st().positions[0].A).toEqual({ x: 10, y: 20 })
    // B в sidecar не было: кольцо n=2, i=1 → (140, ≈420)
    expect(st().positions[0].B.x).toBeCloseTo(140, 6)
    expect(st().positions[0].B.y).toBeCloseTo(420, 6)
    // вариант 1: единственная зона B — кольцо n=1, i=0 → (1100, 420)
    expect(st().positions[1].B).toEqual({ x: 1100, y: 420 })
  })

  it('loadTemplate без sidecar: позиции есть у всех зон — сохраняемый sidecar будет полным', () => {
    st().loadTemplate(makeTemplate(), 'undo.rmg.json', null)
    expect(Object.keys(st().positions[0]).sort()).toEqual(['A', 'B'])
    expect(Object.keys(st().positions[1])).toEqual(['B'])
  })
})

describe('слаботипизированный вариант: действия не падают на отсутствующих zones/connections', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState())
  })

  /** Вариант без zones/connections — как в рукописном файле, прошедшем parseTemplate. */
  function loadWeakVariant(): void {
    const tpl = makeTemplate()
    tpl.variants[0] = { ...tpl.variants[0], zones: undefined, connections: undefined } as unknown as (typeof tpl.variants)[0]
    st().loadTemplate(tpl, 'weak.rmg.json', null)
  }

  it('loadTemplate: позиции — пустой слот, findZone/findConnection — undefined', () => {
    loadWeakVariant()
    expect(st().positions[0]).toEqual({})
    expect(st().findZone('A')).toBeUndefined()
    expect(st().findConnection('c1')).toBeUndefined()
  })

  it('addZone: первая зона материализует zones и встаёт в selection + историю', () => {
    loadWeakVariant()
    st().addZone({ x: 100, y: 100 })
    const v = st().template.variants[0]
    expect(v.zones).toHaveLength(1)
    expect(v.zones?.[0].name).toBe('Zone-1')
    expect(st().selection).toEqual({ kind: 'zone', id: 'Zone-1' })
    expect(st().past).toHaveLength(1)
  })

  it('addConnection: zones есть, connections нет — связь создаётся без краша', () => {
    const tpl = makeTemplate()
    tpl.variants[0] = { ...tpl.variants[0], connections: undefined } as unknown as (typeof tpl.variants)[0]
    st().loadTemplate(tpl, 'weak.rmg.json', null)
    st().addConnection('A', 'B')
    const conns = st().template.variants[0].connections
    expect(conns).toHaveLength(1)
    expect(conns?.[0].from).toBe('A')
    expect(conns?.[0].to).toBe('B')
  })
})