import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { chapterStemParts, plainInline } from '../utils/markdown'
import { getManualChapters, MANUAL_CHAPTERS, MANUAL_CHAPTER_SLUGS, manualImageSrc } from './manual'

// Ожидания НЕ хардкодятся: docs/manual/{ru,en} владеет команда редакторов
// документации, новые главы и кадры не должны ломать тесты кодовой стороны.
// Каталог читается двумя независимыми путями — vite glob (manual.ts) и node fs
// (здесь), — и тест сверяет их между собой: это и есть контракт «каталог верно
// отражает папку».
const RU_DIR = fileURLToPath(new URL('../../docs/manual/ru/', import.meta.url))
const EN_DIR = fileURLToPath(new URL('../../docs/manual/en/', import.meta.url))
const RU_IMAGES_DIR = join(RU_DIR, 'images')
const EN_IMAGES_DIR = join(EN_DIR, 'images')

type ExpectedChapter = { slug: string; title: string; source: string }

/** Каталог, выведенный из файловой системы (порядок и слаги — по именам файлов). */
function expectedChapters(dir: string): ExpectedChapter[] {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => {
      const { order, slug } = chapterStemParts(e.name.replace(/\.md$/, ''))
      const source = readFileSync(join(dir, e.name), 'utf8').replace(/\r\n?/g, '\n')
      return { order, slug, source }
    })
  // То же правило порядка, что в manual.ts: нумерованные — по номеру, прочие в конец
  entries.sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
      a.slug.localeCompare(b.slug),
  )
  const seen = new Set<string>()
  const chapters: ExpectedChapter[] = []
  for (const e of entries) {
    if (seen.has(e.slug)) continue
    seen.add(e.slug)
    const h1 = e.source.match(/^#\s+(.+?)\s*$/m)
    chapters.push({ slug: e.slug, title: h1 ? plainInline(h1[1]) : e.slug, source: e.source })
  }
  return chapters
}

const normalize = (c: { slug: string; title: string; source: string }) => ({
  slug: c.slug,
  title: c.title,
  source: c.source.replace(/\r\n?/g, '\n'),
})

describe('каталог глав мануала (ru — источник истины)', () => {
  it('каталог совпадает с файлами docs/manual/ru: порядок из префикса NN, slug без номера', () => {
    expect(MANUAL_CHAPTERS.map(normalize)).toEqual(expectedChapters(RU_DIR))
  })

  it('у каждой главы есть H1 в исходнике (иначе title падал бы в slug)', () => {
    expect(MANUAL_CHAPTERS.length).toBeGreaterThan(0)
    for (const ch of MANUAL_CHAPTERS) expect(ch.title).not.toBe(ch.slug)
  })

  it('множество slug синхронно со списком глав', () => {
    for (const ch of MANUAL_CHAPTERS) expect(MANUAL_CHAPTER_SLUGS.has(ch.slug)).toBe(true)
    expect(MANUAL_CHAPTER_SLUGS.size).toBe(MANUAL_CHAPTERS.length)
  })

  it('кадры на диске резолвятся в URL, отсутствующие — null (плейсхолдер)', () => {
    expect(manualImageSrc('images/__definitely_missing__.png', 'ru')).toBeNull()
    if (existsSync(RU_IMAGES_DIR)) {
      for (const e of readdirSync(RU_IMAGES_DIR, { withFileTypes: true })) {
        if (!e.isFile()) continue
        expect(manualImageSrc(`images/${e.name}`, 'ru')).toBeTruthy()
      }
    }
  })

  it('resolver изображений принимает путь с ./ и без', () => {
    expect(manualImageSrc('./images/__definitely_missing__.png', 'ru')).toBeNull()
  })
})

describe('каталог глав мануала (en — зеркало)', () => {
  it('en-каталог совпадает с файлами docs/manual/en плюс ru-фолбэк недостающих глав', () => {
    const en = expectedChapters(EN_DIR)
    const enSlugs = new Set(en.map((c) => c.slug))
    // Глава, существующая только в ru (перевод ещё не готов), подставляется
    // ru-версией на её каноническом месте; порядок en-каталога — ru-порядок.
    const expected = MANUAL_CHAPTERS.map((ru) => ({
      ...(enSlugs.has(ru.slug) ? en.find((c) => c.slug === ru.slug)! : ru),
    }))
    // en-only главы (зеркало их не порождает) добираются в конец
    for (const c of en) if (!MANUAL_CHAPTER_SLUGS.has(c.slug)) expected.push(c)
    expect(getManualChapters('en').map(normalize)).toEqual(expected)
  })

  it('у каждой en-главы есть H1 в исходнике', () => {
    for (const ch of getManualChapters('en')) expect(ch.title).not.toBe(ch.slug)
  })

  it('en-кадры резолвятся в en-папке, отсутствующие — null', () => {
    expect(manualImageSrc('images/__definitely_missing__.png', 'en')).toBeNull()
    if (existsSync(EN_IMAGES_DIR)) {
      for (const e of readdirSync(EN_IMAGES_DIR, { withFileTypes: true })) {
        if (!e.isFile()) continue
        expect(manualImageSrc(`images/${e.name}`, 'en')).toBeTruthy()
      }
    }
  })

  it('неподдерживаемая локаль падает в ru-каталог', () => {
    expect(getManualChapters('fr')).toEqual(MANUAL_CHAPTERS)
    expect(getManualChapters('')).toEqual(MANUAL_CHAPTERS)
  })
})
