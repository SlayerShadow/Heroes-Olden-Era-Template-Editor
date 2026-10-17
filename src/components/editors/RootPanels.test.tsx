import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { useEditorStore } from '../../store/editorStore'
import type { RmgTemplate, Zone } from '../../types/rmg'
import { ContentLimitsPanel, MandatoryContentPanel } from './RootPanels'

/**
 * Компонентный тест удаления корневых групп (vitest-проект `ui`, jsdom).
 * Проверяет кнопку ✕ в карточке группы, модалку подтверждения ConfirmDialog
 * (строки — настоящие, из ru-локали) и каскадную вычистку ссылок зон в сторе.
 * Строковые ключи групп совпадают с якорями карточек: mcg-<имя> / clg-<имя>.
 */

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
    name: 'Root Panels Test',
    gameMode: 'Classic',
    sizeX: 64,
    sizeZ: 64,
    variants: [{ zones: [makeZone('A'), makeZone('B')], connections: [] }],
    zoneLayouts: [{ name: 'zone_layout_empty' }],
    valueOverrides: [],
    gameRules: {},
    globalBans: {},
    contentPools: [],
    contentLists: [],
  }
}

/** Шаблон с mc-группами: зона A ссылается на обе, зона B — только на mc_first. */
function loadMcTemplate(): void {
  const tpl = makeTemplate()
  tpl.mandatoryContent = [
    { name: 'mc_first', content: [{ sid: 'town_hall' }] },
    { name: 'mc_second', content: [] },
  ]
  tpl.variants[0].zones[0] = {
    ...tpl.variants[0].zones[0],
    mandatoryContent: ['mc_first', 'mc_second'],
  }
  tpl.variants[0].zones[1] = { ...tpl.variants[0].zones[1], mandatoryContent: ['mc_first'] }
  st().loadTemplate(tpl, 'test.rmg.json', null)
}

/** Карточка группы по якорю; null — карточки нет. */
function groupCard(anchorId: string): HTMLElement | null {
  return document.getElementById(anchorId)
}

describe('удаление корневой группы (MandatoryContentPanel)', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState())
  })

  it('✕ открывает подтверждение с составом группы; «Отмена» сохраняет группу', () => {
    loadMcTemplate()
    render(<MandatoryContentPanel />)

    const card = groupCard('mcg-mc_first')!
    fireEvent.click(within(card).getByTitle('Удалить группу'))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label', 'Удаление группы')
    // 1 элемент в группе, 2 ссылающиеся зоны (A и B)
    expect(dialog).toHaveTextContent(
      'Вы собираетесь удалить группу «mc_first» (1 эл. · 2 зон). ' +
        'Ссылки на группу будут убраны из зон всех вариантов. Вы уверены?',
    )
    expect(dialog).toHaveTextContent('Действие можно отменить через Ctrl+Z')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(groupCard('mcg-mc_first')).toBeInTheDocument()
    expect(st().template.mandatoryContent).toHaveLength(2)
  })

  it('«Удалить» убирает карточку и каскадно чистит ссылки зон в сторе', () => {
    loadMcTemplate()
    render(<MandatoryContentPanel />)

    const card = groupCard('mcg-mc_first')!
    fireEvent.click(within(card).getByTitle('Удалить группу'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }))

    // DOM: карточка удалённой группы исчезла, вторая осталась
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(groupCard('mcg-mc_first')).not.toBeInTheDocument()
    expect(groupCard('mcg-mc_second')).toBeInTheDocument()

    // стор: группа удалена, ссылки вычищены; опустевший список зоны B убран
    const tpl = st().template
    expect(tpl.mandatoryContent?.map((g) => g.name)).toEqual(['mc_second'])
    expect(tpl.variants[0].zones[0].mandatoryContent).toEqual(['mc_second'])
    expect(tpl.variants[0].zones[1].mandatoryContent).toBeUndefined()
    // undo доступен (действие прошло через commit)
    expect(st().past).toHaveLength(1)
  })
})

describe('удаление корневой группы (ContentLimitsPanel)', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState())
  })

  it('«Удалить» убирает последнюю группу: пустая панель и вычищенные ссылки', () => {
    const tpl = makeTemplate()
    tpl.contentCountLimits = [{ name: 'cl_first', limits: [{ sid: 'pandora_box', maxCount: 1 }] }]
    tpl.variants[0].zones[0] = { ...tpl.variants[0].zones[0], contentCountLimits: ['cl_first'] }
    st().loadTemplate(tpl, 'test.rmg.json', null)
    render(<ContentLimitsPanel />)

    const card = groupCard('clg-cl_first')!
    fireEvent.click(within(card).getByTitle('Удалить группу'))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(
      'Вы собираетесь удалить группу «cl_first» (1 лим. · 1 зон). ' +
        'Ссылки на группу будут убраны из зон всех вариантов. Вы уверены?',
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }))

    expect(groupCard('clg-cl_first')).not.toBeInTheDocument()
    expect(screen.getByText('Групп нет — создайте первую.')).toBeInTheDocument()
    expect(st().template.contentCountLimits).toEqual([])
    expect(st().template.variants[0].zones[0].contentCountLimits).toBeUndefined()
  })
})

/**
 * Регрессия кадра variant-manage-02 (en-ТЗ требует в поле «Object (sid)» читаемое
 * имя): в en-локали каталог имён sid должен давать английские имена — раньше
 * sidHint отдавал официальные русские (и curated-подписи) в обеих локалях.
 * Язык меняем на лету через i18n.changeLanguage (react-i18next перерисовывает
 * подписи) и возвращаем ru — setup фиксирует ru для остальных блоков файла.
 */
describe('en-локаль каталога имён sid (RootPanels)', () => {
  beforeEach(async () => {
    useEditorStore.setState(useEditorStore.getInitialState())
    await i18n.changeLanguage('en')
  })
  afterEach(async () => {
    await i18n.changeLanguage('ru')
  })

  it('карточка MC-элемента: sub-подпись «Object (sid)» — английское имя, кириллица не протекает', () => {
    const tpl = makeTemplate()
    tpl.mandatoryContent = [{ name: 'mc_first', content: [{ sid: 'mine_wood' }] }]
    st().loadTemplate(tpl, 'test.rmg.json', null)
    render(<MandatoryContentPanel />)

    const card = groupCard('mcg-mc_first')!
    // sub у поля (span.ef__sub) и main summary дают английское официальное имя
    expect(within(card).getAllByText('Sawmill').length).toBeGreaterThan(0)
    expect(within(card).queryByText('Лесопилка')).not.toBeInTheDocument()
    // сырой sid остаётся вторичной подписью
    expect(within(card).getByText('mine_wood')).toBeInTheDocument()
  })

  it('RE-подписи без официальных токенов имеют английские версии (random_hire)', () => {
    const tpl = makeTemplate()
    tpl.mandatoryContent = [{ name: 'mc_first', content: [{ sid: 'random_hire_3' }] }]
    st().loadTemplate(tpl, 'test.rmg.json', null)
    render(<MandatoryContentPanel />)

    const card = groupCard('mcg-mc_first')!
    // английское имя видно и в summary карточки, и в sub-подписи поля — два совпадения
    expect(within(card).getAllByText('External hire · tier 3')).toHaveLength(2)
    expect(within(card).queryByText('Внешний найм · ярус 3')).not.toBeInTheDocument()
  })
})
