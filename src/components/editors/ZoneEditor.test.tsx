import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../../store/editorStore'
import type { MainObject, RmgTemplate, Zone } from '../../types/rmg'
import { ZoneEditor } from './ZoneEditor'

/**
 * Компонентный тест чипов биомов инспектора зоны (vitest-проект `ui`, jsdom).
 * Контракт локализации: чипы показывают русские имена из локали (`biomes.*`),
 * а в шаблон (`.rmg.json`) попадают сырые имена формата (Sand, Snow, …).
 * Строки ассертятся настоящие (ru-локаль) — заодно ловим потерянные ключи.
 */

const st = () => useEditorStore.getState()

function makeZone(name: string, zoneBiomeArgs: string[] = []): Zone {
  return {
    name,
    size: 0.5,
    layout: 'zone_layout_empty',
    mainObjects: [],
    zoneBiome: { type: 'FromList', args: zoneBiomeArgs },
    contentBiome: { type: 'FromList', args: [] },
    metaObjectsBiome: { type: 'FromList', args: [] },
    roads: [],
  }
}

function makeTemplate(): RmgTemplate {
  return {
    name: 'Zone Biomes',
    gameMode: 'Classic',
    sizeX: 64,
    sizeZ: 64,
    variants: [{ zones: [makeZone('A', ['Sand']), makeZone('B')], connections: [] }],
    zoneLayouts: [{ name: 'zone_layout_empty' }],
    valueOverrides: [],
    gameRules: {},
    globalBans: {},
    contentPools: [],
    contentLists: [],
  }
}

/** Обвязка как в инспекторе: зона берётся живой из store, а не снимком на момент render. */
function Harness() {
  const zone = useEditorStore((s) => s.template.variants[s.activeVariant]?.zones[0])
  return zone ? <ZoneEditor zone={zone} /> : null
}

beforeEach(() => {
  st().loadTemplate(makeTemplate(), 'zone-biomes.rmg.json', null)
  // Раскрыть секцию «Биомы»: без этого чипы лежат в свёрнутом <details>.
  st().setSectionState('zone.biomes', true)
})

/** Ряд чипов слоя поверхности — первый из трёх селекторов биомов секции. */
function zoneBiomeChips(container: HTMLElement) {
  const row = container.querySelector('.chips')
  expect(row).not.toBeNull()
  return within(row as HTMLElement)
}

describe('ZoneEditor: чипы биомов', () => {
  it('чипы по-русски из локали biomes.*, сырых имён формата на чипах нет', () => {
    const { container } = render(<Harness />)
    const chips = zoneBiomeChips(container)
    // Отмеченный чип фиксированного биома зоны A — русским именем.
    expect(chips.getByRole('button', { name: '✓ Песок' })).toBeInTheDocument()
    for (const label of ['Трава', 'Снег', 'Земля', 'Мёртвые земли', 'Осень', 'Лава']) {
      expect(chips.getByRole('button', { name: label })).toBeInTheDocument()
    }
    // Сырые имена формата остаются только в данных — таких чипов нет.
    for (const raw of ['Sand', 'Snow', 'Grass', 'Dirt', 'Deathland', 'Autumn', 'Lava']) {
      expect(chips.queryByRole('button', { name: raw })).toBeNull()
    }
  })

  it('клик по чипу пишет в шаблон сырое имя формата, повторный клик убирает', () => {
    const { container } = render(<Harness />)
    const chips = zoneBiomeChips(container)
    fireEvent.click(chips.getByRole('button', { name: 'Снег' }))
    expect(st().template.variants[0].zones[0].zoneBiome.args).toEqual(['Sand', 'Snow'])
    fireEvent.click(chips.getByRole('button', { name: '✓ Песок' }))
    expect(st().template.variants[0].zones[0].zoneBiome.args).toEqual(['Snow'])
  })
})

/**
 * MatchMainObject: поле «Главный объект» — дропдаун главных объектов зоны
 * (вместо числового поля). Список — из секции «Главные объекты»; если задана
 * «Зона» (args[1]), опции берутся из её объектов.
 */

const mo = (type: MainObject['type'], extra?: Partial<MainObject>): MainObject => ({
  type,
  placement: 'Center',
  ...extra,
})

function makeMoTemplate(): RmgTemplate {
  const a = makeZone('A')
  a.zoneBiome = { type: 'MatchMainObject', args: ['0'] }
  a.mainObjects = [mo('Spawn', { spawn: 'Player1' }), mo('City')]
  const b = makeZone('B')
  b.mainObjects = [mo('AbandonedOutpost')]
  return { ...makeTemplate(), variants: [{ zones: [a, b], connections: [] }] }
}

/** Дропдаун главного объекта слоя zoneBiome — единственный MatchMainObject в фикстуре. */
const indexSelect = () => screen.getByLabelText('Главный объект') as HTMLSelectElement

const optionTexts = (sel: HTMLSelectElement) =>
  within(sel).getAllByRole('option').map((o) => o.textContent)

