import { describe, expect, it } from 'vitest'
import { poolNameLabel } from '../components/pools/tagLabels'
import { ruCommon } from '../i18n/locales/ru/common'
import { LIST_NAMES, POOL_NAMES } from '../data/poolCatalog'
import { humanizePoolName, UNITS_BANK_SID } from './poolNames'

/**
 * Тесты «очеловечивания» имён пулов/списков (src/utils/poolNames.ts).
 * Перевод берётся из настоящей ru-локали: потерянный ключ даст «MISSING:…»
 * в строке ассерта и провал теста.
 */

const dict = ruCommon as unknown as Record<string, unknown>

function lookup(key: string): string | undefined {
  let cur: unknown = dict
  for (const seg of key.split('.')) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return typeof cur === 'string' ? cur : undefined
}

const t = (key: string) => lookup(key) ?? `MISSING:${key}`

function label(name: string): string | null {
  const parts = humanizePoolName(name)
  return parts ? poolNameLabel(parts, t) : null
}

describe('humanizePoolName', () => {
  it('random-пулы: охрана, тир, профиль', () => {
    expect(label('template_pool_random_unguarded_t3_item')).toBe('Случайный пул · неохраняемый · t3 · предметы')
    expect(label('classic_template_pool_random_t1_base')).toBe('Классический случайный пул · t1 · базовый')
    expect(label('template_pool_random_t5_magic')).toBe('Случайный пул · t5 · магия')
  })

  it('пулы шаблонов и контент-пулы: роль зоны, номер, богатство', () => {
    expect(label('template_pool_default')).toBe('Пул по умолчанию')
    expect(label('template_pool_jebus_cross_guarded_start_zone_1')).toBe(
      'Пул шаблона · Jebus Cross · охраняемый · стартовая зона · №1',
    )
    expect(label('content_pool_template_sprint_unguarded_green')).toBe(
      'Контент-пул шаблона · Sprint · неохраняемый · зелёная',
    )
    expect(label('content_pool_general_resources_treasure_zone_rich_no_scrolls')).toBe(
      'Контент-пул · общие ресурсы · зона сокровищ · богатая без свитков',
    )
    expect(label('content_pool_anarchy_poor_guarded_start_zone')).toBe(
      'Контент-пул · Anarchy · бедная · охраняемый · стартовая зона',
    )
  })

  it('списки: ступени (tier N), пандоры, свитки, банки ресурсов', () => {
    expect(label('basic_content_list_pickup_scroll_box_tier_3')).toBe(
      'Базовый список · подбираемое · магический свиток · ступень 3',
    )
    expect(label('basic_content_list_pickup_pandora_box_army_high_tier')).toBe(
      'Базовый список · подбираемое · ящик Пандоры: армия высоких тиров',
    )
    expect(label('basic_content_list_building_guarded_resource_banks_tier_1_no_biome_restriction')).toBe(
      'Базовый список · здания · охраняемые банки ресурсов · ступень 1 · без привязки к биому',
    )
    expect(label('content_list_building_epic_guarded_resource_banks')).toBe(
      'Список · здания · эпические · охраняемые банки ресурсов',
    )
  })

  it('пары банков юнитов 2_X_Y — официальные русские имена объектов', () => {
    const parts = humanizePoolName('basic_content_list_building_guarded_units_banks_2_1_7')
    expect(parts?.[parts.length - 1]).toEqual({ type: 'bankPair', a: 1, b: 7 })
    expect(label('basic_content_list_building_guarded_units_banks_2_1_7')).toBe(
      'Базовый список · здания · охраняемые банки юнитов · пара: Колизей + Точка равновесия',
    )
  })

  it('все 7 индексов банков юнитов определены', () => {
    expect(Object.keys(UNITS_BANK_SID)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
  })

  it('неизвестные имена → null (UI показывает сырое имя как есть)', () => {
    expect(humanizePoolName('weird_pool')).toBeNull()
    expect(humanizePoolName('template_pool_jebus_guarded_main')).toBeNull()
    expect(humanizePoolName('')).toBeNull()
  })
})

describe('покрытие реального каталога', () => {
  const allNames = [...POOL_NAMES, ...LIST_NAMES]

  it('каждое имя пула/списка раскладывается на смысловые части', () => {
    const uncovered = allNames.filter((n) => humanizePoolName(n) === null)
    expect(uncovered, `не покрыто: ${uncovered.join(', ')}`).toEqual([])
  })

  it('все i18n-ключи подписей существуют в ru-локали', () => {
    const missing = new Set<string>()
    for (const n of allNames) {
      for (const p of humanizePoolName(n) ?? []) {
        if (p.type === 'i18n' && lookup(p.key) === undefined) missing.add(p.key)
      }
    }
    for (const k of ['poolNames.tierN', 'poolNames.numN', 'poolNames.bankPair', 'poolNames.bankFallback']) {
      if (lookup(k) === undefined) missing.add(k)
    }
    expect([...missing]).toEqual([])
  })
})
