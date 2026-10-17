import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import i18n from '../i18n'
import { getManualChapters, MANUAL_CHAPTERS, MANUAL_CHAPTER_SLUGS } from '../data/manual'
import { chapterStemParts, plainInline, slugify } from '../utils/markdown'
import { anchorFromHash } from '../utils/manualHash'
import { ManualDialog } from './ManualDialog'

// Ожидания выводятся из каталога глав и файлов docs/manual/ru, а не хардкодятся:
// команда редакторов документации добавляет главы и кадры без правки кодовой
// стороны. Числа картинок/заглушек и имена ссылок считаются из исходников глав
// и наличия файлов на диске; ветки «ненаписанная глава» и «нет кадров» покрыты
// unit-тестами markdown.test.ts, поэтому здесь при их отсутствии тест пропускается.
// В jsdom-проекте import.meta.url — не file:// (модули идут через vite-сервер),
// поэтому путь берём от process.cwd(): vitest по конвенции стартует из корня репо.
const RU_DIR = join(process.cwd(), 'docs', 'manual', 'ru')

// Инлайн-токены markdown (см. INLINE_RE в utils/markdown): картинка и ссылка на главу
const IMAGE_RE = /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g
const CHAPTER_LINK_RE = /(?<!!)\[([^\]]+)\]\(\s*(?:\.\/)?([^)\s#]+)\.md(?:#([^)\s]+))?(?:\s+"[^"]*")?\s*\)/g

const imageRefs = MANUAL_CHAPTERS.flatMap((ch) =>
  [...ch.source.matchAll(IMAGE_RE)].map((m) => m[1].replace(/^\.\//, '')),
)
const expectedImgs = imageRefs.filter((src) => existsSync(join(RU_DIR, src))).length
const expectedMissing = imageRefs.length - expectedImgs

type ChapterLink = { text: string; slug: string; anchor: string | null }
const chapterLinks: ChapterLink[] = MANUAL_CHAPTERS.flatMap((ch) =>
  [...ch.source.matchAll(CHAPTER_LINK_RE)].map((m) => ({
    text: plainInline(m[1]),
    slug: chapterStemParts(m[2]).slug,
    anchor: m[3] ?? null,
  })),
)
const missingLinks = chapterLinks.filter((l) => !MANUAL_CHAPTER_SLUGS.has(l.slug))
const knownLinks = chapterLinks.filter((l) => MANUAL_CHAPTER_SLUGS.has(l.slug))

// jsdom не реализует scrollIntoView — навигатор и scroll-spy используют его
const scrollIntoViewMock = vi.fn()
beforeEach(() => {
  Element.prototype.scrollIntoView = scrollIntoViewMock
  scrollIntoViewMock.mockClear()
  // Тесты якорей/deep-link работают с хешем URL — сбрасываем его между тестами
  window.history.replaceState(null, '', '/')
})

describe('ManualDialog', () => {
  it('не рендерится, когда закрыт', () => {
    render(<ManualDialog open={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('показывает главы в оглавлении и текст в просмотрщике', () => {
    render(<ManualDialog open onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const nav = screen.getByRole('navigation')
    for (const ch of MANUAL_CHAPTERS) {
      expect(within(nav).getByText(ch.title)).toBeInTheDocument()
    }
    // Контент глав рендерится: первый H2 первой главы виден в просмотрщике
    const h2 = MANUAL_CHAPTERS[0].source.match(/^##\s+(.+?)\s*$/m)
    expect(h2).not.toBeNull()
    expect(screen.getByRole('heading', { name: plainInline(h2![1]) })).toBeInTheDocument()
  })

  it('закрывается крестиком и по Esc', () => {
    const onClose = vi.fn()
    render(<ManualDialog open onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Закрыть'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  // Ссылок на ненаписанные главы нет (все запланированные главы написаны) —
  // ветка is-missing покрыта unit-тестами markdown.test.ts.
  it.skipIf(missingLinks.length === 0)(
    'ссылка на ненаписанную главу помечена и клик по ней безопасен',
    () => {
      render(<ManualDialog open onClose={() => {}} />)
      const target = missingLinks[0]
      const links = screen.getAllByRole('link', { name: target.text })
      expect(links.length).toBeGreaterThan(0)
      expect(links[0]).toHaveClass('is-missing')
      expect(links[0]).toHaveAttribute('title', 'Глава ещё не написана')
      fireEvent.click(links[0]) // preventDefault, без навигации и падений
    },
  )

  it.skipIf(knownLinks.length === 0)(
    'ссылка на существующую главу ведёт на её секцию',
    () => {
      render(<ManualDialog open onClose={() => {}} />)
      const first = MANUAL_CHAPTERS[0].slug
      const target = knownLinks.find((l) => l.slug !== first) ?? knownLinks[0]
      const links = screen.getAllByRole('link', { name: target.text })
      const href = target.anchor ? `#${target.slug}--${target.anchor}` : `#${target.slug}`
      expect(links[0]).toHaveAttribute('href', href)
      fireEvent.click(links[0])
      expect(scrollIntoViewMock).toHaveBeenCalled()
    },
  )

  it('клик по оглавлению скроллит к главе', () => {
    render(<ManualDialog open onClose={() => {}} />)
    const nav = screen.getByRole('navigation')
    const target = MANUAL_CHAPTERS[1] ?? MANUAL_CHAPTERS[0]
    fireEvent.click(within(nav).getByText(target.title))
    expect(scrollIntoViewMock).toHaveBeenCalled()
  })

  // Первая глава после стартовой, у которой есть H2: изначально свёрнута
  // (expanded стартует с первой главы), поэтому на ней видно раскрытие кликом.
  const collapsible = MANUAL_CHAPTERS.slice(1).find((c) => /^##\s/m.test(c.source))

  it.skipIf(collapsible === undefined)(
    'клик по главе в оглавлении раскрывает её собственные подзаголовки (+1 уровень)',
    () => {
      render(<ManualDialog open onClose={() => {}} />)
      const nav = screen.getByRole('navigation')
      const ch = collapsible!
      const row = () => nav.querySelector(`.manual__toc-row[data-node-id="${ch.slug}"]`)!
      expect(row()).not.toBeNull()
      // До клика глава свёрнута: подсписка нет
      expect(row().querySelector('.manual__toc-toggle')).toHaveAttribute('aria-expanded', 'false')
      expect(row().parentElement!.querySelector('.manual__toc-sub')).toBeNull()
      fireEvent.click(row().querySelector('.manual__toc-link')!)
      // После клика раздел раскрыт на один уровень: его подзаголовки видны
      expect(row().querySelector('.manual__toc-toggle')).toHaveAttribute('aria-expanded', 'true')
      const sub = row().parentElement!.querySelector<HTMLElement>('.manual__toc-sub')
      expect(sub).not.toBeNull()
      expect(sub!.querySelectorAll('.manual__toc-row').length).toBeGreaterThan(0)
      // В поддереве — первый H2 главы (текст узла оглавления = plainInline)
      const h2 = ch.source.match(/^##\s+(.+?)\s*$/m)!
      expect(within(sub!).getByText(plainInline(h2[1]))).toBeInTheDocument()
    },
  )

  it('клик по оглавлению центрирует строку раздела в навигаторе', () => {
    render(<ManualDialog open onClose={() => {}} />)
    const nav = screen.getByRole('navigation')
    const target = MANUAL_CHAPTERS[1] ?? MANUAL_CHAPTERS[0]
    scrollIntoViewMock.mockClear()
    const link = nav.querySelector(
      `.manual__toc-row[data-node-id="${target.slug}"] .manual__toc-link`,
    )!
    fireEvent.click(link)
    // Строка цели клик-перехода скроллится с block:'center' (а не 'nearest' —
    // краевое выравнивание и было причиной «глава прилипла к низу панели»)
    const row = nav.querySelector(`.manual__toc-row[data-node-id="${target.slug}"]`)
    expect(row).not.toBeNull()
    const idx = (scrollIntoViewMock.mock.instances as Element[]).indexOf(row!)
    expect(idx, 'строка раздела скроллилась').toBeGreaterThanOrEqual(0)
    expect(scrollIntoViewMock.mock.calls[idx][0]).toEqual({ block: 'center' })
  })

  it('внешний элемент с тем же id не перехватывает скролл (коллизия главы root и div#root)', () => {
    // Регресс: index.html содержит <div id="root"> (контейнер приложения) ДО
    // портала мануала, а глава 11-root.md даёт секцию <section id="root">.
    // document.getElementById возвращал первый по порядку — внешний контейнер,
    // и клик по главе «Настройки шаблона (корень)» не скроллил. Цель обязана
    // искаться внутри просмотрщика. Декои повторяют ситуацию для всех slug.
    const decoys = MANUAL_CHAPTERS.map((ch) => {
      const d = document.createElement('div')
      d.id = ch.slug
      document.body.appendChild(d)
      return d
    })
    try {
      render(<ManualDialog open onClose={() => {}} />)
      const nav = screen.getByRole('navigation')
      scrollIntoViewMock.mockClear()
      for (const ch of MANUAL_CHAPTERS) {
        // Клик строго по строке главы (data-node-id): с раскрытием разделов
        // в оглавлении может появиться подзаголовок с текстом, равным названию
        // другой главы («Установка шаблона в игру»), и getByText нашёл бы несколько.
        const row = nav.querySelector(`.manual__toc-row[data-node-id="${ch.slug}"]`)!
        fireEvent.click(row.querySelector('.manual__toc-link')!)
      }
      const scrolled = new Set<Element>(scrollIntoViewMock.mock.instances as Element[])
      MANUAL_CHAPTERS.forEach((ch, i) => {
        const section = document.querySelector(`.manual__view section[id="${ch.slug}"]`)
        expect(section, `секция главы ${ch.slug}`).not.toBeNull()
        expect(scrolled.has(section!), `скролл к секции главы ${ch.slug}`).toBe(true)
        expect(scrolled.has(decoys[i]), `внешний #${ch.slug} не скроллился`).toBe(false)
      })
    } finally {
      for (const d of decoys) d.remove()
    }
  })

  it('скриншоты глав рендерятся картинками из images/', () => {
    render(<ManualDialog open onClose={() => {}} />)
    // Кадры лежат в docs/manual/ru/images/ и попадают в бандл через glob ?url,
    // поэтому вместо плейсхолдеров .md-img-missing рендерятся настоящие <img>.
    // Числа выводятся из ссылок в главах и наличия файлов на диске.
    const imgs = [...document.querySelectorAll('img.md-img')]
    expect(imgs).toHaveLength(expectedImgs)
    for (const img of imgs) {
      expect(img.getAttribute('src')).toMatch(/\/images\/.+\.png$/)
      expect(img.getAttribute('alt')).toBeTruthy()
      // НЕ lazy: ленивая догрузка по пути smooth-скролла сдвигает лэйаут,
      // и скролл к главе не доезжает до цели (баг воспроизводился стабильно).
      expect(img.getAttribute('loading')).toBeNull()
    }
    // Заглушки «Скриншот появится позже» — только для кадров, которых нет на диске
    if (expectedMissing > 0) {
      expect(document.querySelectorAll('.md-img-missing')).toHaveLength(expectedMissing)
    }
  })

  it.skipIf(expectedImgs === 0)(
    'клик по скриншоту открывает его на всё окно, клик по фону возвращает к тексту',
    () => {
      render(<ManualDialog open onClose={() => {}} />)
      const img = document.querySelector('img.md-img')
      expect(img).not.toBeNull()
      expect(img).toHaveAttribute('title', 'Открыть на всё окно')
      fireEvent.click(img!)
      const box = screen.getByRole('dialog', { name: 'Скриншот на всё окно' })
      expect(within(box).getByRole('img')).toHaveAttribute('src', img!.getAttribute('src'))
      fireEvent.click(box)
      expect(box).toHaveClass('is-closing')
      // Сам мануал остаётся открыт
      expect(screen.getByRole('dialog', { name: 'Мануал редактора' })).toBeInTheDocument()
    },
  )

  it.skipIf(expectedImgs === 0)(
    'Esc закрывает сначала скриншот, а уже потом мануал',
    () => {
      const onClose = vi.fn()
      render(<ManualDialog open onClose={onClose} />)
      fireEvent.click(document.querySelector('img.md-img')!)
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog', { name: 'Скриншот на всё окно' })).toHaveClass('is-closing')
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    },
  )
})

// Якоря «#» у заголовков и хеш URL: клик-навигация (якорь, оглавление, ссылка
// в тексте) записывает адрес раздела в URL без записей в истории, deep link
// мгновенно скроллит при открытии, закрытие мануала стирает хеш. Механика
// хеша — utils/manualHash.ts (чистая часть покрыта manualHash.test.ts).
// location.hash хранит не-ASCII в percent-encoding — сравниваем через anchorFromHash.
describe('ManualDialog: якоря заголовков и хеш URL', () => {
  it('у каждого заголовка есть якорь «#» — ссылка на собственный id', () => {
    render(<ManualDialog open onClose={() => {}} />)
    const headings = [...document.querySelectorAll<HTMLElement>('.manual__view [data-md-h]')]
    expect(headings.length).toBeGreaterThan(0)
    for (const h of headings) {
      const a = h.querySelector('a.md-h-anchor')
      expect(a, `якорь у заголовка ${h.id}`).not.toBeNull()
      expect(a!.getAttribute('href')).toBe(`#${h.id}`)
      expect(a!.textContent).toBe('#')
    }
  })

  it('клик по якорю «#» скроллит к заголовку и пишет хеш в URL', () => {
    render(<ManualDialog open onClose={() => {}} />)
    const heading = document.querySelectorAll<HTMLElement>('.manual__view [data-md-h]')[1]
    const anchor = heading.querySelector('a.md-h-anchor')!
    fireEvent.click(anchor)
    expect(scrollIntoViewMock.mock.instances).toContain(heading)
    expect(anchorFromHash(window.location.hash)).toBe(heading.id)
  })

  it('клик по оглавлению тоже обновляет хеш (URL всегда указывает на раздел)', () => {
    render(<ManualDialog open onClose={() => {}} />)
    const nav = screen.getByRole('navigation')
    const target = MANUAL_CHAPTERS[1] ?? MANUAL_CHAPTERS[0]
    fireEvent.click(within(nav).getByText(target.title))
    expect(anchorFromHash(window.location.hash)).toBe(target.slug)
  })

  it('deep link: открытие с #якорь в URL мгновенно скроллит к заголовку', () => {
    // id первого H1 первой главы выводится как в рендерере: <slug>--<slugify(текст)>
    const ch = MANUAL_CHAPTERS[0]
    const h1 = ch.source.match(/^#\s+(.+?)\s*$/m)
    expect(h1).not.toBeNull()
    const id = `${ch.slug}--${slugify(h1![1])}`
    window.history.replaceState(null, '', `/#${encodeURIComponent(id)}`)
    render(<ManualDialog open onClose={() => {}} />)
    const el = document.querySelector(`.manual__view #${CSS.escape(id)}`)
    expect(el).not.toBeNull()
    expect(scrollIntoViewMock.mock.instances).toContain(el)
    // Мгновенный скролл без анимации: behavior не передаётся
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'start' })
    // Deep link не перезаписывает URL — хеш остаётся как был
    expect(anchorFromHash(window.location.hash)).toBe(id)
  })

  it('внешняя смена хеша при открытом мануале скроллит к разделу', () => {
    render(<ManualDialog open onClose={() => {}} />)
    const slug = (MANUAL_CHAPTERS[1] ?? MANUAL_CHAPTERS[0]).slug
    // replaceState не порождает hashchange — имитируем навигацию событием вручную
    window.history.replaceState(null, '', `/#${encodeURIComponent(slug)}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    const section = document.querySelector(`.manual__view section[id="${slug}"]`)
    expect(scrollIntoViewMock.mock.instances).toContain(section)
  })

  it('закрытие стирает хеш URL (крестик и Esc)', () => {
    const onClose = vi.fn()
    window.history.replaceState(null, '', '/#some--anchor')
    render(<ManualDialog open onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Закрыть'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe('')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(window.location.hash).toBe('')
  })
})

// Поиск по оглавлению: ввод идёт в локальный useState, фильтрация и подсветка
// идут через useDeferredValue, поэтому все ассерты после изменения ввода —
// только асинхронные (findBy/waitFor). CSS Custom Highlight API в jsdom нет —
// эффект подсветки тела guarded и в тестах не падает.
describe('ManualDialog: поиск по оглавлению', () => {
  const searchBox = () => screen.getByPlaceholderText('Поиск по мануалу…')

  it('один символ не фильтрует оглавление', () => {
    render(<ManualDialog open onClose={() => {}} />)
    const nav = screen.getByRole('navigation')
    fireEvent.change(searchBox(), { target: { value: 'о' } })
    // MIN_SEARCH_LEN = 2: при одном символе дерево остаётся полным
    for (const ch of MANUAL_CHAPTERS) {
      expect(within(nav).getByText(ch.title)).toBeInTheDocument()
    }
  })

  it('бессмысленный запрос показывает «Ничего не найдено»', async () => {
    render(<ManualDialog open onClose={() => {}} />)
    fireEvent.change(searchBox(), { target: { value: 'zzzqqqxxx' } })
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument()
    const nav = screen.getByRole('navigation')
    expect(nav.querySelector('.manual__toc')).toBeNull()
  })

  it('совпадения в оглавлении подсвечиваются mark', async () => {
    render(<ManualDialog open onClose={() => {}} />)
    const nav = screen.getByRole('navigation')
    const q = MANUAL_CHAPTERS[0].title.slice(0, 5)
    fireEvent.change(searchBox(), { target: { value: q } })
    await waitFor(() => {
      expect(nav.querySelector('.manual__toc-mark')).not.toBeNull()
    })
    const mark = nav.querySelector('.manual__toc-mark')!
    expect(mark.textContent?.toLowerCase()).toBe(q.toLowerCase())
  })

  it('кнопка очистки возвращает полное оглавление', async () => {
    render(<ManualDialog open onClose={() => {}} />)
    const nav = screen.getByRole('navigation')
    fireEvent.change(searchBox(), { target: { value: 'zzzqqq' } })
    await screen.findByText('Ничего не найдено')
    fireEvent.click(screen.getByLabelText('Очистить поиск'))
    await waitFor(() => {
      for (const ch of MANUAL_CHAPTERS) {
        expect(within(nav).getByText(ch.title)).toBeInTheDocument()
      }
    })
    expect(screen.queryByText('Ничего не найдено')).not.toBeInTheDocument()
    // Поле ввода тоже очищено
    expect(searchBox()).toHaveValue('')
  })
})

// Локаль мануала следует за локалью интерфейса: главы и кадры берутся из
// docs/manual/<локаль>/ (manual.ts), переключение при открытом диалоге живо
// подменяет контент, навигатор сбрасывается на первую главу (якоря заголовков
// производны от их текста и в другой локали другие).
describe('ManualDialog: локаль мануала следует за локалью интерфейса', () => {
  const EN_CHAPTERS = getManualChapters('en')

  afterEach(async () => {
    // setup зафиксировал ru для остальных тестов файла — возвращаем её
    await i18n.changeLanguage('ru')
  })

  it('в en-локали: en-главы в оглавлении и просмотрщике, кадры из en-папки', async () => {
    await i18n.changeLanguage('en')
    render(<ManualDialog open onClose={() => {}} />)
    const nav = screen.getByRole('navigation')
    for (const ch of EN_CHAPTERS) {
      expect(within(nav).getByText(ch.title)).toBeInTheDocument()
    }
    // ru-заголовки заменены en-зеркалом (тексты глав различаются)
    expect(within(nav).queryByText(MANUAL_CHAPTERS[0].title)).toBeNull()
    // Кадры резолвятся из docs/manual/en/images/
    const imgs = [...document.querySelectorAll('img.md-img')]
    expect(imgs.length).toBeGreaterThan(0)
    for (const img of imgs) {
      expect(img.getAttribute('src')).toMatch(/\/en\/images\/.+\.png$/)
    }
  })

  it('переключение локали при открытом мануале живо подменяет контент', async () => {
    render(<ManualDialog open onClose={() => {}} />)
    const nav = screen.getByRole('navigation')
    expect(within(nav).getByText(MANUAL_CHAPTERS[0].title)).toBeInTheDocument()
    await act(async () => {
      await i18n.changeLanguage('en')
    })
    expect(await within(nav).findByText(EN_CHAPTERS[0].title)).toBeInTheDocument()
    expect(within(nav).queryByText(MANUAL_CHAPTERS[0].title)).toBeNull()
  })
})
