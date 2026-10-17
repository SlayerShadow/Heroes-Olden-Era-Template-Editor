import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../../store/editorStore'
import type { RmgTemplate } from '../../types/rmg'
import { GroupRefList } from './GroupRefList'

/**
 * Компонентный тест GroupRefList (vitest-проект `ui`, jsdom).
 *
 * Проверяет замену сырых имён групп через запятую на чипы с оригинальным
 * именем (имена групп кастомные и не «переводятся»), локализованной сводкой
 * и tooltip-расшифровкой
 * (русские имена sid — настоящие, из sidCatalog + генерируемого sidNames;
 * первая строка tooltip — оригинальный идентификатор), бейджем «не найдена» для
 * отсутствующей группы и контракты добавления/удаления. Строки ассертятся из
 * ru-локали. Отдельный блок — навигация зона→группа: клик по чипу
 * существующей группы запрашивает в сторе переход (вкладка + цель подсветки).
 */

const TEMPLATE: RmgTemplate = {
  name: 'Test',
  gameMode: 'Classic',
  variants: [],
  mandatoryContent: [
    {
      name: 'group_spawn',
      content: [
        { sid: 'pandora_box', name: 'pandora' },
        { sid: 'mine_gold', isMine: true },
        { includeLists: ['list_a', 'list_b'] },
      ],
    },
    { name: 'group_center', content: [] },
  ],
  contentCountLimits: [
    { name: 'content_limits_spawn', limits: [{ sid: 'watchtower', maxCount: 2 }] },
  ],
}

beforeEach(() => {
  useEditorStore.setState({ template: TEMPLATE })
})

function renderMc(value: string[], onChange = vi.fn()) {
  const view = render(
    <GroupRefList label="Группы обязательного контента" kind="mc" value={value} onChange={onChange} />,
  )
  return { ...view, onChange }
}

const chips = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('.pb-field__chip'))
// Доступное имя кнопки удаления — её текст «✕» (title «Убрать» — лишь fallback).
const removeButtons = () => screen.getAllByRole('button', { name: '✕' })

