import { describe, expect, it } from 'vitest'
import type { RmgTemplate } from '../types/rmg'
import { buildSidecar, parseSidecar, sidecarFileName, templateBaseName } from './fsAccess'

const tpl: RmgTemplate = {
  name: 'Sidecar Test',
  gameMode: 'Classic',
  variants: [{ zones: [], connections: [] }],
} as unknown as RmgTemplate

describe('buildSidecar', () => {
  it('не пишет version; пустые sectionStates/notes не пишутся', () => {
    const text = buildSidecar(tpl, [{ A: { x: 1, y: 2 } }], {}, {})
    const data = JSON.parse(text) as Record<string, unknown>
    expect(data.editor).toBe('oe-template-editor')
    expect('version' in data).toBe(false)
    expect(data.templateFile).toBe('Sidecar Test.rmg.json')
    expect(data.positions).toEqual([{ A: { x: 1, y: 2 } }])
    expect('sectionStates' in data).toBe(false)
    expect('notes' in data).toBe(false)
  })

  it('непустые sectionStates/notes попадают в файл', () => {
    const text = buildSidecar(tpl, [], { 'zone.layout': false }, { A: 'заметка' })
    const data = JSON.parse(text) as Record<string, unknown>
    expect(data.sectionStates).toEqual({ 'zone.layout': false })
    expect(data.notes).toEqual({ A: 'заметка' })
  })

  it('имя файла шаблона санитизируется', () => {
    const text = buildSidecar({ ...tpl, name: 'a/b:c*?' }, [])
    expect((JSON.parse(text) as { templateFile: string }).templateFile).toBe('a_b_c_.rmg.json')
  })

  it('пишется с табами, без пробельных отступов (как штатные шаблоны игры)', () => {
    const text = buildSidecar(tpl, [{ A: { x: 1, y: 2 } }])
    expect(text).toContain('\n\t"editor": "oe-template-editor"')
    expect(text).toContain('\n\t\t\t\t"x": 1')
    expect(text).not.toMatch(/^ +/m)
  })
})

describe('parseSidecar: мягкий разбор', () => {
  it('минимальный sidecar (только positions) читается; секции/заметки — пустые', () => {
    const minimal = JSON.stringify({
      editor: 'oe-template-editor',
      templateFile: 'X.rmg.json',
      positions: [{ A: { x: 1.5, y: -2 } }],
    })
    expect(parseSidecar(minimal)).toEqual({
      positions: [{ A: { x: 1.5, y: -2 } }],
      sectionStates: {},
      notes: {},
    })
  })

  it('посторонние поля (в т.ч. version из ранних черновиков) игнорируются', () => {
    const noisy = JSON.stringify({
      editor: 'oe-template-editor',
      version: 1,
      templateFile: 'X.rmg.json',
      positions: [{ A: { x: 3, y: 4 } }],
      future: { unknown: true },
    })
    expect(parseSidecar(noisy)).toEqual({
      positions: [{ A: { x: 3, y: 4 } }],
      sectionStates: {},
      notes: {},
    })
  })

  it('roundtrip с buildSidecar читается целиком', () => {
    const text = buildSidecar(tpl, [{ Z: { x: 0, y: 0 } }], { 'conn.main': false, 'zone.pools': true }, { Z: 'текст\nмногострочный' })
    expect(parseSidecar(text)).toEqual({
      positions: [{ Z: { x: 0, y: 0 } }],
      sectionStates: { 'conn.main': false, 'zone.pools': true },
      notes: { Z: 'текст\nмногострочный' },
    })
  })

  it('null/битый JSON/не-объект/без positions — null', () => {
    expect(parseSidecar(null)).toBeNull()
    expect(parseSidecar('')).toBeNull()
    expect(parseSidecar('{ не json')).toBeNull()
    expect(parseSidecar('"строка"')).toBeNull()
    expect(parseSidecar('{"sectionStates":{"a":true}}')).toBeNull()
  })

  it('фильтрует мусор в positions и нестандартные значения в sectionStates/notes', () => {
    const parsed = parseSidecar(
      JSON.stringify({
        editor: 'x',
        positions: [{ A: { x: 1, y: 2 }, B: 'мусор', C: { x: 'a', y: 2 }, D: { x: 1, y: NaN } }],
        sectionStates: { ok: true, bad: 'yes', '': false },
        notes: { A: 'ok', B: 42, C: '   ' },
      }),
    )
    expect(parsed?.positions).toEqual([{ A: { x: 1, y: 2 } }])
    expect(parsed?.sectionStates).toEqual({ ok: true, '': false })
    expect(parsed?.notes).toEqual({ A: 'ok' })
  })
})

describe('имена пары файлов', () => {
  it('templateBaseName срезает .rmg.json и .json', () => {
    expect(templateBaseName('One To One.rmg.json')).toBe('One To One')
    expect(templateBaseName('tpl.json')).toBe('tpl')
    expect(templateBaseName('weird.editor.json')).toBe('weird.editor')
  })

  it('sidecarFileName даёт парный .editor.json по имени файла шаблона', () => {
    expect(sidecarFileName('One To One.rmg.json')).toBe('One To One.editor.json')
    expect(sidecarFileName('tpl.json')).toBe('tpl.editor.json')
  })
})
