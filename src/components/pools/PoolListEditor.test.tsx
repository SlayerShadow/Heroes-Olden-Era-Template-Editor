import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ContentList, ContentPool } from '../../data/poolCatalog'
import { PoolListEditor } from './PoolListEditor'

/**
 * Компонентный тест PoolListEditor (vitest-проект `ui`, jsdom).
 * Проверяет чипы выбранных пулов: известное имя — русская подпись
 * (humanPoolName), неизвестное — сырое; title чипа — сырое имя (+ теги
 * после загрузки каталога); «Каталог» открывает PoolBrowser; single-режим
 * заменяет значение и закрывает браузер.
 */

const fixtures = vi.hoisted(() => {
  const pools: ContentPool[] = [
    { name: 'classic_template_pool_random_t1_base', groups: [{ weight: 300, lists: ['list_a'] }] },
    { name: 'template_pool_random_unguarded_t3_item', groups: [] },
  ]
  const lists: ContentList[] = [{ name: 'list_a', content: [{ sid: 'pandora_box' }] }]
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

describe('PoolListEditor', () => {
  it('чипы: известное имя — русская подпись, неизвестное — сырое; title — сырое имя', () => {
    render(
      <PoolListEditor
        label="Охраняемый пул"
        value={['classic_template_pool_random_t1_base', 'weird_pool']}
        onChange={vi.fn()}
      />,
    )
    const label = screen.getByText('Классический случайный пул · t1 · базовый')
    expect(label).toBeInTheDocument()
    expect(screen.getByText('weird_pool')).toBeInTheDocument()
    // каталог ещё не загружен (names=null) — в title только сырое имя
    expect(label.closest('.pb-field__chip')).toHaveAttribute('title', 'classic_template_pool_random_t1_base')
  })

  it('«✕» убирает пул; «＋» добавляет валидное имя после загрузки каталога, невалидное — нет', async () => {
    const onChange = vi.fn()
    render(<PoolListEditor label="Охраняемый пул" value={['weird_pool']} onChange={onChange} />)
    fireEvent.click(screen.getByTitle('Убрать'))
    expect(onChange).toHaveBeenCalledWith([])

    const input = screen.getByPlaceholderText('pool_a, …')
    fireEvent.focus(input) // onOpen → ensureNames → loadCatalog (мок); ComboInput открывает полный список
    await vi.waitFor(() => expect(document.body.querySelector('.combo__opt')).not.toBeNull())

    fireEvent.change(input, { target: { value: 'classic_template_pool_random_t1_base' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith(['weird_pool', 'classic_template_pool_random_t1_base'])

    fireEvent.change(input, { target: { value: 'no_such_pool' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledTimes(2) // невалидное имя не добавлено
  })

  it('«Каталог» открывает PoolBrowser с подписями пулов', async () => {
    render(<PoolListEditor label="Охраняемый пул" value={[]} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Каталог' }))
    expect(await screen.findByText('Каталог · Охраняемый пул')).toBeInTheDocument()
    expect(await screen.findByText('Классический случайный пул · t1 · базовый')).toBeInTheDocument()
    expect(screen.getByText('Случайный пул · неохраняемый · t3 · предметы')).toBeInTheDocument()
  })

  it('single: выбор из каталога заменяет значение и закрывает браузер', async () => {
    const onChange = vi.fn()
    render(<PoolListEditor label="Ресурсы" value={[]} onChange={onChange} single />)
    expect(screen.getByPlaceholderText('одно имя пула')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Каталог' }))
    const row = (await screen.findByText('Классический случайный пул · t1 · базовый')).closest('details')
    if (!row) throw new Error('строка пула не найдена')
    fireEvent.click(within(row).getByTitle('Добавить в выбранные'))
    expect(onChange).toHaveBeenCalledWith(['classic_template_pool_random_t1_base'])
    expect(screen.queryByText('Каталог · Ресурсы')).not.toBeInTheDocument()
  })

  it('a11y-регрессия: клик по подписи поля не удаляет чипы; у input есть доступное имя', () => {
    const onChange = vi.fn()
    render(<PoolListEditor label="Охраняемый пул" value={['pool_a', 'pool_b']} onChange={onChange} />)
    // Обёртка поля — div, а не label: labeled control для <label> — первый
    // labelable-потомок (кнопка «✕» первого чипа), и клик по подписи удалял бы пул.
    const caption = screen.getByText('Охраняемый пул')
    expect(caption.closest('.pb-field')?.tagName).toBe('DIV')
    expect(document.querySelector('label.pb-field')).toBeNull()
    fireEvent.click(caption)
    expect(onChange).not.toHaveBeenCalled()
    // Доступное имя поля — aria-label на input (ComboInput, role=combobox).
    expect(screen.getByRole('combobox', { name: 'Охраняемый пул' })).toBeInTheDocument()
    // «✕» по-прежнему удаляет свой пул (поведение чипов не сломано).
    fireEvent.click(screen.getAllByTitle('Убрать')[0])
    expect(onChange).toHaveBeenCalledWith(['pool_b'])
  })
})