describe('GroupRefList (mc)', () => {
  it('чип существующей группы: оригинальное имя + локализованная сводка', () => {
    const { container } = renderMc(['group_spawn'])
    const chip = chips(container)[0]
    expect(chip).toBeDefined()
    expect(chip.querySelector('.pb-field__chname')?.textContent).toBe('group_spawn')
    expect(chip.querySelector('.pb-field__chipsum')?.textContent).toBe('3 эл.')
    expect(chip.classList.contains('pb-field__chip--missing')).toBe(false)
  })

  it('tooltip расшифровывает содержимое группы русскими именами sid', () => {
    const { container } = renderMc(['group_spawn'])
    const title = chips(container)[0].getAttribute('title') ?? ''
    expect(title).toContain('group_spawn')
    expect(title).toContain('pandora · Ящик Пандоры (pandora_box)')
    expect(title).toContain('Золотая шахта (mine_gold) · шахта')
    expect(title).toContain('выбор из списка: list_a, list_b')
  })

  it('отсутствующая группа: бейдж «не найдена» и предупреждающий tooltip', () => {
    const { container } = renderMc(['ghost_group'])
    const chip = chips(container)[0]
    expect(chip.classList.contains('pb-field__chip--missing')).toBe(true)
    expect(chip.querySelector('.pb-field__chipmiss')?.textContent).toBe('не найдена')
    expect(chip.getAttribute('title')).toContain('Группа «ghost_group» не найдена')
  })

  it('«✕» удаляет имя из списка', () => {
    const { onChange } = renderMc(['group_spawn', 'group_center'])
    fireEvent.click(removeButtons()[0])
    expect(onChange).toHaveBeenCalledWith(['group_center'])
  })

  it('Enter в поле добавляет имя группы из корня', () => {
    const { onChange } = renderMc(['group_spawn'])
    fireEvent.change(screen.getByPlaceholderText('имя группы'), { target: { value: 'group_center' } })
    fireEvent.keyDown(screen.getByPlaceholderText('имя группы'), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['group_spawn', 'group_center'])
  })

  it('произвольное имя тоже добавляется (битые ссылки игра переносит — не ужесточаем)', () => {
    const { onChange } = renderMc([])
    fireEvent.change(screen.getByPlaceholderText('имя группы'), { target: { value: 'brand_new' } })
    fireEvent.click(screen.getByRole('button', { name: '＋' }))
    expect(onChange).toHaveBeenCalledWith(['brand_new'])
  })

  it('дубль и пустое имя игнорируются', () => {
    const { onChange } = renderMc(['group_spawn'])
    const input = screen.getByPlaceholderText('имя группы')
    // ComboInput: Enter при открытом списке выбирает подсказку — сперва закрываем список (Escape)
    fireEvent.change(input, { target: { value: 'group_spawn' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    // дубль через «＋»
    fireEvent.change(input, { target: { value: 'group_spawn' } })
    fireEvent.click(screen.getByRole('button', { name: '＋' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('подсказки ComboInput предлагают только незанятые группы: оригинал в value, сводка в label', () => {
    renderMc(['group_spawn'])
    fireEvent.focus(screen.getByPlaceholderText('имя группы'))
    const options = Array.from(document.body.querySelectorAll('.combo__opt'))
    expect(options.map((o) => o.querySelector('.combo__opt-value')?.textContent)).toEqual(['group_center'])
    expect(options[0].getAttribute('title')).toBe('0 эл. · group_center')
  })
})

describe('GroupRefList — навигация зона→группа', () => {
  it('чип найденной группы кликабелен: переход на вкладку «Контент» с запросом группы', () => {
    const { container } = renderMc(['group_spawn'])
    const go = container.querySelector<HTMLButtonElement>('.pb-field__go')
    expect(go).not.toBeNull()
    // Доступное имя — из ru-локали (своего title нет: всплывает tooltip чипа)
    expect(go?.getAttribute('aria-label')).toBe('Открыть группу group_spawn')
    fireEvent.click(go!)
    const s = useEditorStore.getState()
    expect(s.inspectorTab).toBe('content')
    expect(s.groupTarget).toMatchObject({ kind: 'mc', name: 'group_spawn' })
  })

  it('группа лимитов ведёт на вкладку «Лимиты»', () => {
    const { container } = render(
      <GroupRefList label="Группы лимитов количества" kind="cl" value={['content_limits_spawn']} onChange={vi.fn()} />,
    )
    fireEvent.click(container.querySelector('.pb-field__go')!)
    const s = useEditorStore.getState()
    expect(s.inspectorTab).toBe('limits')
    expect(s.groupTarget).toMatchObject({ kind: 'cl', name: 'content_limits_spawn' })
  })

  it('битая ссылка не кликабельна (переходить некуда) — остаётся бейдж «не найдена»', () => {
    const { container } = renderMc(['ghost_group'])
    expect(container.querySelector('.pb-field__go')).toBeNull()
    expect(container.querySelector('.pb-field__chipmiss')?.textContent).toBe('не найдена')
  })

  it('клик по «✕» удаляет ссылку и не запрашивает переход', () => {
    const { container, onChange } = renderMc(['group_spawn'])
    fireEvent.click(removeButtons()[0])
    expect(onChange).toHaveBeenCalledWith([])
    expect(useEditorStore.getState().groupTarget).toBeNull()
    expect(container.querySelector('.pb-field__go')).not.toBeNull()
  })
})

describe('GroupRefList (cl)', () => {
  it('оригинальное имя, сводка лимитов и tooltip с русским именем и максимумом', () => {
    const { container } = render(
      <GroupRefList label="Группы лимитов количества" kind="cl" value={['content_limits_spawn']} onChange={vi.fn()} />,
    )
    const chip = chips(container as HTMLElement)[0]
    expect(chip.querySelector('.pb-field__chname')?.textContent).toBe('content_limits_spawn')
    expect(chip.querySelector('.pb-field__chipsum')?.textContent).toBe('1 лим.')
    expect(chip.getAttribute('title')).toContain('Наблюдательная вышка (watchtower): не более 2')
  })

  it('несуществующая группа лимитов: сырое имя и бейдж «не найдена»', () => {
    const { container } = render(
      <GroupRefList label="Группы лимитов количества" kind="cl" value={['content_limits_side_1_2']} onChange={vi.fn()} />,
    )
    const chip = chips(container as HTMLElement)[0]
    expect(chip.querySelector('.pb-field__chname')?.textContent).toBe('content_limits_side_1_2')
    expect(chip.querySelector('.pb-field__chipmiss')?.textContent).toBe('не найдена')
  })
})
