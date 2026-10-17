import { describe, expect, it } from 'vitest'
import { chapterStemParts, plainInline, renderMarkdown, slugify } from './markdown'

describe('slugify', () => {
  it('сохраняет кириллицу и переводит пробелы в дефисы', () => {
    expect(slugify('Быстрый старт')).toBe('быстрый-старт')
  })

  it('убирает пунктуацию', () => {
    expect(slugify('Канва: режимы отображения')).toBe('канва-режимы-отображения')
  })

  it('сохраняет подчёркивания и цифры (sid)', () => {
    expect(slugify('Лэйаут zone_layout_default 2')).toBe('лэйаут-zone_layout_default-2')
  })
})

describe('plainInline', () => {
  it('снимает разметку ссылок, кода и выделения', () => {
    expect(plainInline('[Быстрый старт](quick-start.md) и `код`, **жир**')).toBe('Быстрый старт и код, жир')
  })
})

describe('renderMarkdown: заголовки', () => {
  it('даёт якоря с префиксом главы и собирает список заголовков', () => {
    const r = renderMarkdown('# Заголовок\n\n## Под-заголовок\n', { chapterSlug: 'ch' })
    expect(r.html).toContain('<h1 id="ch--заголовок"')
    expect(r.headings).toEqual([
      { level: 1, text: 'Заголовок', id: 'ch--заголовок' },
      { level: 2, text: 'Под-заголовок', id: 'ch--под-заголовок' },
    ])
  })

  it('вставляет в заголовок якорь «#» — ссылку на собственный id', () => {
    const r = renderMarkdown('## Раздел\n', { chapterSlug: 'ch' })
    expect(r.html).toContain(
      '<a class="md-h-anchor" href="#ch--раздел" aria-hidden="true" tabindex="-1">#</a>',
    )
  })

  it('дубликаты заголовков получают числовой суффикс', () => {
    const r = renderMarkdown('## Раздел\n\n## Раздел\n', { chapterSlug: 'ch' })
    expect(r.html).toContain('id="ch--раздел"')
    expect(r.html).toContain('id="ch--раздел-1"')
  })
})

describe('renderMarkdown: экранирование', () => {
  it('экранирует HTML источника', () => {
    const { html } = renderMarkdown('текст <script>alert(1)</script> и <имя>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;имя&gt;')
    expect(html).not.toContain('<script>')
  })
})

