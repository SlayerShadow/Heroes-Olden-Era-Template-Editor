import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { RmgTemplate } from '../types/rmg'
import { sampleTemplate } from '../data/sampleTemplate'
import { parseSnapshot, serializeSnapshot, SNAPSHOT_VERSION, type SnapshotSource } from './sessionSnapshot'

const ANARCHY_PATH = new URL('../../export/Anarchy.rmg.json', import.meta.url)

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, '')
}

/** Минимальный валидный шаблон на 2 варианта. */
function tinyTemplate(): RmgTemplate {
  return {
    name: 'Tiny',
    gameMode: 'Classic',
    sizeX: 64,
    sizeZ: 64,
    variants: [
      { zones: [], connections: [] },
      { zones: [], connections: [] },
    ],
    zoneLayouts: [{ name: 'zone_layout_empty' }],
    valueOverrides: [],
    gameRules: {},
    contentPools: [],
    contentLists: [],
  }
}

function baseSource(over: Partial<SnapshotSource> = {}): SnapshotSource {
  return {
    template: tinyTemplate(),
    positions: [{ A: { x: 1, y: 2 } }, {}],
    notes: { A: 'заметка' },
    sectionStates: { 'zone:main': true },
    activeVariant: 1,
    sourceName: 'Tiny.rmg.json',
    dirty: true,
    ...over,
  }
}

describe('sessionSnapshot: round-trip', () => {
  it('сериализация→разбор сохраняют все поля без потерь', () => {
    const src = baseSource()
    const parsed = parseSnapshot(serializeSnapshot(src))
    expect(parsed).not.toBeNull()
    expect(parsed!.version).toBe(SNAPSHOT_VERSION)
    expect(parsed!.template).toEqual(src.template)
    expect(parsed!.positions).toEqual(src.positions)
    expect(parsed!.notes).toEqual(src.notes)
    expect(parsed!.sectionStates).toEqual(src.sectionStates)
    expect(parsed!.activeVariant).toBe(1)
    expect(parsed!.sourceName).toBe('Tiny.rmg.json')
    expect(parsed!.dirty).toBe(true)
  })

  it('positions нормализуются к числу вариантов шаблона (лишние слоты отбрасываются, недостающие — пустые)', () => {
    const src = baseSource({ positions: [{ A: { x: 1, y: 2 } }] }) // 1 слот на 2 варианта
    const parsed = parseSnapshot(serializeSnapshot(src))!
    expect(parsed.positions).toHaveLength(2)
    expect(parsed.positions[0]).toEqual({ A: { x: 1, y: 2 } })
    expect(parsed.positions[1]).toEqual({})
  })

  it('savedAt переживает round-trip; отсутствует (старый формат) или битый → null', () => {
    const withTime = parseSnapshot(serializeSnapshot(baseSource({ savedAt: 1759338586000 })))!
    expect(withTime.savedAt).toBe(1759338586000)

    // Старый формат снапшота: поля нет вовсе
    expect(parseSnapshot(serializeSnapshot(baseSource()))!.savedAt).toBeNull()

    // Битые значения нормализуются в null
    const raw = JSON.parse(serializeSnapshot(baseSource()))
    raw.savedAt = '20:09'
    expect(parseSnapshot(JSON.stringify(raw))!.savedAt).toBeNull()
    raw.savedAt = Number.NaN // JSON.stringify(NaN) → null
    expect(parseSnapshot(JSON.stringify(raw))!.savedAt).toBeNull()
  })
})

describe('sessionSnapshot: нормализация битых/нечаянных значений', () => {
  it('activeVariant вне диапазона → clamp в границы; нечисло → 0', () => {
    const over = parseSnapshot(serializeSnapshot(baseSource({ activeVariant: 99 })))!
    expect(over.activeVariant).toBe(1) // 2 варианта → максимум 1
    const neg = parseSnapshot(serializeSnapshot(baseSource({ activeVariant: -5 })))!
    expect(neg.activeVariant).toBe(0)
  })

  it('битые точки в positions (NaN/не-объекты) отбрасываются, валидные остаются', () => {
    const raw = serializeSnapshot(baseSource())
    const obj = JSON.parse(raw)
    obj.positions = [{ Good: { x: 3, y: 4 }, BadNaN: { x: NaN, y: 1 }, Junk: 5 }, null]
    const parsed = parseSnapshot(JSON.stringify(obj))!
    expect(parsed.positions[0]).toEqual({ Good: { x: 3, y: 4 } })
    expect(parsed.positions[1]).toEqual({})
  })

  it('dirty приводится к булеву (нестрогое true → false)', () => {
    const raw = serializeSnapshot(baseSource())
    const obj = JSON.parse(raw)
    obj.dirty = 'yes'
    expect(parseSnapshot(JSON.stringify(obj))!.dirty).toBe(false)
    obj.dirty = true
    expect(parseSnapshot(JSON.stringify(obj))!.dirty).toBe(true)
  })

  it('notes/sectionStates фильтруют посторонние значения', () => {
    const raw = serializeSnapshot(baseSource())
    const obj = JSON.parse(raw)
    obj.notes = { ok: 'text', bad: 42 }
    obj.sectionStates = { a: true, b: 'no', c: false }
    const parsed = parseSnapshot(JSON.stringify(obj))!
    expect(parsed.notes).toEqual({ ok: 'text' })
    expect(parsed.sectionStates).toEqual({ a: true, c: false })
  })
})

