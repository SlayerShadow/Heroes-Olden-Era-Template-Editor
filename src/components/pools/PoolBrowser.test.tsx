import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ContentList, ContentPool } from '../../data/poolCatalog'
import { PoolBrowser } from './PoolBrowser'

/**
 * Компонентный тест PoolBrowser (vitest-проект `ui`, jsdom).
 * Каталог подменяется маленьким фикстурным набором (мок `loadCatalog`),
 * чтобы не тянуть генерируемый ~1 МБ `poolCatalog.ts`: тесты проверяют
 * поведение UI (фильтры, вкладки, сравнение, выбор), а не данные игры.
 * Строки ассертятся настоящие — из ru-локали (заодно ловим потерянные ключи).
 */

const fixtures = vi.hoisted(() => {
  const pools: ContentPool[] = [
    {
      name: 'template_pool_random_unguarded_t3_item',
      priceBounds: [3999, 6999],
      weights: [1, 2, 1],
      groups: [
        { weight: 300, lists: ['list_a'] },
        { weight: 100, lists: ['list_b'] },
      ],
    },
    {
      name: 'classic_template_pool_random_t1_base',
      groups: [
        { weight: 300, lists: ['list_a'] },
        { weight: 50, lists: ['list_c'] },
      ],
    },
    {
      name: 'template_pool_jebus_guarded_main',
      groups: [{ weight: 100, lists: ['list_b'] }],
    },
    { name: 'weird_pool', groups: [] },
  ]
  const lists: ContentList[] = [
    { name: 'list_a', content: [{ sid: 'pandora_box', weight: 5 }, { sid: 'unknown_sid_x' }] },
    { name: 'list_b', content: [{ sid: 'mine_gold' }] },
    { name: 'list_c', content: [{ sid: 'prison', biome: 'swamp' }] },
    // имя из реального каталога — humanize даёт подпись «Базовый список · основные шахты»
    { name: 'basic_content_list_basic_mines', content: [{ sid: 'watchtower' }] },
  ]
  return { pools, lists }
})

vi.mock('../../data/catalog', () => ({
  loadCatalog: () =>
    Promise.resolve({
      pools: fixtures.pools,
      lists: fixtures.lists,
      poolMap: Object.fromEntries(fixtures.pools.map((p) => [p.name, p])),
      listMap: Object.fromEntries(fixtures.lists.map((l) => [l.name, l])),
      poolNames: fixtures.pools.map((p) => p.name),
      listNames: fixtures.lists.map((l) => l.name),
    }),
}))

interface BrowserProps {
  open: boolean
  onClose: () => void
  selected: string[]
  onToggle: (name: string) => void
}

function renderBrowser(props: Partial<BrowserProps> = {}) {
  const onClose = vi.fn()
  const onToggle = vi.fn()
  const full: BrowserProps = { open: true, onClose, onToggle, selected: [], ...props }
  const utils = render(<PoolBrowser {...full} />)
  return {
    ...utils,
    onClose,
    onToggle,
    rerender: (next: Partial<BrowserProps> = {}) => utils.rerender(<PoolBrowser {...full} {...next} />),
  }
}

/** Строка пула (details) по видимому имени. */
function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest('details')
  if (!row) throw new Error(`строка пула не найдена: ${name}`)
  return row
}

async function renderLoaded(props: Partial<BrowserProps> = {}) {
  const browser = renderBrowser(props)
  await screen.findByText('weird_pool')
  return browser
}