describe('ZoneEditor: MatchMainObject — список главных объектов вместо числа', () => {
  beforeEach(() => {
    st().loadTemplate(makeMoTemplate(), 'zone-biomes.rmg.json', null)
    st().setSectionState('zone.biomes', true)
  })

  it('опции — главные объекты зоны: индекс, русское имя типа, игрок для Spawn', () => {
    render(<Harness />)
    const sel = indexSelect()
    expect(sel.value).toBe('0')
    expect(optionTexts(sel)).toEqual([
      '—',
      '0 · Точка спауна игрока (Spawn) · Player1',
      '1 · Город (City)',
    ])
  })

  it('выбор объекта пишет его индекс в args[0]', () => {
    render(<Harness />)
    fireEvent.change(indexSelect(), { target: { value: '1' } })
    expect(st().template.variants[0].zones[0].zoneBiome.args).toEqual(['1'])
  })

  it('при заданной args[1]-зоне список берётся из её главных объектов', () => {
    st().patchZone('A', { zoneBiome: { type: 'MatchMainObject', args: ['0', 'B'] } })
    render(<Harness />)
    expect(optionTexts(indexSelect())).toEqual(['—', '0 · Заброшенный аванпост (AbandonedOutpost)'])
  })

  it('индекс вне списка не теряется: явная опция «вне списка объектов»', () => {
    st().patchZone('A', { zoneBiome: { type: 'MatchMainObject', args: ['5'] } })
    render(<Harness />)
    const sel = indexSelect()
    expect(sel.value).toBe('5')
    expect(within(sel).getByRole('option', { name: '5 · вне списка объектов' })).toBeInTheDocument()
  })

  it('очистка индекса не сдвигает args[1]-зону на его место', () => {
    st().patchZone('A', { zoneBiome: { type: 'MatchMainObject', args: ['0', 'B'] } })
    render(<Harness />)
    fireEvent.change(indexSelect(), { target: { value: '' } })
    expect(st().template.variants[0].zones[0].zoneBiome.args).toEqual(['', 'B'])
    fireEvent.change(screen.getByLabelText('Зона'), { target: { value: '' } })
    expect(st().template.variants[0].zones[0].zoneBiome.args).toEqual([])
  })

  it('выбор зоны при пустом индексе сохраняет позицию: args = ["", зона]', () => {
    st().patchZone('A', { zoneBiome: { type: 'MatchMainObject', args: [] } })
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Зона'), { target: { value: 'B' } })
    expect(st().template.variants[0].zones[0].zoneBiome.args).toEqual(['', 'B'])
  })
})

/**
 * FactionEditor (тип Match): та же пара полей «Главный объект» + «Зона» —
 * список из секции «Главные объекты», запись индекса в faction.args[0].
 */
function makeFactionTemplate(): RmgTemplate {
  const a = makeZone('A')
  a.mainObjects = [mo('Spawn', { spawn: 'Player1' }), mo('City', { faction: { type: 'Match', args: ['0'] } })]
  const b = makeZone('B')
  b.mainObjects = [mo('AbandonedOutpost')]
  return { ...makeTemplate(), variants: [{ zones: [a, b], connections: [] }] }
}

describe('ZoneEditor: фракция Match — тот же список главных объектов', () => {
  beforeEach(() => {
    st().loadTemplate(makeFactionTemplate(), 'zone-faction.rmg.json', null)
    st().setSectionState('zone.mainObjects', true)
  })

  it('дропдаун фракции — главные объекты зоны с индексами', () => {
    render(<Harness />)
    const sel = screen.getByLabelText('Главный объект') as HTMLSelectElement
    expect(sel.value).toBe('0')
    expect(optionTexts(sel)).toEqual([
      '—',
      '0 · Точка спауна игрока (Spawn) · Player1',
      '1 · Город (City)',
    ])
  })

  it('выбор объекта пишет индекс в faction.args[0]', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Главный объект'), { target: { value: '1' } })
    expect(st().template.variants[0].zones[0].mainObjects[1].faction?.args).toEqual(['1'])
  })
})

describe('ZoneEditor: слаботипизированные данные', () => {
  it('зона без mainObjects и биомов рендерится — без краша и бесконечного цикла', () => {
    // Регресс: чтение zone.mainObjects без защиты роняло рендер (TypeError),
    // свежий [] в useShallow-селекторе zoneMainObjects давал «Maximum update depth exceeded»,
    // а отсутствующий селектор биома ронял BiomeEditor (чтение .type у undefined).
    const tpl = makeTemplate()
    const z = tpl.variants[0].zones[0] as Partial<Zone>
    delete z.mainObjects
    delete z.zoneBiome
    delete z.contentBiome
    delete z.metaObjectsBiome
    st().loadTemplate(tpl, 'minimal.rmg.json', null)
    render(<Harness />)
    expect(screen.getByText('Главные объекты (0)')).toBeInTheDocument()
    expect(screen.getByText('Биомы')).toBeInTheDocument()
  })
})
