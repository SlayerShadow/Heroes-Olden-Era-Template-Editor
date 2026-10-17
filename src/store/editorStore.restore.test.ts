import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RmgTemplate } from '../types/rmg'
import { serializeSnapshot, type SnapshotSource } from '../utils/sessionSnapshot'

/**
 * Восстановление снапшота сессии при старте модуля editorStore.
 *
 * `restoredSession` вычисляется один раз при импорте модуля, поэтому каждый
 * тест импортирует store заново (vi.resetModules) с заранее подставленным
 * localStorage. Окружение node: `window` отсутствует — блок автосохранения
 * не подключается и не мешает (записи в снапшот не происходят).
 */

const SESSION_KEY = 'oe-editor:session'
/** Ключ локали — дублирует LOCALE_LS_KEY из `src/i18n/index.ts` (как SESSION_KEY). */
const LOCALE_KEY = 'oe-editor.locale'

function tinyTemplate(name: string): RmgTemplate {
  return {
    name,
    gameMode: 'Classic',
    sizeX: 64,
    sizeZ: 64,
    variants: [{ zones: [], connections: [] }],
    zoneLayouts: [{ name: 'zone_layout_empty' }],
    valueOverrides: [],
    gameRules: {},
    contentPools: [],
    contentLists: [],
  }
}

function snapshotJson(over: Partial<SnapshotSource> = {}): string {
  return serializeSnapshot({
    template: tinyTemplate('Восстановленный'),
    positions: [{}],
    notes: {},
    sectionStates: {},
    activeVariant: 0,
    sourceName: null,
    dirty: true,
    ...over,
  })
}

/** Подставить localStorage (ключ сессии + зафиксированная ru-локаль) и импортировать store/i18n с чистого листа. */
async function freshStoreWith(rawSnapshot: string | null) {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => {
      if (key === SESSION_KEY) return rawSnapshot
      // Фиксируем ru: без сохранённой локали детект в node взял бы язык
      // navigator ('en-US') или фолбэк en, а тосты ниже ассертятся по-русски.
      if (key === LOCALE_KEY) return 'ru'
      return null
    },
  })
  vi.resetModules()
  const { default: i18n } = await import('../i18n')
  const { useEditorStore } = await import('./editorStore')
  return { i18n, state: useEditorStore.getState() }
}

describe('editorStore: восстановление сессии из снапшота', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('снапшота нет — пустой стор без тостов', async () => {
    const { state } = await freshStoreWith(null)
    expect(state.toasts).toEqual([])
  })

  it('снапшот с savedAt — info-тост «сессия восстановлена на момент ЧЧ:ММ»', async () => {
    // 01.10.2026 20:09:46 Москвы — момент перезагрузки из инцидента 20.5/20.6.
    const savedAt = Date.UTC(2026, 9, 1, 17, 9, 46)
    const { state } = await freshStoreWith(snapshotJson({ savedAt }))
    expect(state.template.name).toBe('Восстановленный')
    expect(state.toasts).toHaveLength(1)
    expect(state.toasts[0].kind).toBe('info')
    const time = new Date(savedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
    expect(state.toasts[0].text).toBe(`Восстановлена предыдущая сессия (на момент ${time}).`)
  })

  it('старый снапшот без savedAt — тост без времени', async () => {
    const { state } = await freshStoreWith(snapshotJson())
    expect(state.toasts).toHaveLength(1)
    expect(state.toasts[0].kind).toBe('info')
    expect(state.toasts[0].text).toBe('Восстановлена предыдущая сессия.')
  })

  it('битый savedAt (не число) — тост без времени, восстановление не срывается', async () => {
    const raw = JSON.parse(snapshotJson())
    raw.savedAt = '20:09'
    const { state } = await freshStoreWith(JSON.stringify(raw))
    expect(state.template.name).toBe('Восстановленный')
    expect(state.toasts[0].text).toBe('Восстановлена предыдущая сессия.')
  })
})