describe('PoolBrowser', () => {
  it('open=false ничего не рендерит', () => {
    const { container } = renderBrowser({ open: false })
    expect(container).toBeEmptyDOMElement()
  })

  it('показывает загрузку, затем строки каталога со счётчиком', async () => {
    renderBrowser()
    expect(screen.getByText('Загрузка каталога…')).toBeInTheDocument()
    expect(await screen.findByText('template_pool_random_unguarded_t3_item')).toBeInTheDocument()
    expect(screen.queryByText('Загрузка каталога…')).not.toBeInTheDocument()
    expect(screen.getByText('4 / 4')).toBeInTheDocument()
  })

  it('переводит имена пулов и показывает сводку веса/списков', async () => {
    await renderLoaded()
    // известные имена — человеческая подпись (сырое имя остаётся в соседнем span)
    expect(screen.getByText('Случайный пул · неохраняемый · t3 · предметы')).toBeInTheDocument()
    expect(screen.getByText('Классический случайный пул · t1 · базовый')).toBeInTheDocument()
    // неизвестное имя — сырое имя + перевод тегов
    expect(screen.getByText('шаблон · охраняемый · jebus · main')).toBeInTheDocument()
    expect(screen.getByText('Σ 400 · списков 2')).toBeInTheDocument()
    expect(screen.getByText('Σ 0 · списков 0')).toBeInTheDocument()
  })

  it('списки с известным именем: русская подпись и сырое имя со счётчиком', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: 'Списки' }))
    expect(await screen.findByText('Базовый список · основные шахты')).toBeInTheDocument()
    expect(screen.getByText('basic_content_list_basic_mines · 1 з/sid')).toBeInTheDocument()
  })

  it('поиск работает по русской подписи (пулы и списки)', async () => {
    await renderLoaded()
    fireEvent.change(screen.getByPlaceholderText('Поиск по имени пула (substring)'), {
      target: { value: 'предметы' },
    })
    expect(screen.getByText('template_pool_random_unguarded_t3_item')).toBeInTheDocument()
    expect(screen.queryByText('classic_template_pool_random_t1_base')).not.toBeInTheDocument()
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Списки' }))
    fireEvent.change(screen.getByPlaceholderText('Поиск по имени списка или sid'), {
      target: { value: 'основные шахты' },
    })
    expect(await screen.findByText('basic_content_list_basic_mines · 1 з/sid')).toBeInTheDocument()
    expect(screen.queryByText('list_b')).not.toBeInTheDocument()
  })

  it('чипы профилей переведены и фильтруют рандомные пулы', async () => {
    await renderLoaded()
    expect(screen.getByRole('button', { name: 'банки юнитов' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'предметы' }))
    expect(screen.getByText('template_pool_random_unguarded_t3_item')).toBeInTheDocument()
    expect(screen.queryByText('classic_template_pool_random_t1_base')).not.toBeInTheDocument()
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
  })

  it('поиск по подстроке фильтрует строки и сохраняется в префах', async () => {
    await renderLoaded()
    fireEvent.change(screen.getByPlaceholderText('Поиск по имени пула (substring)'), {
      target: { value: 'jebus' },
    })
    expect(screen.getByText('template_pool_jebus_guarded_main')).toBeInTheDocument()
    expect(screen.queryByText('weird_pool')).not.toBeInTheDocument()
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
    const prefs = JSON.parse(localStorage.getItem('hooe.poolBrowser.prefs.v1') ?? 'null')
    expect(prefs?.search).toBe('jebus')
  })

  it('без результатов — заглушка «Ничего не найдено»', async () => {
    await renderLoaded()
    fireEvent.change(screen.getByPlaceholderText('Поиск по имени пула (substring)'), {
      target: { value: 'нет-такого' },
    })
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
  })

  it('кнопка «+» строки вызывает onToggle с именем пула; выбранный — «✓»', async () => {
    const { onToggle, rerender } = await renderLoaded()
    fireEvent.click(within(rowOf('weird_pool')).getByTitle('Добавить в выбранные'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith('weird_pool')
    rerender({ selected: ['weird_pool'] })
    const toggle = within(rowOf('weird_pool')).getByTitle('Убрать из выбранных')
    expect(toggle).toHaveTextContent('✓')
  })

  it('вкладка «Списки»: количество sid, использование в пулах, поиск по sid', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: 'Списки' }))
    expect(await screen.findByText('list_a')).toBeInTheDocument()
    const rowA = rowOf('list_a')
    expect(within(rowA).getByText('2 з/sid')).toBeInTheDocument()
    expect(within(rowA).getByText('в пулах: 2')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Поиск по имени списка или sid'), {
      target: { value: 'mine_gold' },
    })
    expect(screen.getByText('list_b')).toBeInTheDocument()
    expect(screen.queryByText('list_a')).not.toBeInTheDocument()
  })

  it('сравнение: добавление черновиком и кнопкой «+», матрица и счётчики', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: 'Сравнение' }))
    expect(screen.getByText(/Выберите 2–6 пула/)).toBeInTheDocument()
    // первый пул — полем «добавить по имени» + Enter
    const draft = screen.getByPlaceholderText('добавить по имени…')
    fireEvent.change(draft, { target: { value: 'classic_template_pool_random_t1_base' } })
    fireEvent.keyDown(draft, { key: 'Enter' })
    expect(screen.getByText('Сравнение (1)')).toBeInTheDocument()
    // второй пул — кнопкой «+» у строки
    fireEvent.click(within(rowOf('template_pool_random_unguarded_t3_item')).getByTitle('Добавить в выбранные'))
    // общие списки: list_a; объединение: list_a/list_b/list_c → Jaccard 1/3 = 33%
    expect(await screen.findByText('состав списков · общих 1 из 3 · Jaccard 33%')).toBeInTheDocument()
    expect(screen.getByText('Сравнение 2/6')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сравнение (2)' })).toBeInTheDocument()
    expect(screen.getByText('общие (во всех):')).toBeInTheDocument()
  })

  it('фильтр kind=«зона» оставляет только зональные пулы', async () => {
    await renderLoaded()
    fireEvent.change(screen.getByDisplayValue('все'), { target: { value: 'template' } })
    expect(screen.getByText('template_pool_jebus_guarded_main')).toBeInTheDocument()
    expect(screen.queryByText('classic_template_pool_random_t1_base')).not.toBeInTheDocument()
    expect(screen.queryByText('weird_pool')).not.toBeInTheDocument()
  })

  it('чип тиpa t1 фильтрует рандомные/классические пулы', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: 't1' }))
    expect(screen.getByText('classic_template_pool_random_t1_base')).toBeInTheDocument()
    expect(screen.queryByText('template_pool_random_unguarded_t3_item')).not.toBeInTheDocument()
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
  })

  it('Escape и кнопка «Закрыть» закрывают каталог', async () => {
    const { onClose } = await renderLoaded()
    fireEvent.keyDown(screen.getByPlaceholderText('Поиск по имени пула (substring)'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('«Сброс» возвращает все строки и очищает поиск', async () => {
    await renderLoaded()
    const search = screen.getByPlaceholderText('Поиск по имени пула (substring)')
    fireEvent.change(search, { target: { value: 'jebus' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сброс' }))
    expect(screen.queryByText('template_pool_random_unguarded_t3_item')).toBeInTheDocument()
    expect(screen.getByText('4 / 4')).toBeInTheDocument()
    const prefs = JSON.parse(localStorage.getItem('hooe.poolBrowser.prefs.v1') ?? 'null')
    expect(prefs?.search).toBe('')
  })

  it('префы из localStorage применяются при открытии (режим и поиск)', async () => {
    localStorage.setItem(
      'hooe.poolBrowser.prefs.v1',
      JSON.stringify({ mode: 'lists', search: 'list_c' }),
    )
    renderBrowser()
    expect(await screen.findByText('list_c')).toBeInTheDocument()
    expect(screen.queryByText('list_a')).not.toBeInTheDocument()
  })
})
