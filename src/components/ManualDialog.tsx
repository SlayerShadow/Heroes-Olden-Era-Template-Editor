/**
 * Мануал редактора — полноэкранная плашка поверх окна редактора.
 *
 * Слева — навигатор: главы и заголовки всех уровней вложенности
 * (раскрывающиеся списки), активный раздел подсвечивается при прокрутке
 * (минимальный подскролл — панель не дёргается), а раздел, открытый кликом,
 * дополнительно раскрывается на один уровень и центрируется в панели
 * (у края списка центрирование нативно клампится — см. navPendingRef).
 * Там же — поиск: с `MIN_SEARCH_LEN` символов оглавление фильтруется
 * (заголовок или текст раздела; `utils/manualSearch.ts`), найденное в
 * заголовках подсвечивается `<mark>`, в тексте справа — CSS Custom
 * Highlight API (`::highlight(manual-search)`); лента справа не фильтруется.
 * Справа — просмотрщик: все главы единой лентой (как h3hota.com/ru/templates);
 * клик по элементу навигатора или по ссылке `.md` в тексте плавно скроллит
 * к разделу, клик по скриншоту открывает его на всё окно (ImageLightbox).
 * Закрытие — крестиком или Esc (если открыт лайтбокс, Esc гасит сначала его).
 *
 * У каждого заголовка слева есть якорь «#» (`a.md-h-anchor` из utils/markdown):
 * клик по нему, по оглавлению или по ссылке в тексте дополнительно записывает
 * адрес раздела в хеш URL (без записей в истории). Хеш принадлежит мануалу:
 * открытие приложения с `#якорь` в URL стартует с открытого мануала, мгновенно
 * подскролленного к разделу (deep link); закрытие мануала стирает хеш.
 * Механика хеша (replaceState + фолбэк для file://) — `utils/manualHash.ts`.
 *
 * Контент глав — `src/data/manual.ts` (инлайнится в бандл на сборке,
 * в single-file release работает без сервера), рендер — `utils/markdown.ts`,
 * оглавление — `utils/manualToc.ts`. Главы и кадры берутся из папки активной
 * локали интерфейса (ru/en, недостающие главы — фолбэк ru); переключение
 * локали подменяет контент и сбрасывает навигатор на первую главу (якоря
 * заголовков производны от их текста). Монтируется только в открытом виде
 * (App рендерит его условно) — состояние оглавления сбрасывается при закрытии.
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronRight, Search, X } from 'lucide-react'
import { getManualChapters, getManualChapterSlugs, manualImageSrc } from '../data/manual'
import { renderMarkdown } from '../utils/markdown'
import { buildManualToc, type ManualTocNode } from '../utils/manualToc'
import { clearManualAnchor, readManualAnchor, writeManualAnchor } from '../utils/manualHash'
import {
  buildNodeTextIndex,
  filterManualToc,
  highlightSegments,
  MIN_SEARCH_LEN,
} from '../utils/manualSearch'
import { ImageLightbox, type LightboxImage } from './ImageLightbox'

/** Сколько пикселей от верха просмотрщика считается «активным» заголовком. */
const SPY_OFFSET = 96

/** Лимит ожидания догрузки скриншотов перед корректирующим скроллом deep-link. */
const IMAGE_SETTLE_MS = 2000

/** Имя регистра CSS Custom Highlight API для подсветки найденного в тексте. */
const HIGHLIGHT_NAME = 'manual-search'

