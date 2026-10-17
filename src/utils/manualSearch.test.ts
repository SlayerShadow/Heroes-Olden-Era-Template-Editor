/**
 * Тесты поиска по мануалу: фильтрация оглавления, построение индекса
 * и сегменты подсветки (чистые функции utils/manualSearch.ts).
 */
import { describe, expect, it } from 'vitest'
import type { ManualTocNode } from './manualToc'
import {
  buildNodeTextIndex,
  filterManualToc,
  highlightSegments,
  MIN_SEARCH_LEN,
} from './manualSearch'

function node(id: string, text: string, children: ManualTocNode[] = []): ManualTocNode {
  return { id, text, children }
}

// Синтетическое оглавление: две главы с подразделами
function makeChapters(): ManualTocNode[] {
  return [
    node('a', 'Зоны', [node('a1', 'Бюджет зоны'), node('a2', 'Типы зон')]),
    node('b', 'Связи', [node('b1', 'Дороги')]),
  ]
}

const NODE_TEXT = new Map<string, string>([
  ['a', 'Зоны общее описание'],
  ['a1', 'Бюджет зоны определяет количество стражи'],
  ['a2', 'Типы зон: лес, песок'],
  ['b', 'Связи между участками'],
  ['b1', 'Дороги соединяют'],
])

describe('filterManualToc', () => {
  it('запрос короче MIN_SEARCH_LEN возвращает исходные главы (та же ссылка)', () => {
    const chapters = makeChapters()
    expect(MIN_SEARCH_LEN).toBe(2)
    expect(filterManualToc(chapters, NODE_TEXT, '')).toBe(chapters)
    expect(filterManualToc(chapters, NODE_TEXT, 'з')).toBe(chapters)
    expect(filterManualToc(chapters, NODE_TEXT, '   ')).toBe(chapters)
  })

  it('совпадение в заголовке: остаётся ветка к совпадению', () => {
    const chapters = makeChapters()
    const filtered = filterManualToc(chapters, NODE_TEXT, 'бюджет')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('a')
    expect(filtered[0].children.map((c) => c.id)).toEqual(['a1'])
  })

  it('совпадение в тексте раздела: узел находится по контенту', () => {
    const chapters = makeChapters()
    const filtered = filterManualToc(chapters, NODE_TEXT, 'страж')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('a')
    expect(filtered[0].children.map((c) => c.id)).toEqual(['a1'])
  })

  it('совпал сам узел — остаётся всё поддерево (по ссылке, без копирования)', () => {
    const chapters = makeChapters()
    const filtered = filterManualToc(chapters, NODE_TEXT, 'зоны')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toBe(chapters[0])
    expect(filtered[0].children.map((c) => c.id)).toEqual(['a1', 'a2'])
  })

  it('нет совпадений — пустой результат', () => {
    expect(filterManualToc(makeChapters(), NODE_TEXT, 'ксьюд')).toEqual([])
  })

  it('регистронезависимость и trim запроса', () => {
    const filtered = filterManualToc(makeChapters(), NODE_TEXT, '  ДОРОГИ  ')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('b')
    expect(filtered[0].children.map((c) => c.id)).toEqual(['b1'])
  })

  it('несовпавший предок остаётся путём: у него только ветви к совпадениям', () => {
    // «лес» есть только в тексте a2 → предок a сохраняется, a1 вырезается
    const filtered = filterManualToc(makeChapters(), NODE_TEXT, 'лес')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('a')
    expect(filtered[0].children.map((c) => c.id)).toEqual(['a2'])
  })
})

describe('buildNodeTextIndex', () => {
  it('якорь H1 главы переводится в id узла главы через nodeByHeading', () => {
    const nodeByHeading = new Map<string, string>([['ch--глава', 'ch']])
    const index = buildNodeTextIndex([{ 'ch--глава': 'текст', 'ch--раздел': 'другой' }], nodeByHeading)
    expect(index.get('ch')).toBe('текст')
    expect(index.get('ch--раздел')).toBe('другой')
    expect(index.has('ch--глава')).toBe(false)
  })

  it('якорь без маппинга используется как есть (фолбэк)', () => {
    const index = buildNodeTextIndex([{ 'x--y': 'text' }], new Map())
    expect(index.get('x--y')).toBe('text')
  })

  it('несколько глав объединяются в один индекс', () => {
    const index = buildNodeTextIndex([{ a: 'one' }, { b: 'two' }], new Map())
    expect(index.get('a')).toBe('one')
    expect(index.get('b')).toBe('two')
  })
})

describe('highlightSegments', () => {
  it('запрос короче MIN_SEARCH_LEN — один сегмент без подсветки', () => {
    expect(highlightSegments('Зоны', 'з')).toEqual([{ text: 'Зоны', match: false }])
    expect(highlightSegments('Зоны', '')).toEqual([{ text: 'Зоны', match: false }])
  })

  it('вхождение в начале строки', () => {
    expect(highlightSegments('Бюджет зоны', 'бюджет')).toEqual([
      { text: 'Бюджет', match: true },
      { text: ' зоны', match: false },
    ])
  })

  it('вхождение в середине: три сегмента', () => {
    expect(highlightSegments('xabcx', 'abc')).toEqual([
      { text: 'x', match: false },
      { text: 'abc', match: true },
      { text: 'x', match: false },
    ])
  })

  it('несколько вхождений, исходный регистр сохраняется', () => {
    expect(highlightSegments('abXabXab', 'ab')).toEqual([
      { text: 'ab', match: true },
      { text: 'X', match: false },
      { text: 'ab', match: true },
      { text: 'X', match: false },
      { text: 'ab', match: true },
    ])
  })

  it('нет совпадений — один non-match сегмент', () => {
    expect(highlightSegments('Зоны', 'связи')).toEqual([{ text: 'Зоны', match: false }])
  })
})
