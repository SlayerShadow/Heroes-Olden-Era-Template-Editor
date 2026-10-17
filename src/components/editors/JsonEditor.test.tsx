import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../../store/editorStore'
import { validateZoneDraft, type JsonDraftError } from '../../utils/jsonEdit'
import { JsonEditor } from './JsonEditor'

/**
 * Компонентный тест JsonEditor (vitest-проект `ui`, jsdom).
 * Проверяет контракт «умного» черновика: dirty/ошибки/применение/сброс,
 * незатирание грязного черновика внешними изменениями, хоткеи и регистрацию
 * ошибок в сторе (jsonDraftErrors). Строки — настоящие, из ru-локали.
 */

/** Ошибка черновика `draftKey` в сторе, нормализованная к null («нет ошибки»). */
function draftError(key: string): JsonDraftError | null {
  return useEditorStore.getState().jsonDraftErrors[key] ?? null
}

type ApplyFn = (parsed: unknown) => JsonDraftError | null

function setup(value: unknown = { name: 'A', size: 0.9 }, onApply?: ApplyFn) {
  const current = { value }
  const apply = onApply ?? vi.fn(() => null)
  const validate = (parsed: unknown) => validateZoneDraft(parsed)
  const props = () => ({
    draftKey: 'zone:A',
    value: current.value,
    validate,
    onApply: apply,
  })
  const utils = render(<JsonEditor {...props()} />)
  return {
    ...utils,
    onApply: apply,
    current,
    rerender: () => utils.rerender(<JsonEditor {...props()} />),
    textarea: () => screen.getByLabelText('JSON-черновик'),
    applyBtn: () => screen.getByRole('button', { name: 'Применить' }),
    resetBtn: () => screen.getByRole('button', { name: 'Сбросить' }),
  }
}

