// Unit-тесты каталога имён sid (src/data/sidCatalog.ts): локализация sidHint (ru/en),
// паритет генерируемых каталогов, отсутствие протечки кириллицы в en-ветке.
// Ожидания взяты из официальных Lang-токенов core_db (ru/en совпадают ключ в ключ).
import { describe, expect, it } from 'vitest'
import { SID_CATALOG, SID_SUGGESTIONS, sidHint, sidNameLang, sidOptions } from './sidCatalog'
import { SID_NAMES_EN, SID_NAMES_RU } from './sidNames'

describe('sidNameLang — нормализация i18n.language', () => {
  it('en-теги → en, остальное (включая пустоту) → ru', () => {
    expect(sidNameLang('en')).toBe('en')
    expect(sidNameLang('en-US')).toBe('en')
    expect(sidNameLang('EN-GB')).toBe('en')
    expect(sidNameLang('ru')).toBe('ru')
    expect(sidNameLang('RU')).toBe('ru')
    expect(sidNameLang('de')).toBe('ru')
    expect(sidNameLang(undefined)).toBe('ru')
  })
})

describe('паритет генерируемых каталогов', () => {
  it('SID_NAMES_RU и SID_NAMES_EN имеют одинаковые наборы ключей', () => {
    const ruKeys = Object.keys(SID_NAMES_RU).sort()
    const enKeys = Object.keys(SID_NAMES_EN).sort()
    expect(enKeys.length).toBeGreaterThan(1500)
    expect(ruKeys.length).toBe(enKeys.length)
    expect(enKeys).toEqual(ruKeys)
  })
})

describe('sidHint — официальное имя по языку каталога', () => {
  it('ru: default-поведение сохранено (курируемое/официальное русское имя)', () => {
    expect(sidHint('mine_wood', 'ru')).toBe('Лесопилка')
    expect(sidHint('change_use_necromancy', 'ru')).toBe('Воля некроманта')
  })

  it('en: официальное имя из SID_NAMES_EN, русская curated-подпись не имеет приоритета', () => {
    expect(sidHint('mine_wood', 'en')).toBe('Sawmill')
    // Ключевая регрессия кадра variant-manage-02: в en не «Лесопилка», а английское имя.
    expect(sidHint('pandora_box', 'en')).toBe('Pandora’s Box')
    // Алиасованное заклинание: name-токен не совпадает с id — в en тоже резолвится.
    expect(sidHint('change_use_necromancy', 'en')).toBe('Necromancer Will')
  })

  it('en: RE-подписи без официальных токенов имеют hintEn', () => {
    expect(sidHint('fountain_2', 'en')).toBe('Fountain')
    expect(sidHint('random_item_common', 'en')).toBe('Random Common Item')
    expect(sidHint('random_item_rare', 'en')).toBe('Random Rare Item')
    expect(sidHint('random_item_epic', 'en')).toBe('Random Epic Item')
    expect(sidHint('random_item_legendary', 'en')).toBe('Random Legendary Item')
    expect(sidHint('random_hire_1', 'en')).toBe('External hire · tier 1')
    expect(sidHint('random_hire_7', 'en')).toBe('External hire · tier 7')
    // ru-ветка этих же sid не изменилась
    expect(sidHint('fountain_2', 'ru')).toBe('Фонтан')
    expect(sidHint('random_hire_3', 'ru')).toBe('Внешний найм · ярус 3')
  })

  it('пустой/неизвестный sid → undefined в обеих ветках', () => {
    expect(sidHint(undefined, 'ru')).toBeUndefined()
    expect(sidHint(undefined, 'en')).toBeUndefined()
    expect(sidHint('no_such_sid_zzz', 'ru')).toBeUndefined()
    // en-ветка при отсутствии имени НЕ отдаёт русское — иначе кириллица течёт в en UI
    expect(sidHint('no_such_sid_zzz', 'en')).toBeUndefined()
  })

  it('ни один curated sid в en-ветке не отдаёт строку с кириллицей', () => {
    for (const s of SID_SUGGESTIONS) {
      const en = sidHint(s, 'en')
      if (en !== undefined) {
        expect(en, `sid "${s}" leaked Cyrillic into en catalog branch: ${en}`).not.match(/[\u0400-\u04FF]/)
      }
    }
  })

  it('каждый curated sid резолвится в читаемое имя в обеих ветках (полнота каталога для UI)', () => {
    for (const s of SID_SUGGESTIONS) {
      expect(sidHint(s, 'ru'), `sid "${s}" без ru-имени`).toBeDefined()
      expect(sidHint(s, 'en'), `sid "${s}" без en-имени`).toBeDefined()
    }
  })

  it('каждая RE-подпись (без hintEn быть не может) — блокировка будущих односторонних правок', () => {
    for (const info of SID_CATALOG) {
      if (info.hintEn !== undefined) {
        expect(info.hint, `hintEn без hint у sid "${info.sid}"`).toBeDefined()
      }
    }
  })
})

describe('sidOptions — каталог подсказок ComboInput по языку', () => {
  it('значение — сырой sid, label — имя выбранного языка', () => {
    const ru = sidOptions('ru')
    const en = sidOptions('en')
    expect(ru.map((o) => o.value)).toEqual(SID_SUGGESTIONS)
    expect(en.map((o) => o.value)).toEqual(ru.map((o) => o.value))
    const wood = (opts: { value: string; label?: string }[]) => opts.find((o) => o.value === 'mine_wood')?.label
    expect(wood(ru)).toBe('Лесопилка')
    expect(wood(en)).toBe('Sawmill')
  })
})
