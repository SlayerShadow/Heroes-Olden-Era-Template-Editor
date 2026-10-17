import { describe, expect, it } from 'vitest'
import type { ContentPool } from '../data/poolCatalog'
import { comparePools, parsePoolName, poolListWeights, poolTags } from './pools'

function pool(name: string, groups: Array<{ list: string; weight?: number }>): ContentPool {
  return { name, groups: groups.map((g) => ({ weight: g.weight ?? 1, lists: [g.list] })) }
}

describe('poolTags', () => {
  it('рандомный пул: коды kind/guard/tier/profile', () => {
    expect(poolTags(parsePoolName('template_pool_random_unguarded_t3_item'))).toEqual([
      'kind.random',
      'guard.unguarded',
      't3',
      'profile.item',
    ])
  })

  it('классический пул: kind.classic + guard.guarded по умолчанию', () => {
    expect(poolTags(parsePoolName('classic_template_pool_random_t1_base'))).toEqual([
      'kind.classic',
      'guard.guarded',
      't1',
      'profile.base',
    ])
  })

  it('зональный пул: kind.template + template + guard + role (данные как есть)', () => {
    expect(poolTags(parsePoolName('template_pool_jebus_guarded_main'))).toEqual([
      'kind.template',
      'guard.guarded',
      'jebus',
      'main',
    ])
  })

  it('контент-пул ресурсов: kind.content + wealth, role ресурсов не выводится', () => {
    expect(poolTags(parsePoolName('content_pool_resources_medium'))).toEqual(['kind.content', 'medium'])
  })

  it('неизвестное имя: только kind.other', () => {
    expect(poolTags(parsePoolName('whatever'))).toEqual(['kind.other'])
  })
})

describe('poolListWeights', () => {
  it('суммирует вес списка по всем группам', () => {
    const p = pool('a', [
      { list: 'l1', weight: 100 },
      { list: 'l1', weight: 50 },
      { list: 'l2', weight: 30 },
    ])
    expect(poolListWeights(p)).toEqual(new Map([['l1', 150], ['l2', 30]]))
  })

  it('пустой пул — пустая карта', () => {
    expect(poolListWeights({ groups: [] })).toEqual(new Map())
  })
})

describe('comparePools', () => {
  it('идентичные пулы: все списки общие, jaccard = 1, различий нет', () => {
    const a = pool('a', [{ list: 'l1', weight: 10 }, { list: 'l2', weight: 20 }])
    const b = pool('b', [{ list: 'l1', weight: 10 }, { list: 'l2', weight: 20 }])
    const r = comparePools([a, b])
    expect(r.commonLists).toEqual(['l1', 'l2'])
    expect(r.uniqueLists).toEqual([])
    expect(r.jaccard).toBe(1)
    expect(r.matrix.every((m) => m.inAll && !m.differs)).toBe(true)
  })

  it('непересекающиеся пулы: общих нет, jaccard = 0, всё уникально', () => {
    const a = pool('a', [{ list: 'l1' }])
    const b = pool('b', [{ list: 'l2' }])
    const r = comparePools([a, b])
    expect(r.commonLists).toEqual([])
    expect(r.uniqueLists).toEqual(['l1', 'l2'])
    expect(r.jaccard).toBe(0)
  })

  it('одинаковый список с разными весами — differs, но не inAll-проблема', () => {
    const a = pool('a', [{ list: 'l1', weight: 10 }])
    const b = pool('b', [{ list: 'l1', weight: 40 }])
    const r = comparePools([a, b])
    const row = r.matrix[0]
    expect(row.inAll).toBe(true)
    expect(row.differs).toBe(true)
    expect(row.weights).toEqual([10, 40])
  })

  it('список в одном пуле из трёх — inAll false, differs true', () => {
    const a = pool('a', [{ list: 'l1', weight: 10 }])
    const b = pool('b', [{ list: 'l2' }])
    const c = pool('c', [{ list: 'l2' }])
    const r = comparePools([a, b, c])
    expect(r.matrix.find((m) => m.list === 'l1')?.inAll).toBe(false)
    expect(r.matrix.find((m) => m.list === 'l1')?.differs).toBe(true)
    expect(r.matrix.find((m) => m.list === 'l2')?.inAll).toBe(false) // l2 только в b и c
    expect(r.commonLists).toEqual([])
    expect(r.uniqueLists).toEqual(['l1'])
    expect(r.jaccard).toBe(0)
  })

  it('unionLists отсортирован по алфавиту, вес null для отсутствующего', () => {
    const a = pool('a', [{ list: 'z' }])
    const b = pool('b', [{ list: 'a', weight: 5 }])
    const r = comparePools([a, b])
    expect(r.unionLists).toEqual(['a', 'z'])
    expect(r.matrix).toEqual([
      { list: 'a', weights: [null, 5], inAll: false, differs: true },
      { list: 'z', weights: [1, null], inAll: false, differs: true },
    ])
  })

  it('один пул: всё общее и уникальное одновременно, jaccard = 1', () => {
    const r = comparePools([pool('a', [{ list: 'l1' }])])
    expect(r.commonLists).toEqual(['l1'])
    expect(r.uniqueLists).toEqual(['l1'])
    expect(r.jaccard).toBe(1)
  })
})