describe('JsonEditor', () => {
  it('чистый черновик: сериализация value, кнопки выключены, ошибки нет', () => {
    setup()
    expect(screen.getByLabelText('JSON-черновик')).toHaveValue(
      JSON.stringify({ name: 'A', size: 0.9 }, null, 2),
    )
    expect(screen.getByRole('button', { name: 'Применить' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Сбросить' })).toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(draftError('zone:A')).toBeNull()
  })

  it('грязный валидный черновик: кнопки включены, статус «изменения не применены»', () => {
    const s = setup()
    fireEvent.change(s.textarea(), {
      target: { value: JSON.stringify({ name: 'A', size: 1.2 }, null, 2) },
    })
    expect(s.applyBtn()).toBeEnabled()
    expect(s.resetBtn()).toBeEnabled()
    expect(screen.getByText('изменения не применены')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(draftError('zone:A')).toBeNull()
  })

  it('синтаксическая ошибка: alert, aria-invalid, «Применить» выключен, ошибка в сторе', () => {
    const s = setup()
    fireEvent.change(s.textarea(), { target: { value: '{"name":' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Синтаксическая ошибка JSON')
    expect(s.textarea()).toHaveAttribute('aria-invalid', 'true')
    expect(s.applyBtn()).toBeDisabled()
    expect(draftError('zone:A')?.code).toBe('syntax')
  })

  it('ошибка формы (zoneNameMissing): перевод alert и код в сторе', () => {
    const s = setup()
    fireEvent.change(s.textarea(), { target: { value: '{"size":1}' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Не хватает обязательного поля name')
    expect(s.applyBtn()).toBeDisabled()
    expect(draftError('zone:A')?.code).toBe('zoneNameMissing')
  })

  it('деталь ошибки подставляется в перевод (zoneNameTaken)', () => {
    const utils = render(
      <JsonEditor
        draftKey="zone:B"
        value={{ name: 'B' }}
        validate={() => ({ code: 'zoneNameTaken', detail: 'A' })}
        onApply={vi.fn(() => null)}
      />,
    )
    fireEvent.change(utils.getByLabelText('JSON-черновик'), {
      target: { value: '{"name":"X"}' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Имя «A» уже занято другой зоной варианта')
    expect(draftError('zone:B')?.code).toBe('zoneNameTaken')
    expect(utils.getByRole('button', { name: 'Применить' })).toBeDisabled()
  })

  it('«Применить»: коммит, канонизация и возврат в чистое состояние после синка', () => {
    const s = setup()
    const next = { name: 'A', size: 1.5 }
    // пользователь вводит компактный JSON — после применения он канонизируется
    fireEvent.change(s.textarea(), { target: { value: JSON.stringify(next) } })
    fireEvent.click(s.applyBtn())
    expect(s.onApply).toHaveBeenCalledTimes(1)
    expect(s.onApply).toHaveBeenCalledWith(next)
    // стор обновился → родитель перерендерил с новым value → черновик чистый
    s.current.value = next
    s.rerender()
    expect(s.textarea()).toHaveValue(JSON.stringify(next, null, 2))
    expect(s.applyBtn()).toBeDisabled()
    expect(draftError('zone:A')).toBeNull()
  })

  it('отклонённый onApply: ошибка в alert и сторе, текст не сбрасывается, кнопка активна', () => {
    const onApply = vi.fn(() => ({ code: 'zoneNameTaken', detail: 'A' }) as JsonDraftError)
    const s = setup({ name: 'A', size: 0.9 }, onApply)
    const edited = JSON.stringify({ name: 'A', size: 2 }, null, 2)
    fireEvent.change(s.textarea(), { target: { value: edited } })
    fireEvent.click(s.applyBtn())
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toHaveTextContent('Имя «A» уже занято другой зоной варианта')
    expect(s.textarea()).toHaveAttribute('aria-invalid', 'true')
    expect(draftError('zone:A')?.code).toBe('zoneNameTaken')
    expect(s.textarea()).toHaveValue(edited)
    expect(s.applyBtn()).toBeEnabled()
    // правка текста снимает ошибку отклонения (и из стора)
    fireEvent.change(s.textarea(), { target: { value: edited.replace('"size": 2', '"size": 3') } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(draftError('zone:A')).toBeNull()
  })

  it('«Сбросить» после отклонённого onApply снимает ошибку и возвращает эталон', () => {
    const onApply = vi.fn(() => ({ code: 'zoneNameTaken', detail: 'A' }) as JsonDraftError)
    const s = setup(undefined, onApply)
    fireEvent.change(s.textarea(), { target: { value: '{"name":"A","size":2}' } })
    fireEvent.click(s.applyBtn())
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(s.resetBtn())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(s.textarea()).toHaveValue(JSON.stringify({ name: 'A', size: 0.9 }, null, 2))
    expect(draftError('zone:A')).toBeNull()
  })

  it('«Сбросить» возвращает эталон и выключает кнопки', () => {
    const s = setup()
    const base = JSON.stringify({ name: 'A', size: 0.9 }, null, 2)
    fireEvent.change(s.textarea(), { target: { value: '{"name":"A","size":9}' } })
    fireEvent.click(s.resetBtn())
    expect(s.textarea()).toHaveValue(base)
    expect(s.applyBtn()).toBeDisabled()
    expect(s.resetBtn()).toBeDisabled()
  })

  it('внешнее изменение чистого черновика синхронизируется в текст', () => {
    const s = setup()
    s.current.value = { name: 'A', size: 2 }
    s.rerender()
    expect(s.textarea()).toHaveValue(JSON.stringify({ name: 'A', size: 2 }, null, 2))
    expect(s.applyBtn()).toBeDisabled()
  })

  it('грязный черновик не затирается внешним изменением', () => {
    const s = setup()
    const userText = JSON.stringify({ name: 'A', size: 1.2 }, null, 2)
    fireEvent.change(s.textarea(), { target: { value: userText } })
    s.current.value = { name: 'A', size: 2 }
    s.rerender()
    expect(s.textarea()).toHaveValue(userText)
    expect(s.applyBtn()).toBeEnabled()
  })

  it('размонтирование снимает ошибку черновика в сторе', () => {
    const s = setup()
    fireEvent.change(s.textarea(), { target: { value: 'not json' } })
    expect(draftError('zone:A')?.code).toBe('syntax')
    s.unmount()
    expect(draftError('zone:A')).toBeNull()
  })

  it('Ctrl+Enter применяет черновик', () => {
    const s = setup()
    fireEvent.change(s.textarea(), {
      target: { value: JSON.stringify({ name: 'A', size: 1.1 }) },
    })
    fireEvent.keyDown(s.textarea(), { key: 'Enter', ctrlKey: true })
    expect(s.onApply).toHaveBeenCalledTimes(1)
  })

  it('Tab вставляет два пробела вместо ухода из поля', () => {
    const s = setup()
    fireEvent.keyDown(s.textarea(), { key: 'Tab' })
    expect(s.textarea()).toHaveValue('  ' + JSON.stringify({ name: 'A', size: 0.9 }, null, 2))
  })
})