describe('sessionSnapshot: отказ на негодных данных', () => {
  it('null/пустая строка/битый JSON → null', () => {
    expect(parseSnapshot(null)).toBeNull()
    expect(parseSnapshot('')).toBeNull()
    expect(parseSnapshot('{ not json')).toBeNull()
  })

  it('не та версия → null', () => {
    const raw = serializeSnapshot(baseSource())
    const obj = JSON.parse(raw)
    obj.version = SNAPSHOT_VERSION + 1
    expect(parseSnapshot(JSON.stringify(obj))).toBeNull()
  })

  it('template отсутствует / не объект / без variants / с нестроковым name → null', () => {
    expect(parseSnapshot(JSON.stringify({ version: SNAPSHOT_VERSION }))).toBeNull()
    expect(parseSnapshot(JSON.stringify({ version: SNAPSHOT_VERSION, template: 5 }))).toBeNull()
    expect(
      parseSnapshot(JSON.stringify({ version: SNAPSHOT_VERSION, template: { name: 'x' } })),
    ).toBeNull()
    expect(
      parseSnapshot(JSON.stringify({ version: SNAPSHOT_VERSION, template: { name: 1, variants: [] } })),
    ).toBeNull()
  })

  it('невалидный, но структурно-целый шаблон сохраняется как есть (редактор хранит ТЕКУЩЕЕ состояние)', () => {
    // Промежуточное «неправильное» состояние: связь ссылается на несуществующую зону.
    const broken = tinyTemplate()
    broken.variants[0].connections = [
      { from: 'ghost', to: 'nobody', connectionType: 'Direct', road: true, guardValue: 0 },
    ]
    const parsed = parseSnapshot(serializeSnapshot(baseSource({ template: broken })))!
    expect(parsed.template.variants[0].connections).toEqual(broken.variants[0].connections)
  })
})

describe('sessionSnapshot: round-trip на sampleTemplate', () => {
  it('большой реалистичный шаблон переживает сериализацию без потерь', () => {
    const src = baseSource({ template: sampleTemplate, sourceName: 'sample.rmg.json' })
    const parsed = parseSnapshot(serializeSnapshot(src))!
    expect(parsed.template).toEqual(sampleTemplate)
    expect(parsed.positions).toHaveLength(sampleTemplate.variants.length)
  })
})

describe.skipIf(!existsSync(ANARCHY_PATH))(
  'sessionSnapshot: крупнейший официальный шаблон Anarchy (193 КБ)',
  () => {
    it('round-trip идентичен и укладывается в квоту localStorage (~5 МБ)', () => {
      // Чтение — внутри it(), а не в теле describe: skipIf скипает задачи,
      // но фабрика сюита выполняется при коллекции (ENOENT в чистом клоне).
      const anarchy = JSON.parse(stripBom(readFileSync(ANARCHY_PATH, 'utf8'))) as RmgTemplate
      const src = baseSource({
        template: anarchy,
        positions: [],
        notes: {},
        sectionStates: {},
        activeVariant: 0,
        sourceName: 'Anarchy.rmg.json',
        dirty: true,
      })
      const text = serializeSnapshot(src)
      // Квота localStorage в Chrome/Edge ~5 МБ на источник; строка UTF-16 — 2 байта/символ.
      // Оставляем большой запас: снапшот обязан помещаться даже с заметками/позициями.
      expect(text.length).toBeLessThan(2_000_000)
      const parsed = parseSnapshot(text)!
      expect(parsed.template).toEqual(anarchy)
      expect(parsed.positions).toHaveLength(anarchy.variants.length)
      expect(parsed.sourceName).toBe('Anarchy.rmg.json')
      expect(parsed.dirty).toBe(true)
    })
  },
)
