/**
 * Каталог глав мануала редактора (локализованный).
 *
 * Источник истины — файлы `docs/manual/ru/NN-<slug>.md`, где `NN` — порядковый
 * номер главы (задаёт порядок в мануале), а `<slug>` — стабильный идентификатор
 * без номера. Имена файлов не хардкодятся: новая глава — это просто новый
 * `.md`-файл с очередным номером, код трогать не нужно. Главы инлайнятся в
 * бандл на сборке (import.meta.glob + ?raw, eager), поэтому работают и в dev,
 * и в single-file release (`npm run release`) без сервера. Файлы без номера
 * попадают в конец по алфавиту; при коллизии slug выигрывает первый по порядку.
 *
 * Мануал локализован: главы живут в `docs/manual/ru/` (источник истины) и
 * `docs/manual/en/` (зеркало, раскладка 1:1). Каталог строится по локалям
 * (`getManualChapters`); порядок глав канонический ru-порядок. Если в активной
 * локали нет главы, существующей в ru, подставляется ru-версия (новая глава
 * достаётся читателю до готовности перевода). Изображения глав
 * (`docs/manual/<локаль>/images/`) подключаются так же: в release инлайнятся
 * data URI (vite-plugin-singlefile); резолв кадра — в папке активной локали
 * с фолбэком на ru. Новая локаль мануала = новая пара glob ниже.
 */
import { chapterStemParts, plainInline } from '../utils/markdown'

/** Локали мануала: ru — источник истины, en — зеркало. */
export type ManualLocale = 'ru' | 'en'

const mdModules: Record<ManualLocale, Record<string, string>> = {
  ru: import.meta.glob('../../docs/manual/ru/*.md', { query: '?raw', import: 'default', eager: true }),
  en: import.meta.glob('../../docs/manual/en/*.md', { query: '?raw', import: 'default', eager: true }),
}

const imageModules: Record<ManualLocale, Record<string, string>> = {
  ru: import.meta.glob('../../docs/manual/ru/images/*', { query: '?url', import: 'default', eager: true }),
  en: import.meta.glob('../../docs/manual/en/images/*', { query: '?url', import: 'default', eager: true }),
}

export type ManualChapter = {
  /** Имя файла без номера и `.md` — идентификатор главы и id секции в просмотрщике */
  slug: string
  /** Заголовок — первый `# ` в файле (фолбэк — slug) */
  title: string
  /** Исходный markdown */
  source: string
}

function titleOf(source: string, slug: string): string {
  const m = source.match(/^#\s+(.+?)\s*$/m)
  return m ? plainInline(m[1]) : slug
}

function buildChapters(locale: ManualLocale): ManualChapter[] {
  const entries = Object.entries(mdModules[locale]).map(([path, source]) => {
    const stem = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '')
    const { order, slug } = chapterStemParts(stem)
    return { order, slug, source }
  })
  // Нумерованные — по номеру, прочие — в конец по алфавиту
  entries.sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
      a.slug.localeCompare(b.slug),
  )
  const chapters: ManualChapter[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    if (seen.has(e.slug)) continue
    seen.add(e.slug)
    chapters.push({ slug: e.slug, title: titleOf(e.source, e.slug), source: e.source })
  }
  return chapters
}

const ruChapters = buildChapters('ru')

/**
 * Каталог en: зеркальные главы в каноническом ru-порядке; глава, существующая
 * только в ru (перевод ещё не готов), подставляется ru-версией; en-only главы
 * (зеркало их не порождает) добираются в конец.
 */
const enChapters: ManualChapter[] = (() => {
  const enBySlug = new Map(buildChapters('en').map((c) => [c.slug, c]))
  const merged: ManualChapter[] = []
  const seen = new Set<string>()
  for (const ru of ruChapters) {
    merged.push(enBySlug.get(ru.slug) ?? ru)
    seen.add(ru.slug)
  }
  for (const [slug, ch] of enBySlug) {
    if (!seen.has(slug)) merged.push(ch)
  }
  return merged
})()

const chaptersByLocale: Record<ManualLocale, ManualChapter[]> = { ru: ruChapters, en: enChapters }

/** Произвольный код локали интерфейса → локаль мануала (неподдерживаемая → ru). */
export function manualLocaleOf(code: string): ManualLocale {
  return code === 'en' ? 'en' : 'ru'
}

/** Главы мануала активной локали интерфейса (с ru-фолбэком недостающих). */
export function getManualChapters(locale: string): ManualChapter[] {
  return chaptersByLocale[manualLocaleOf(locale)]
}

/** Множество slug глав активной локали (для ссылок между главами). */
export function getManualChapterSlugs(locale: string): ReadonlySet<string> {
  return new Set(getManualChapters(locale).map((c) => c.slug))
}

/** Каталог локали-источника истины (ru): тесты и вне-UI потребители. */
export const MANUAL_CHAPTERS: ManualChapter[] = ruChapters

export const MANUAL_CHAPTER_SLUGS: ReadonlySet<string> = new Set(ruChapters.map((c) => c.slug))

function buildImageMap(locale: ManualLocale): Map<string, string> {
  const map = new Map<string, string>()
  const marker = `/${locale}/`
  for (const [path, url] of Object.entries(imageModules[locale])) {
    const idx = path.lastIndexOf(marker)
    if (idx >= 0) map.set(path.slice(idx + marker.length), url) // 'images/<file>'
  }
  return map
}

const imagesByPath: Record<ManualLocale, Map<string, string>> = {
  ru: buildImageMap('ru'),
  en: buildImageMap('en'),
}

/**
 * Путь изображения из главы (`images/<slug>-NN.png`) → URL или null
 * (плейсхолдер). Кадр ищется в папке активной локали, фолбэк — ru.
 */
export function manualImageSrc(src: string, locale: string): string | null {
  const key = src.replace(/^\.\//, '')
  const loc = manualLocaleOf(locale)
  return imagesByPath[loc].get(key) ?? imagesByPath.ru.get(key) ?? null
}
