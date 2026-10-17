/**
 * Минимальный рендерер стандартного markdown для мануала редактора.
 *
 * Поддерживаемое подмножество — по внутреннему стилевому стандарту мануала:
 * заголовки ATX (H1–H4), абзацы, списки (вложенные, нумерованные),
 * таблицы, fenced-код-блоки, blockquote, hr, ссылки, изображения,
 * `код`, **жирный**, *курсив*. HTML-вставки и экзотические расширения
 * не поддерживаются: любой текст источника экранируется, поэтому
 * результат безопасно вставлять через dangerouslySetInnerHTML.
 *
 * Чистая функция: без React, без DOM, без side-эффектов (конвенция utils/).
 * UI-строки (подписи заглушек) передаются снаружи через options.
 *
 * Id заголовков — GitHub-совместимые слаги (кириллица сохраняется),
 * при указании chapterSlug — с префиксом `<slug>--`, что даёт уникальные
 * якоря в ленте из всех глав и цель для ссылок вида `glava.md#якорь`.
 */

export type MarkdownHeading = {
  /** Уровень заголовка (1–6) */
  level: number
  /** Текст заголовка без разметки (для оглавления) */
  text: string
  /** Полное имя якоря (с префиксом главы, если задан) */
  id: string
}

export type RenderedMarkdown = {
  html: string
  headings: MarkdownHeading[]
  /**
   * Поисковый индекс: id якоря заголовка → plain-текст раздела (сам заголовок +
   * контент до следующего заголовка). Используется поиском по мануалу
   * (`utils/manualSearch.ts`); разметка stripping'уется, код/таблицы включаются.
   */
  sectionText: Record<string, string>
}

export type MarkdownRenderOptions = {
  /** Slug текущей главы: префикс якорей и цель ссылок `#якорь` */
  chapterSlug?: string
  /** Существующие главы: ссылки на отсутствующие `.md` помечаются is-missing */
  knownChapters?: ReadonlySet<string>
  /** Резолвер пути изображения (`images/….png`) в URL; null — файла нет */
  resolveImage?: (src: string) => string | null
  /** Подпись заглушки отсутствующего изображения (UI-строка) */
  imageMissingLabel?: string
  /** title найденного изображения — подсказка «открыть на всё окно» (UI-строка) */
  imageZoomTitle?: string
  /** title ссылки на ненаписанную главу (UI-строка) */
  linkMissingTitle?: string
}

/** Разделитель между slug главы и якорем заголовка. */
const HEADING_ID_SEP = '--'

/**
 * Имя файла главы `NN-<slug>.md` → номер и slug.
 * Номер (`NN-`) задаёт только порядок глав в мануале; slug — стабильный
 * идентификатор без номера: на него ссылаются другие главы (`slug.md#якорь`)
 * и по нему называются скриншоты (`images/<slug>-NN.png`), поэтому
 * перенумерация файлов ссылки и картинки не ломает.
 */
export function chapterStemParts(stem: string): { order: number | null; slug: string } {
  const m = stem.match(/^(\d{1,9})-(.+)$/)
  return m ? { order: parseInt(m[1], 10), slug: m[2] } : { order: null, slug: stem }
}

const LIST_RE = /^( {0,3})([-*+]|\d{1,9}[.)])(\s+)(.*)$/
const HEADING_RE = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const HR_RE = /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})\s*(\S*)\s*$/
const QUOTE_RE = /^ {0,3}> ?(.*)$/

/**
 * Инлайн-токены: код-спаны, изображения, ссылки, **жирный**, *курсив*.
 * Подчёркивание выделением не считается — sid вида `zone_layout_default`
 * встречаются в тексте без кодовых кавычек и должны оставаться дословными.
 */
