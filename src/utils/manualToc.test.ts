import { describe, expect, it } from 'vitest'
import { buildManualToc } from './manualToc'

describe('buildManualToc', () => {
  it('строит дерево: глава — корень, H2/H3 — вложенные узлы', () => {
    const toc = buildManualToc([
      {
        slug: 'a',
        title: 'Глава А',
        headings: [
          { level: 1, text: 'Глава А', id: 'a--глава-а' },
          { level: 2, text: 'Раздел', id: 'a--раздел' },
          { level: 3, text: 'Подраздел', id: 'a--подраздел' },
          { level: 2, text: 'Раздел 2', id: 'a--раздел-2' },
        ],
      },
    ])
    expect(toc.chapters).toHaveLength(1)
    const root = toc.chapters[0]
    expect(root.id).toBe('a')
    expect(root.children.map((c) => c.text)).toEqual(['Раздел', 'Раздел 2'])
    expect(root.children[0].children.map((c) => c.text)).toEqual(['Подраздел'])
    // H1 главы отображается на узел главы, родители — для автораскрытия
    expect(toc.nodeByHeading.get('a--глава-а')).toBe('a')
    expect(toc.parentOf.get('a--подраздел')).toBe('a--раздел')
    expect(toc.parentOf.get('a--раздел')).toBe('a')
  })

  it('глава без H1 — все заголовки становятся детьми корня', () => {
    const toc = buildManualToc([
      {
        slug: 'b',
        title: 'Глава Б',
        headings: [{ level: 2, text: 'Раздел', id: 'b--раздел' }],
      },
    ])
    expect(toc.chapters[0].children.map((c) => c.id)).toEqual(['b--раздел'])
  })

  it('пустой список глав — пустое оглавление', () => {
    const toc = buildManualToc([])
    expect(toc.chapters).toEqual([])
    expect(toc.parentOf.size).toBe(0)
  })
})