export function ManualDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  // Контент мануала следует за локалью интерфейса (ru/en): react-i18next
  // перерисовывает диалог по languageChanged, главы и кадры берутся из папки
  // активной локали (src/data/manual.ts, недостающие главы — фолбэк ru).
  const locale = i18n.language
  const chapters = useMemo(() => getManualChapters(locale), [locale])
  const chapterSlugs = useMemo(() => getManualChapterSlugs(locale), [locale])
  const viewRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const headingElsRef = useRef<HTMLElement[]>([])
  /** Цель последнего клик-перехода (оглавление, «#»-якорь, ссылка, deep link):
   *  её строка в навигаторе центрируется, а не прижимается к краю. Держится до
   *  scrollend: плавный скролл по пути переключает активный пункт (scroll-spy),
   *  и преждевременный сброс вернул бы краевое выравнивание. Перехват прокрутки
   *  пользователем (колесо/тач) отменяет центрирование — не воюем с человеком. */
  const navPendingRef = useRef<string | null>(null)

  const rendered = useMemo(
    () =>
      chapters.map((ch) => {
        const r = renderMarkdown(ch.source, {
          chapterSlug: ch.slug,
          knownChapters: chapterSlugs,
          resolveImage: (src) => manualImageSrc(src, locale),
          imageMissingLabel: t('manual.imageMissing'),
          imageZoomTitle: t('manual.imageZoomTitle'),
          linkMissingTitle: t('manual.chapterMissingTitle'),
        })
        return { slug: ch.slug, title: ch.title, html: r.html, headings: r.headings, sectionText: r.sectionText }
      }),
    [t, chapters, chapterSlugs, locale],
  )

  const toc = useMemo(() => buildManualToc(rendered), [rendered])

  // Поиск по мануалу: ввод в локальном state (поле никогда не блокируется),
  // фильтрация и подсветка — по отложенному значению (useDeferredValue).
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const isSearching = deferredQuery.trim().length >= MIN_SEARCH_LEN

  /** id узла оглавления → plain-текст раздела (поисковый индекс, один раз). */
  const nodeText = useMemo(
    () => buildNodeTextIndex(rendered.map((r) => r.sectionText), toc.nodeByHeading),
    [rendered, toc],
  )

  const filteredChapters = useMemo(
    () => filterManualToc(toc.chapters, nodeText, deferredQuery),
    [toc, nodeText, deferredQuery],
  )

  // Старт с первой главы (монтирование = открытие: см. условный рендер в App)
  const firstId = toc.chapters[0]?.id ?? null
  const [activeId, setActiveId] = useState<string | null>(firstId)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(firstId ? [firstId] : []))
  // Скриншот, открытый на всё окно (null — просмотр закрыт)
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null)

  // Смена локали интерфейса подменяет контент мануала: якоря заголовков
  // производны от их текста и в другой локали другие. Сброс навигатора на
  // первую главу нового оглавления — правкой состояния прямо в рендере
  // (паттерн React «adjusting state when props change», без каскадного эффекта).
  const [navLocale, setNavLocale] = useState(locale)
  if (navLocale !== locale) {
    setNavLocale(locale)
    const first = toc.chapters[0]?.id ?? null
    setActiveId(first)
    setExpanded(new Set(first ? [first] : []))
  }

  // Прокрутка и цель клик-перехода обнуляются эффектом (синхронизация с DOM);
  // старый хеш URL перезапишет следующий клик-переход.
  useEffect(() => {
    navPendingRef.current = null
    viewRef.current?.scrollTo({ top: 0 })
  }, [locale])

  /** Закрытие мануала стирает хеш URL: хеш принадлежит мануалу (utils/manualHash). */
  const handleClose = useCallback(() => {
    clearManualAnchor()
    onClose()
  }, [onClose])

  /** Раскрыть узел в оглавлении: всегда — предков; при includeSelf ещё и сам
   *  узел (клик по разделу показывает его следующий уровень заголовков, +1).
   *  Scroll-spy раскрывает только предков — иначе оглавление росло бы само
   *  при каждой прокрутке ленты. */
  const expandTo = useCallback((nodeId: string | null, includeSelf: boolean) => {
    if (!nodeId) return
    setExpanded((prev) => {
      let changed = false
      const next = new Set(prev)
      if (includeSelf && !next.has(nodeId)) {
        next.add(nodeId)
        changed = true
      }
      let p = toc.parentOf.get(nodeId)
      while (p !== undefined) {
        if (!next.has(p)) {
          next.add(p)
          changed = true
        }
        p = toc.parentOf.get(p)
      }
      return changed ? next : prev
    })
  }, [toc])

  // Esc — закрыть: сначала картинку на весь экран, затем сам мануал
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (lightbox !== null) setLightbox(null)
      else handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleClose, lightbox])

  // Scroll-spy: последний заголовок, прошедший верхнюю границу просмотрщика
  useEffect(() => {
    if (!open) return
    const v = viewRef.current
    if (!v) return
    headingElsRef.current = Array.from(v.querySelectorAll<HTMLElement>('[data-md-h]'))
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const line = v.getBoundingClientRect().top + SPY_OFFSET
        let current: string | null = null
        for (const el of headingElsRef.current) {
          if (el.getBoundingClientRect().top <= line) current = el.id
          else break
        }
        const nodeId = current ? (toc.nodeByHeading.get(current) ?? current) : (toc.chapters[0]?.id ?? null)
        setActiveId((prev) => (prev === nodeId ? prev : nodeId))
        expandTo(nodeId, false)
      })
    }
    v.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      v.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [open, toc, expandTo])

  // Активный пункт навигатора держать в зоне видимости: обычный подскролл —
  // минимальный (block:'nearest' — scroll-spy не дёргает панель при чтении),
  // а цель клик-перехода (navPendingRef) центрируется (block:'center').
  // У края списка scrollIntoView нативно клампится — раздел в самом конце
  // оглавления просто докрутит панель максимально вниз. Флаг здесь НЕ
  // сбрасывается: плавный скролл ещё идёт, spy может увести activeId на
  // промежуточные заголовки и вернуть обратно — финальное центрирование
  // обязано состояться, а снимает флаг scrollend-эффект ниже.
  useEffect(() => {
    if (!open || !activeId) return
    const row = navRef.current?.querySelector('.is-active')
    if (!row) return
    row.scrollIntoView(navPendingRef.current === activeId ? { block: 'center' } : { block: 'nearest' })
  }, [open, activeId, expanded])

  // Финал прокрутки после клик-перехода: короткая цель в самом конце документа
  // может не стать «активной» (просмотрщик упёрся в низ, scroll-spy остался на
  // предыдущем заголовке) — тогда центрируем её строку по data-node-id здесь.
  // Колесо/тач — прокрутку перехватил пользователь, отменяем центрирование
  // без рывка панели.
  useEffect(() => {
    if (!open) return
    const v = viewRef.current
    if (!v) return
    const onScrollEnd = () => {
      const id = navPendingRef.current
      navPendingRef.current = null
      if (id === null) return
      navRef.current
        ?.querySelector<HTMLElement>(`.manual__toc-row[data-node-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: 'center' })
    }
    const abandon = () => {
      navPendingRef.current = null
    }
    v.addEventListener('scrollend', onScrollEnd)
    v.addEventListener('wheel', abandon, { passive: true })
    v.addEventListener('touchstart', abandon, { passive: true })
    return () => {
      v.removeEventListener('scrollend', onScrollEnd)
      v.removeEventListener('wheel', abandon)
      v.removeEventListener('touchstart', abandon)
    }
  }, [open])

  // Deep link: приложение открыли с #якорь в URL (App читает хеш при старте)
  // или хеш сменили извне при открытом мануале (вставка в адресную строку,
  // hashchange). Скроллим к цели МГНОВЕННО (без анимации: стартуем с верха
  // документа) и не пишем URL — хеш уже содержит этот якорь. Битая/устаревшая
  // ссылка — остаёмся наверху. На dev-сервере скриншоты грузятся из файлов
  // асинхронно и лэйаут может уехать — по догрузке один раз корректируем
  // скролл (в релизе картинки — data URI, коррекция это no-op-страховка).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const jumpTo = (id: string) => {
      const v = viewRef.current
      const el = v?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
      if (!v || !el) return
      el.scrollIntoView({ block: 'start' })
      navPendingRef.current = id
      setActiveId(id)
      expandTo(id, true)
      const pending = Array.from(v.querySelectorAll<HTMLImageElement>('img.md-img')).filter(
        (img) => !img.complete,
      )
      if (pending.length === 0) return
      const loaded = pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          }),
      )
      const settleTimeout = new Promise<void>((resolve) => {
        window.setTimeout(resolve, IMAGE_SETTLE_MS)
      })
      void Promise.race([Promise.all(loaded), settleTimeout]).then(() => {
        if (cancelled) return
        v.querySelector<HTMLElement>(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'start' })
      })
    }
    const initial = readManualAnchor()
    if (initial !== null) jumpTo(initial)
    const onHashChange = () => {
      const id = readManualAnchor()
      if (id !== null) jumpTo(id)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => {
      cancelled = true
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [open, expandTo])

  // Подсветка вхождений запроса в тексте документации — CSS Custom Highlight API:
  // Range'ы по текстовым узлам просмотрщика, стиль — `::highlight(manual-search)`.
  // Guard — для окружений без API (jsdom-тесты): эффект молча становится no-op.
  const canHighlight =
    typeof Highlight !== 'undefined' && typeof CSS !== 'undefined' && CSS.highlights !== undefined
  useEffect(() => {
    if (!open) return
    const clear = () => {
      if (canHighlight) CSS.highlights.delete(HIGHLIGHT_NAME)
    }
    clear()
    const q = deferredQuery.trim().toLowerCase()
    if (q.length < MIN_SEARCH_LEN || !canHighlight || !viewRef.current) return clear
    const ranges: Range[] = []
    const walker = document.createTreeWalker(viewRef.current, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement?.tagName
        if (parent === 'SCRIPT' || parent === 'STYLE') return NodeFilter.FILTER_REJECT
        return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      },
    })
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent ?? ''
      const lower = text.toLowerCase()
      let pos = 0
      for (;;) {
        const idx = lower.indexOf(q, pos)
        if (idx === -1) break
        const range = new Range()
        range.setStart(node, idx)
        range.setEnd(node, idx + q.length)
        ranges.push(range)
        pos = idx + q.length
      }
    }
    if (ranges.length > 0) CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges))
    return clear
  }, [open, deferredQuery, canHighlight])

  if (!open) return null

  const scrollToId = (id: string) => {
    // Цель ищем ТОЛЬКО внутри просмотрщика: slug главы становится id секции и
    // может совпасть с id внешнего элемента — глава «root» (11-root.md) и
    // контейнер приложения <div id="root"> в index.html. document.getElementById
    // вернул бы первый по порядку элемент (внешний), и скролл «не работал».
    const el = viewRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    navPendingRef.current = id
    setActiveId(id)
    expandTo(id, true)
  }

  /** Клик-переход к разделу (якорь «#», оглавление, ссылка в тексте):
   *  плавный скролл + запись адреса раздела в хеш URL (без записи в истории). */
  const navigateTo = (id: string) => {
    scrollToId(id)
    writeManualAnchor(id)
  }

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Делегирование кликов в тексте: скриншот — открыть на всё окно,
  // внутренние `.md`/`#якорь` (включая «#»-якорь заголовка a.md-h-anchor) —
  // плавный скролл + хеш в URL, внешние — браузеру (target=_blank)
  const onViewClick = (e: ReactMouseEvent) => {
    const el = e.target as HTMLElement
    const img = el.closest?.('img.md-img')
    if (img) {
      const src = img.getAttribute('src')
      if (src) setLightbox({ src, alt: img.getAttribute('alt') ?? '' })
      return
    }
    const a = el.closest?.('a')
    if (!a) return
    const chapter = a.dataset.chapter
    if (chapter !== undefined) {
      e.preventDefault()
      if (a.classList.contains('is-missing')) return
      const target = a.getAttribute('href')?.slice(1)
      if (target) navigateTo(target)
      return
    }
    const href = a.getAttribute('href')
    if (href?.startsWith('#')) {
      e.preventDefault()
      navigateTo(href.slice(1))
    }
  }

  const renderNode = (node: ManualTocNode, depth: number): ReactNode => {
    const hasChildren = node.children.length > 0
    // При поиске всё отфильтрованное дерево раскрыто — путь к совпадениям виден
    const isOpen = isSearching || expanded.has(node.id)
    return (
      <li key={node.id}>
        <div
          className={`manual__toc-row${activeId === node.id ? ' is-active' : ''}`}
          data-depth={depth}
          data-node-id={node.id}
        >
          {hasChildren ? (
            <button
              type="button"
              className="manual__toc-toggle"
              onClick={() => toggle(node.id)}
              aria-expanded={isOpen}
              title={t('manual.navToggleTitle')}
              aria-label={t('manual.navToggleTitle')}
            >
              <ChevronRight size={12} className={isOpen ? 'is-open' : ''} />
            </button>
          ) : (
            <span className="manual__toc-toggle-spacer" aria-hidden="true" />
          )}
          <button type="button" className="manual__toc-link" onClick={() => navigateTo(node.id)}>
            {isSearching
              ? highlightSegments(node.text, deferredQuery).map((seg, i) =>
                  seg.match ? (
                    <mark key={i} className="manual__toc-mark">
                      {seg.text}
                    </mark>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )
              : node.text}
          </button>
        </div>
        {hasChildren && isOpen && (
          <ul className="manual__toc-sub">{node.children.map((c) => renderNode(c, depth + 1))}</ul>
        )}
      </li>
    )
  }

  return createPortal(
    <div className="manual" role="dialog" aria-modal="true" aria-label={t('manual.title')}>
      <header className="manual__head">
        <span className="manual__title">
          <BookOpen size={14} /> {t('manual.title')}
        </span>
        <span className="manual__hint">{t('manual.hint')}</span>
        <button
          type="button"
          className="icon-btn manual__close"
          onClick={handleClose}
          aria-label={t('manual.close')}
          title={t('manual.closeTitle')}
        >
          <X size={15} />
        </button>
      </header>
      <div className="manual__body">
        <nav className="manual__nav" ref={navRef} aria-label={t('manual.navTitle')}>
          <div className="manual__nav-head">
            <div className="manual__nav-title">{t('manual.navTitle')}</div>
            <div className="manual__search">
              <Search size={13} className="manual__search-icon" aria-hidden="true" />
              <input
                className="input manual__search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('manual.searchPlaceholder')}
                aria-label={t('manual.searchPlaceholder')}
              />
              {query.length > 0 && (
                <button
                  type="button"
                  className="manual__search-clear"
                  onClick={() => setQuery('')}
                  aria-label={t('manual.searchClearTitle')}
                  title={t('manual.searchClearTitle')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          {rendered.length === 0 ? (
            <div className="manual__empty">{t('manual.empty')}</div>
          ) : filteredChapters.length === 0 ? (
            <div className="manual__no-results">{t('manual.noResults')}</div>
          ) : (
            <ul className="manual__toc">{filteredChapters.map((c) => renderNode(c, 0))}</ul>
          )}
        </nav>
        <div className="manual__view" ref={viewRef} onClick={onViewClick}>
          <div className="manual__doc">
            {rendered.map((ch) => (
              <section key={ch.slug} id={ch.slug} className="manual__chapter">
                <div className="md" dangerouslySetInnerHTML={{ __html: ch.html }} />
              </section>
            ))}
          </div>
        </div>
      </div>
      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </div>,
    document.body,
  )
}