const INLINE_RE =
  /(`+)([\s\S]+?)\1|!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\)|\[([^\]]*)\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\)|\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*/g

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Текст инлайн-фрагмента без символов разметки (для оглавления и title). */
export function plainInline(src: string): string {
  return src
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/\*([\s\S]+?)\*/g, '$1')
    .trim()
}

/** GitHub-слаг: строчные, буквы/цифры (включая кириллицу) сохраняются, пробелы → дефис. */
export function slugify(text: string): string {
  const base = plainInline(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
  return base || 'section'
}

type Ctx = {
  opts: MarkdownRenderOptions
  headings: MarkdownHeading[]
  usedIds: Map<string, number>
  /** id заголовка → кусочки plain-текста раздела (для поискового индекса) */
  sectionText: Map<string, string[]>
  /** id текущего раздела (последний отрисованный заголовок) */
  currentSectionId: string | null
}

/** Дописать plain-текст в текущий раздел поискового индекса. */
function appendSectionText(ctx: Ctx, text: string): void {
  if (ctx.currentSectionId === null) return
  const t = text.trim()
  if (!t) return
  ctx.sectionText.get(ctx.currentSectionId)?.push(t)
}

type ParsedHref =
  | { kind: 'external'; href: string }
  | { kind: 'chapter'; slug: string; anchor: string | null; missing: boolean }
  | { kind: 'anchor'; anchor: string }
  | { kind: 'other'; href: string }

function parseHref(href: string, opts: MarkdownRenderOptions): ParsedHref {
  if (/^(https?:|mailto:)/i.test(href)) return { kind: 'external', href }
  if (href.startsWith('#')) return { kind: 'anchor', anchor: href.slice(1) }
  const m = href.match(/^(?:\.\/)?([^/#]+)\.md(?:#(.+))?$/)
  if (m) {
    // Ссылка может быть как на `slug.md`, так и на полное имя файла
    // `NN-slug.md` — номер срезаем, идентификатор главы один и тот же.
    const slug = chapterStemParts(m[1]).slug
    return {
      kind: 'chapter',
      slug,
      anchor: m[2] ?? null,
      missing: opts.knownChapters ? !opts.knownChapters.has(slug) : false,
    }
  }
  return { kind: 'other', href }
}

function renderImage(alt: string, src: string, ctx: Ctx): string {
  const url = ctx.opts.resolveImage ? ctx.opts.resolveImage(src) : null
  if (url) {
    const title = ctx.opts.imageZoomTitle ? ` title="${escapeHtml(ctx.opts.imageZoomTitle)}"` : ''
    // Без loading="lazy": ленивая догрузка картинок по пути smooth-скролла меняет
    // высоту ленты и цель уезжает вниз — скролл к главе «не доезжает». Кадры мануала
    // в релизе и так data-URI в памяти, в dev — локальные файлы: грузим сразу,
    // лэйаут стабилизируется до первого клика по оглавлению.
    return `<img class="md-img" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${title}>`
  }
  const note = ctx.opts.imageMissingLabel
    ? `<span class="md-img-missing__note">${escapeHtml(ctx.opts.imageMissingLabel)}</span>`
    : ''
  return (
    `<span class="md-img-missing" role="img" aria-label="${escapeHtml(alt)}">` +
    `<span class="md-img-missing__icon" aria-hidden="true">🖼</span>` +
    `<span class="md-img-missing__alt">${escapeHtml(alt)}</span>${note}</span>`
  )
}

function renderLink(textHtml: string, href: string, ctx: Ctx): string {
  const parsed = parseHref(href, ctx.opts)
  switch (parsed.kind) {
    case 'external':
      return `<a href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer">${textHtml}</a>`
    case 'chapter': {
      if (parsed.missing) {
        const title = ctx.opts.linkMissingTitle ? ` title="${escapeHtml(ctx.opts.linkMissingTitle)}"` : ''
        return `<a class="is-missing" href="#" data-chapter="${escapeHtml(parsed.slug)}"${title}>${textHtml}</a>`
      }
      const target = parsed.anchor ? `${parsed.slug}${HEADING_ID_SEP}${parsed.anchor}` : parsed.slug
      const anchorAttr = parsed.anchor ? ` data-anchor="${escapeHtml(parsed.anchor)}"` : ''
      return `<a href="#${escapeHtml(target)}" data-chapter="${escapeHtml(parsed.slug)}"${anchorAttr}>${textHtml}</a>`
    }
    case 'anchor': {
      const slug = ctx.opts.chapterSlug
      const target = slug ? `${slug}${HEADING_ID_SEP}${parsed.anchor}` : parsed.anchor
      return `<a href="#${escapeHtml(target)}"${slug ? ` data-chapter="${escapeHtml(slug)}"` : ''} data-anchor="${escapeHtml(parsed.anchor)}">${textHtml}</a>`
    }
    case 'other':
      return `<a href="${escapeHtml(parsed.href)}">${textHtml}</a>`
  }
}

function renderInline(src: string, ctx: Ctx): string {
  let out = ''
  let last = 0
  for (const m of src.matchAll(INLINE_RE)) {
    const index = m.index ?? 0
    out += escapeHtml(src.slice(last, index))
    if (m[1] !== undefined) {
      out += `<code>${escapeHtml(m[2])}</code>`
    } else if (m[3] !== undefined) {
      out += renderImage(m[3], m[4], ctx)
    } else if (m[5] !== undefined) {
      out += renderLink(renderInline(m[5], ctx), m[6], ctx)
    } else if (m[7] !== undefined) {
      out += `<strong>${renderInline(m[7], ctx)}</strong>`
    } else if (m[8] !== undefined) {
      out += `<em>${renderInline(m[8], ctx)}</em>`
    }
    last = index + m[0].length
  }
  out += escapeHtml(src.slice(last))
  return out
}