describe('renderMarkdown: инлайн', () => {
  it('жирный, курсив, код; подчёркивание — не выделение', () => {
    const { html } = renderMarkdown('**жирный** *курсив* `код` и _sid_name_')
    expect(html).toContain('<strong>жирный</strong>')
    expect(html).toContain('<em>курсив</em>')
    expect(html).toContain('<code>код</code>')
    expect(html).toContain('_sid_name_')
  })

  it('код-спан защищает содержимое от разметки', () => {
    const { html } = renderMarkdown('`**не жирный** <x>`')
    expect(html).toContain('<code>**не жирный** &lt;x&gt;</code>')
  })

  it('ссылка на существующую главу — data-chapter и якорь-цель', () => {
    const { html } = renderMarkdown('[Быстрый старт](quick-start.md)', {
      knownChapters: new Set(['quick-start']),
    })
    expect(html).toContain('data-chapter="quick-start"')
    expect(html).toContain('href="#quick-start"')
    expect(html).not.toContain('is-missing')
  })

  it('ссылка на ненаписанную главу помечается is-missing', () => {
    const { html } = renderMarkdown('[Интерфейс](interface.md)', {
      knownChapters: new Set(['obzor']),
      linkMissingTitle: 'Глава ещё не написана',
    })
    expect(html).toContain('is-missing')
    expect(html).toContain('title="Глава ещё не написана"')
  })

  it('ссылка на раздел главы — цель с разделителем', () => {
    const { html } = renderMarkdown('[раздел](quick-start.md#сохранение)', {
      knownChapters: new Set(['quick-start']),
    })
    expect(html).toContain('href="#quick-start--сохранение"')
    expect(html).toContain('data-anchor="сохранение"')
  })

  it('номер главы в ссылке срезается: NN-slug.md ведёт на slug', () => {
    const { html } = renderMarkdown('[Быстрый старт](01-quick-start.md#сохранение)', {
      knownChapters: new Set(['quick-start']),
    })
    expect(html).toContain('data-chapter="quick-start"')
    expect(html).toContain('href="#quick-start--сохранение"')
    expect(html).not.toContain('is-missing')
  })

  it('внутриглавный якорь получает префикс текущей главы', () => {
    const { html } = renderMarkdown('[раздел](#sohranenie)', { chapterSlug: 'files' })
    expect(html).toContain('href="#files--sohranenie"')
  })

  it('внешняя ссылка — в новой вкладке', () => {
    const { html } = renderMarkdown('[h3hota](https://h3hota.com/ru/templates)')
    expect(html).toContain('href="https://h3hota.com/ru/templates"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })
})

describe('renderMarkdown: изображения', () => {
  it('отсутствующее изображение — плейсхолдер с подписью', () => {
    const { html } = renderMarkdown('![Кадр окна](images/obzor-01.png)', {
      resolveImage: () => null,
      imageMissingLabel: 'Скриншот появится позже',
    })
    expect(html).toContain('md-img-missing')
    expect(html).toContain('Кадр окна')
    expect(html).toContain('Скриншот появится позже')
    expect(html).not.toContain('<img')
  })

  it('найденное изображение — img с resolved src', () => {
    const { html } = renderMarkdown('![Кадр](images/x-01.png)', {
      resolveImage: () => 'data:image/png;base64,AAA',
    })
    expect(html).toContain('<img class="md-img"')
    expect(html).toContain('src="data:image/png;base64,AAA"')
    expect(html).toContain('alt="Кадр"')
    // Без подсказки — и без атрибута title
    expect(html).not.toContain('title=')
  })

  it('подсказка imageZoomTitle попадает в title изображения', () => {
    const { html } = renderMarkdown('![Кадр](images/x-01.png)', {
      resolveImage: () => '/images/x-01.png',
      imageZoomTitle: 'Открыть на всё окно',
    })
    expect(html).toContain('<img class="md-img"')
    expect(html).toContain('title="Открыть на всё окно"')
  })
})

describe('renderMarkdown: блоки', () => {
  it('нумерованный список с продолжением шага и вложенным списком', () => {
    const md = '1. Первый шаг\n2. Второй шаг\n   продолжение шага\n   - вложенный пункт\n'
    const { html } = renderMarkdown(md)
    expect(html).toContain('<ol>')
    expect(html).toContain('Первый шаг')
    expect(html).toContain('продолжение шага')
    expect(html).toContain('<ul>')
    expect(html).toContain('вложенный пункт')
  })

  it('маркированный список', () => {
    const { html } = renderMarkdown('- один\n- два\n')
    expect(html).toContain('<ul>')
    expect(html.match(/<li>/g)).toHaveLength(2)
  })

  it('start нумерованного списка сохраняется', () => {
    const { html } = renderMarkdown('3. третий\n4. четвёртый\n')
    expect(html).toContain('<ol start="3">')
  })

  it('таблица: thead/tbody, ячейки с инлайном', () => {
    const md = '| Поле | Значение |\n|---|---|\n| Плотность | **0.5** |\n'
    const { html } = renderMarkdown(md)
    expect(html).toContain('<table class="md-table">')
    expect(html).toContain('<th>Поле</th>')
    expect(html).toContain('<td><strong>0.5</strong></td>')
    expect(html).toContain('<tbody>')
  })

  it('fenced-код-блок экранируется и помечается языком', () => {
    const { html } = renderMarkdown('```json\n{"a": 1}\n```\n')
    expect(html).toContain('<pre class="md-pre">')
    expect(html).toContain('class="language-json"')
    expect(html).toContain('{&quot;a&quot;: 1}')
  })

  it('blockquote и hr', () => {
    const { html } = renderMarkdown('> примечание\n\n---\n')
    expect(html).toContain('<blockquote class="md-quote">')
    expect(html).toContain('примечание')
    expect(html).toContain('<hr>')
  })

  it('абзацы разделяются пустой строкой', () => {
    const { html } = renderMarkdown('Первый абзац.\n\nВторой абзац.\n')
    expect(html.match(/<p>/g)).toHaveLength(2)
  })

  it('жирный заголовок-абзац карты глав', () => {
    const { html } = renderMarkdown('**Начало работы**\n\n- пункт\n')
    expect(html).toContain('<p><strong>Начало работы</strong></p>')
    expect(html).toContain('<ul>')
  })
})

describe('renderMarkdown: реальные главы', () => {
  it('таблица лэйаутов quick-start рендерится полностью', () => {
    // Фрагмент настоящей главы с таблицей значений лэйаута
    const md = [
      '| Поле | Значение |',
      '|---|---|',
      '| Плотность препятствий | 0.5 |',
      '| Веса размеров групп | 20 · 2 · 1 |',
      '',
    ].join('\n')
    const { html } = renderMarkdown(md)
    expect(html).toContain('<td>Плотность препятствий</td>')
    expect(html).toContain('<td>20 · 2 · 1</td>')
  })
})

describe('renderMarkdown: sectionText', () => {
  it('разделы накапливают собственный текст до следующего заголовка', () => {
    const { sectionText } = renderMarkdown('# Глава\n\nВводный текст.\n\n## Раздел\n\nТекст раздела.\n', {
      chapterSlug: 'ch',
    })
    expect(sectionText['ch--глава']).toContain('Глава')
    expect(sectionText['ch--глава']).toContain('Вводный текст')
    expect(sectionText['ch--раздел']).toContain('Раздел')
    expect(sectionText['ch--раздел']).toContain('Текст раздела')
    expect(sectionText['ch--раздел']).not.toContain('Вводный')
  })

  it('индекс очищает разметку и включает содержимое код-блоков', () => {
    const md = ['## Раздел', '', 'Есть `код_токен` и **жирный**.', '', '```', 'plain_code_line', '```', ''].join('\n')
    const { sectionText } = renderMarkdown(md, { chapterSlug: 'ch' })
    const text = sectionText['ch--раздел']
    expect(text).toContain('код_токен')
    expect(text).toContain('жирный')
    expect(text).toContain('plain_code_line')
    expect(text).not.toContain('**')
    expect(text).not.toContain('`')
  })

  it('клетки таблицы попадают в индекс раздела', () => {
    const md = ['## Таблица', '', '| Поле | Значение |', '|---|---|', '| Плотность | 0.5 |', ''].join('\n')
    const { sectionText } = renderMarkdown(md, { chapterSlug: 'ch' })
    expect(sectionText['ch--таблица']).toContain('Поле')
    expect(sectionText['ch--таблица']).toContain('Плотность')
    expect(sectionText['ch--таблица']).toContain('0.5')
  })
})

describe('chapterStemParts', () => {
  it('имя файла NN-slug даёт номер и slug', () => {
    expect(chapterStemParts('00-obzor')).toEqual({ order: 0, slug: 'obzor' })
    expect(chapterStemParts('02-interface')).toEqual({ order: 2, slug: 'interface' })
    expect(chapterStemParts('15-variant-manage')).toEqual({ order: 15, slug: 'variant-manage' })
  })

  it('имя без номера — slug как есть, order null', () => {
    expect(chapterStemParts('quick-start')).toEqual({ order: null, slug: 'quick-start' })
  })

  it('номером считается только префикс из цифр с дефисом', () => {
    // '3d-objects': «3d» — не число, имя остаётся целым
    expect(chapterStemParts('3d-objects')).toEqual({ order: null, slug: '3d-objects' })
  })
})
