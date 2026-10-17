import { describe, expect, it } from 'vitest'
import type { RmgTemplate } from '../types/rmg'
import {
  mergeRootJson,
  parseJson,
  rootJsonView,
  validateConnDraft,
  validateRootDraft,
  validateZoneDraft,
} from './jsonEdit'

function makeTemplate(): RmgTemplate {
  return {
    name: 'T',
    gameMode: 'Classic',
    sizeX: 128,
    sizeZ: 128,
    variants: [
      {
        orientation: { mode: 'BoundingCircle' },
        border: { cornerRadius: 0.3 },
        zones: [{ name: 'Z1', size: 1, layout: 'l', mainObjects: [], zoneBiome: { type: 'FromList', args: [] }, contentBiome: { type: 'FromList', args: [] }, metaObjectsBiome: { type: 'FromList', args: [] } }],
        connections: [{ from: 'Z1', to: 'Z2', connectionType: 'Direct' }],
      },
      { zones: [], connections: [] },
    ],
  }
}

describe('parseJson', () => {
  it('разбирает валидный JSON', () => {
    const r = parseJson('{"a": 1}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ a: 1 })
  })
  it('возвращает syntax-ошибку с detail', () => {
    const r = parseJson('{oops')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('syntax')
      expect(r.error.detail).toBeTruthy()
    }
  })
})

describe('validateZoneDraft', () => {
  it('не объект — notObject', () => {
    expect(validateZoneDraft([1])).toEqual({ code: 'notObject' })
    expect(validateZoneDraft(null)).toEqual({ code: 'notObject' })
  })
  it('пустое/отсутствующее имя — zoneNameMissing', () => {
    expect(validateZoneDraft({ size: 1 })?.code).toBe('zoneNameMissing')
    expect(validateZoneDraft({ name: '  ' })?.code).toBe('zoneNameMissing')
  })
  it('занятое имя — zoneNameTaken с detail', () => {
    expect(validateZoneDraft({ name: 'A' }, ['A', 'B'])).toEqual({ code: 'zoneNameTaken', detail: 'A' })
  })
  it('валидный черновик — null', () => {
    expect(validateZoneDraft({ name: 'C' }, ['A', 'B'])).toBeNull()
    expect(validateZoneDraft({ name: 'A' }, ['B'])).toBeNull()
  })
})

describe('validateConnDraft', () => {
  it('не объект', () => {
    expect(validateConnDraft('x')?.code).toBe('notObject')
  })
  it('нет from/to', () => {
    expect(validateConnDraft({ connectionType: 'Direct', to: 'B' })?.code).toBe('connEndpointsMissing')
    expect(validateConnDraft({ from: 'A', to: '', connectionType: 'Direct' })?.code).toBe('connEndpointsMissing')
  })
  it('нет connectionType', () => {
    expect(validateConnDraft({ from: 'A', to: 'B' })?.code).toBe('connTypeMissing')
  })
  it('валиден', () => {
    expect(validateConnDraft({ from: 'A', to: 'B', connectionType: 'Portal' })).toBeNull()
  })
})

describe('validateRootDraft', () => {
  it('не объект / нет name / variants не совпадают', () => {
    expect(validateRootDraft([], 1)?.code).toBe('notObject')
    expect(validateRootDraft({ variants: [{}] }, 1)?.code).toBe('rootNameMissing')
    expect(validateRootDraft({ name: 'T', variants: [{}] }, 2)?.code).toBe('rootVariantsMismatch')
    expect(validateRootDraft({ name: 'T' }, 1)?.code).toBe('rootVariantsMismatch')
  })
  it('валиден', () => {
    expect(validateRootDraft({ name: 'T', variants: [{}, {}] }, 2)).toBeNull()
  })
})

describe('rootJsonView / mergeRootJson', () => {
  it('view исключает zones/connections, сохраняя остальные поля вариантов', () => {
    const tpl = makeTemplate()
    const view = JSON.parse(JSON.stringify(rootJsonView(tpl)))
    expect(view.name).toBe('T')
    expect(view.variants).toHaveLength(2)
    expect(view.variants[0].zones).toBeUndefined()
    expect(view.variants[0].connections).toBeUndefined()
    expect(view.variants[0].orientation).toEqual({ mode: 'BoundingCircle' })
    expect(view.variants[0].border).toEqual({ cornerRadius: 0.3 })
  })
  it('round-trip через JSON возвращает исходный шаблон', () => {
    const tpl = makeTemplate()
    const parsed = JSON.parse(JSON.stringify(rootJsonView(tpl))) as RmgTemplate
    const merged = mergeRootJson(parsed, tpl)
    expect(merged).toEqual(tpl)
  })
  it('правка глобального поля во view применяется после merge, зоны не трогаются', () => {
    const tpl = makeTemplate()
    const parsed = JSON.parse(JSON.stringify(rootJsonView(tpl))) as RmgTemplate
    parsed.sizeX = 160
    parsed.variants[0].border = { cornerRadius: 0.5 }
    const merged = mergeRootJson(parsed, tpl)
    expect(merged.sizeX).toBe(160)
    expect(merged.sizeZ).toBe(128)
    expect(merged.variants[0].border).toEqual({ cornerRadius: 0.5 })
    expect(merged.variants[0].zones).toEqual(tpl.variants[0].zones)
    expect(merged.variants[0].connections).toEqual(tpl.variants[0].connections)
    expect(merged.variants[1].zones).toEqual([])
  })
})