function uniqueId(slug: string, used: Map<string, number>): string {
  const n = used.get(slug) ?? 0
  used.set(slug, n + 1)
  return n === 0 ? slug : `${slug}-${n}`
}

function renderHeading(level: number, text: string, ctx: Ctx): string {
  const localId = uniqueId(slugify(text), ctx.usedIds)
  const id = ctx.opts.chapterSlug ? `${ctx.opts.chapterSlug}${HEADING_ID_SEP}${localId}` : localId
  const plain = plainInline(text)
  ctx.headings.push({ level, text: plain, id })
  // Новый раздел: переключаем текущий id и сеем индекс текстом заголовка
  ctx.currentSectionId = id
  ctx.sectionText.set(id, [plain])
  // Якорь «#» слева от текста — ссылка на собственный id: клик записывает адрес
  // раздела в хеш URL и скроллит (делегирование в ManualDialog.onViewClick).
  // aria-hidden + tabindex="-1" (приём GitHub): скринридеры и клавиатура
  // пропускают якорь, доступное имя заголовка остаётся чистым.
  return `<h${level} id="${escapeHtml(id)}" class="md-h" data-md-h="${level}"><a class="md-h-anchor" href="#${escapeHtml(id)}" aria-hidden="true" tabindex="-1">#</a>${renderInline(text, ctx)}</h${level}>`
}

function isBlockStarter(line: string): boolean {
  return (
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    FENCE_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_RE.test(line)
  )
}

function isTableSeparator(line: string | undefined): boolean {
  if (line === undefined) return false
  const s = line.trim()
  return s.includes('|') && s.includes('-') && /^[\s|:-]+$/.test(s)
}

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'))
}

function parseTable(lines: string[], i: number, ctx: Ctx): [string, number] {
  const header = splitRow(lines[i])
  const aligns = splitRow(lines[i + 1]).map((c) => {
    const left = c.startsWith(':')
    const right = c.endsWith(':')
    if (left && right) return 'center'
    if (right) return 'right'
    if (left) return 'left'
    return null
  })
  const alignAttr = (idx: number): string =>
    aligns[idx] ? ` style="text-align:${aligns[idx]}"` : ''
  const rows: string[][] = []
  let j = i + 2
  while (j < lines.length && lines[j].trim() !== '' && lines[j].includes('|')) {
    rows.push(splitRow(lines[j]))
    j++
  }
  const head = `<tr>${header.map((c, idx) => `<th${alignAttr(idx)}>${renderInline(c, ctx)}</th>`).join('')}</tr>`
  const body = rows
    .map((r) => `<tr>${r.map((c, idx) => `<td${alignAttr(idx)}>${renderInline(c, ctx)}</td>`).join('')}</tr>`)
    .join('')
  const tableText = [header, ...rows].map((cells) => cells.map((c) => plainInline(c)).join(' ')).join(' ')
  appendSectionText(ctx, tableText)
  return [`<table class="md-table"><thead>${head}</thead>${body ? `<tbody>${body}</tbody>` : ''}</table>`, j]
}

/**
 * Разбор списка: элементы одного уровня; вложенные списки и продолжения
 * абзацев попадают в контент элемента (рекурсивный renderBlocks).
 * Поддерживает «ленивые» продолжения без отступа, как в CommonMark.
 */
