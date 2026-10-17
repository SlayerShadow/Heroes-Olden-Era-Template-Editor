import { describe, expect, it } from 'vitest'
import { anchorFromHash } from './manualHash'

describe('anchorFromHash', () => {
  it('пустой хеш и голый «#» дают null', () => {
    expect(anchorFromHash('')).toBeNull()
    expect(anchorFromHash('#')).toBeNull()
  })

  it('строка без ведущего «#» не трактуется как хеш', () => {
    expect(anchorFromHash('quick-start')).toBeNull()
  })

  it('снимает «#» и возвращает якорь как есть (кириллица)', () => {
    expect(anchorFromHash('#quick-start--установка')).toBe('quick-start--установка')
  })

  it('декодирует percent-encoding (так хеш хранится в URL)', () => {
    const encoded = `#${encodeURIComponent('quick-start--установка')}`
    expect(encoded).not.toContain('установка')
    expect(anchorFromHash(encoded)).toBe('quick-start--установка')
  })

  it('невалидная percent-последовательность возвращается как есть', () => {
    expect(anchorFromHash('#100%')).toBe('100%')
    expect(anchorFromHash('#%zz')).toBe('%zz')
  })
})
