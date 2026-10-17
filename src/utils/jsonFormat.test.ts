import { describe, expect, it } from 'vitest'
import { JSON_INDENT, stringifyJson } from './jsonFormat'

describe('stringifyJson', () => {
  it('отступ — табуляция, не пробелы (как в штатных шаблонах игры)', () => {
    const text = stringifyJson({ a: { b: { c: 1 } } })
    expect(text).toBe('{\n\t"a": {\n\t\t"b": {\n\t\t\t"c": 1\n\t\t}\n\t}\n}')
    expect(text).not.toMatch(/^ /m)
    expect(text.split('\n')[1].startsWith(JSON_INDENT)).toBe(true)
  })

  it('разбирается обратно без потерь (roundtrip)', () => {
    const data = {
      name: 'Jebus Cross',
      valueOverrides: [{ sid: 'point_of_balance', variant: 0, guardValue: 9750 }],
      parameters: ['movementBonus', '0'],
      gameRules: { heroCountMin: 5, encounterHoles: false },
      empty: [] as unknown[],
      zero: 0,
      nil: null,
    }
    expect(JSON.parse(stringifyJson(data))).toEqual(data)
  })

  it('порядок ключей и формат чисел как в исходном объекте', () => {
    const text = stringifyJson({ b: 1, a: 2, c: [1.5, 1e3, -0] })
    expect(text.indexOf('"b"')).toBeLessThan(text.indexOf('"a"'))
    expect(text).toContain('"c": [\n\t\t1.5,\n\t\t1000,\n\t\t0\n\t]')
  })

  it('без BOM и без хвостовой перевод строки', () => {
    const text = stringifyJson({ a: 1 })
    expect(text.charCodeAt(0)).toBe('{'.charCodeAt(0))
    expect(text.endsWith('}')).toBe(true)
  })
})