function parseList(lines: string[], start: number, ctx: Ctx): [string, number] {
  const first = lines[start].match(LIST_RE)
  if (!first) return ['', start + 1]
  const baseIndent = first[1].length
  const ordered = /\d/.test(first[2])
  const startNum = ordered ? parseInt(first[2], 10) : 1

  const items: string[][] = [[first[4]]]
  let itemIndent = baseIndent + first[2].length + first[3].length
  let i = start + 1
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      // Пустая строка принадлежит списку, если дальше — элемент того же
      // списка или продолжение контента текущего элемента.
      let j = i + 1
      while (j < lines.length && lines[j].trim() === '') j++
      const next = j < lines.length ? lines[j] : undefined
      if (next !== undefined) {
        const nm = next.match(LIST_RE)
        const nextIndent = next.length - next.trimStart().length
        const sameList = nm !== null && nm[1].length <= baseIndent && /\d/.test(nm[2]) === ordered
        if (sameList || nextIndent >= itemIndent) {
          const current = items[items.length - 1]
          for (let k = i; k < j; k++) current.push('')
          i = j
          continue
        }
      }
      break
    }
    const m = line.match(LIST_RE)
    const ind = line.length - line.trimStart().length
    if (m && ind < itemIndent) {
      if (ind <= baseIndent && /\d/.test(m[2]) === ordered) {
        items.push([m[4]])
        itemIndent = ind + m[2].length + m[3].length
        i++
        continue
      }
      break // чужой список (другой вид или более глубокий) — конец этого
    }
    const current = items[items.length - 1]
    if (ind >= itemIndent) {
      current.push(line.slice(itemIndent))
      i++
      continue
    }
    if (!isBlockStarter(line)) {
      current.push(line.trim()) // ленивое продолжение абзаца элемента
      i++
      continue
    }
    break
  }

  const tag = ordered ? 'ol' : 'ul'
  const startAttr = ordered && startNum !== 1 ? ` start="${startNum}"` : ''
  const body = items
    .map((itemLines) => {
      const blocks = renderBlocks(itemLines, ctx)
      // Компактный элемент из одного абзаца — без обёртки <p>
      if (blocks.length === 1) {
        const single = blocks[0].match(/^<p>([\s\S]*)<\/p>$/)
        if (single) return `<li>${single[1]}</li>`
      }
      return `<li>${blocks.join('\n')}</li>`
    })
    .join('')
  return [`<${tag}${startAttr}>${body}</${tag}>`, i]
}

function parseQuote(lines: string[], start: number, ctx: Ctx): [string, number] {
  const inner: string[] = []
  let i = start
  while (i < lines.length) {
    const m = lines[i].match(QUOTE_RE)
    if (!m) break
    inner.push(m[1])
    i++
  }
  return [`<blockquote class="md-quote">${renderBlocks(inner, ctx).join('\n')}</blockquote>`, i]
}

function renderBlocks(lines: string[], ctx: Ctx): string[] {
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
      continue
    }
    const fence = line.match(FENCE_RE)
    if (fence) {
      const char = fence[1][0]
      const minLen = fence[1].length
      const lang = fence[2]
      const body: string[] = []
      i++
      while (i < lines.length) {
        const close = lines[i].match(/^ {0,3}(`{3,}|~{3,})\s*$/)
        if (close && close[1][0] === char && close[1].length >= minLen) {
          i++
          break
        }
        body.push(lines[i])
        i++
      }
      const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : ''
      appendSectionText(ctx, body.join('\n'))
      out.push(`<pre class="md-pre"><code${langAttr}>${escapeHtml(body.join('\n'))}</code></pre>`)
      continue
    }
    const heading = line.match(HEADING_RE)
    if (heading) {
      out.push(renderHeading(heading[1].length, heading[2], ctx))
      i++
      continue
    }
    if (HR_RE.test(line)) {
      out.push('<hr>')
      i++
      continue
    }
    if (QUOTE_RE.test(line)) {
      const [html, next] = parseQuote(lines, i, ctx)
      out.push(html)
      i = next
      continue
    }
    if (line.includes('|') && isTableSeparator(lines[i + 1])) {
      const [html, next] = parseTable(lines, i, ctx)
      out.push(html)
      i = next
      continue
    }
    if (LIST_RE.test(line)) {
      const [html, next] = parseList(lines, i, ctx)
      out.push(html)
      i = next
      continue
    }
    // Абзац: до пустой строки или начала другого блока
    const para: string[] = []
    while (i < lines.length) {
      const l = lines[i]
      if (l.trim() === '') break
      if (para.length > 0 && isBlockStarter(l)) break
      if (para.length > 0 && l.includes('|') && isTableSeparator(lines[i + 1])) break
      para.push(l)
      i++
    }
    const paraText = para.join('\n')
    appendSectionText(ctx, plainInline(paraText))
    out.push(`<p>${renderInline(paraText, ctx)}</p>`)
  }
  return out
}

/** Рендер главы мануала: HTML + плоский список заголовков (для оглавления). */
export function renderMarkdown(src: string, opts: MarkdownRenderOptions = {}): RenderedMarkdown {
  const ctx: Ctx = { opts, headings: [], usedIds: new Map(), sectionText: new Map(), currentSectionId: null }
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const html = renderBlocks(lines, ctx).join('\n')
  const sectionText: Record<string, string> = {}
  for (const [id, pieces] of ctx.sectionText) sectionText[id] = pieces.join(' ')
  return { html, headings: ctx.headings, sectionText }
}
