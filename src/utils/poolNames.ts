// humanPoolName: «очеловечивание» внутренних имён пулов/списков poolCatalog.
//
// ФАКТЫ (реверс-инжиниринг core_db, Lang/russian):
// - официальной локализации имён пулов и content-списков в игре НЕТ:
//   имена вида template_pool_* / content_pool_* / *_content_list_* — внутренние
//   идентификаторы, игра их нигде не показывает (поиск по Lang/russian/texts — 0
//   совпадений). Русские подписи ниже — наша реконструкция по содержимому списков.
// - имена шаблонов (jebus_cross, blitz, …) игра тоже НЕ переводит (есть только
//   templates_description_*), поэтому они остаются латиницей («Jebus Cross»).
// - термины редкости (обычный/необычный/эпический), «Алхимическая пыль»,
//   «Классический» — сверены с официальными строками Lang/russian.
// - соответствие индексов 1..7 в building_guarded_units_banks_2_X_Y проверено
//   по содержимому всех 21 списка: каждый содержит ровно пару банков юнитов.
//
// Помеченные «гипотеза» переводы выведены из содержимого списков и официально
// не задокументированы (non_content, _fix, _equal, pro, no_imbalance,
// all_default, hero_banks, control/world_spells).

/** Часть humanized-подписи: литерал, i18n-ключ или пара банков юнитов. */
export type PoolNamePart =
  | { type: 'text'; text: string }
  | { type: 'i18n'; key: string; params?: Record<string, string | number> }
  | { type: 'bankPair'; a: number; b: number }

/** Индекс → sid «банка юнитов» (проверено по содержимому всех 21 пары 2_X_Y). */
export const UNITS_BANK_SID: Record<number, string> = {
  1: 'jousting_range',
  2: 'unforgotten_grave',
  3: 'petrified_memorial',
  4: 'ritual_pyre',
  5: 'boreal_call',
  6: 'the_gorge',
  7: 'point_of_balance',
}

const i18n = (key: string): PoolNamePart => ({ type: 'i18n', key: `poolNames.${key}` })
const tag = (key: string): PoolNamePart => ({ type: 'i18n', key: `poolTags.${key}` })
const txt = (text: string): PoolNamePart => ({ type: 'text', text })

/** Собственные имена шаблонов — игра их не переводит, оставляем латиницей. */
const TEMPLATES: Record<string, string> = {
  anarchy: 'Anarchy',
  arcade: 'Arcade',
  blitz: 'Blitz',
  chosen_one: 'Chosen One',
  christmas_tree: 'Christmas Tree',
  conquest: 'Conquest',
  crossroads: 'Crossroads',
  diamond: 'Diamond',
  diplomacy: 'Diplomacy',
  exodus: 'Exodus',
  expanse: 'Expanse',
  eye: 'Eye',
  galaxy: 'Galaxy',
  hallway: 'Hallway',
  harmony: 'Harmony',
  helltide: 'Helltide',
  ikarus: 'Ikarus',
  infinity: 'Infinity',
  jebus_cross: 'Jebus Cross',
  jebus_outcast_pools: 'Jebus Outcast',
  jebus_tournament: 'Jebus Tournament',
  kerberos: 'Kerberos',
  king: 'King',
  last_fortress: 'Last Fortress',
  madness: 'Madness',
  maneuvers: 'Maneuvers',
  massacre: 'Massacre',
  maze: 'Maze',
  memory_lane: 'Memory Lane',
  mini_nosta: 'Mini Nosta',
  miracle: 'Miracle',
  mix: 'Mix',
  mlyn: 'Mlyn',
  octojebus: 'Octojebus',
  pyramid: 'Pyramid',
  shamrock: 'Shamrock',
  showdown: 'Showdown',
  spider: 'Spider',
  sprint: 'Sprint',
  square: 'Square',
  symphony: 'Symphony',
  symmetry: 'Symmetry',
  tourney_outcast_pools: 'Tourney Outcast',
  trinity: 'Trinity',
  universe: 'Universe',
  vendetta_pools: 'Vendetta',
  wastelands: 'Wastelands',
  zookeeper: 'Zookeeper',
}

/**
 * Словарь фраз (matching «самая длинная фраза первая»).
 * Значения — часть(и) подписи; ключи poolNames.* живут в ru/common/pools.json.
 */
const PHRASES_RAW: Array<[string, PoolNamePart | PoolNamePart[]]> = [
  // —— структурные префиксы ——
  ['classic_template_pool_random', i18n('classicRandomPool')],
  ['template_pool_random', i18n('randomPool')],
  ['template_pool_default', i18n('defaultPool')],
  ['classic_template_pool', i18n('classicTemplatePool')],
  ['content_pool_template', i18n('contentPoolTemplate')],
  ['template_pool', i18n('templatePool')],
  ['content_pool', i18n('contentPool')],
  ['basic_content_list', i18n('basicList')],
  ['content_list', i18n('list')],
  // —— охрана ——
  ['unguarded', tag('guard.unguarded')],
  ['guarded', tag('guard.guarded')],
  // —— банки юнитов / ресурсов ——
  ['guarded_units_banks', i18n('guardedUnitsBanks')],
  ['units_banks', i18n('unitsBanks')],
  ['guarded_resource_banks', i18n('guardedResourceBanks')],
  ['resource_banks', i18n('resourceBanks')],
  ['guarded_resource_bank', i18n('guardedResourceBank')],
  ['resource_bank', i18n('resourceBank')],
  ['no_biome_restriction', i18n('noBiomeRestriction')],
  ['only_biome_restriction', i18n('onlyBiomeRestriction')],
  ['by_biome', i18n('byBiome')],
  // —— редкость (официальные термины Lang: Обычный/Необычный/Эпический/Редкий) ——
  ['commons', i18n('common')],
  ['uncommons', i18n('uncommon')],
  ['common', i18n('common')],
  ['uncommon', i18n('uncommon')],
  ['epic', i18n('epic')],
  ['rare', i18n('rare')],
  // —— здания ——
  ['vision_buildings', i18n('visionBuildings')],
  ['building_special', i18n('specialBuildings')],
  ['buildings_control_spells', i18n('controlSpellBuildings')], // гипотеза: заклинания контроля
  ['building_magic', i18n('magicBuildings')],
  ['basic_buildings', i18n('basicBuildings')],
  ['building', i18n('building')],
  ['buildings', i18n('building')],
  ['utopia', i18n('utopia')],
  ['interact', i18n('interact')],
  ['no_imbalance', i18n('noImbalance')], // гипотеза: убран дисбалансирующий объект
  // —— герой ——
  ['hero_stats_and_skills', i18n('heroStatsAndSkills')],
  ['hero_stats', i18n('heroStats')],
  ['hero_banks', i18n('heroBanks')], // гипотеза: здания бонусов героя
  ['hero_buffs', i18n('heroBuffs')],
  ['hero_buff', i18n('heroBuffs')],
  ['hero_exp', i18n('heroExp')],
  ['buff_movepoints', i18n('buffMovepoints')],
  // —— найм ——
  ['random_hires_high_tier', i18n('hiresHighTier')],
  ['random_hires_low_tier', i18n('hiresLowTier')],
  ['random_hires', i18n('randomHires')],
  ['high_tier', i18n('highTier')],
  ['low_tier', i18n('lowTier')],
  // —— магия ——
  ['control_spells', i18n('controlSpells')], // гипотеза
  ['world_spells', i18n('worldSpells')], // гипотеза
  ['magic_school', i18n('magicSchool')],
  ['magic_tier', i18n('magicTier')],
  ['magic', tag('profile.magic')],
  // —— ящики Пандоры / свитки / подбираемое (русские имена — из Lang) ——
  ['pandora_box_all_default', i18n('pandoraAllDefault')], // гипотеза: стандартный набор
  ['pandora_box_all_stats', i18n('pandoraAllStats')],
  ['pandora_box_stats_and_gold_mix', i18n('pandoraStatsGoldMix')],
  ['pandora_box_army_high_tier', i18n('pandoraArmyHigh')],
  ['pandora_box_army_low_tier', i18n('pandoraArmyLow')],
  ['pandora_box_army', i18n('pandoraArmy')],
  ['pandora_box_exp', i18n('pandoraExp')],
  ['pandora_box_gold', i18n('pandoraGold')],
  ['pandora_box_magic_school', [i18n('pandoraBox'), i18n('magicSchool')]],
  ['pandora_box_magic_tier', [i18n('pandoraBox'), i18n('magicTier')]],
  ['pandora_box_magic', i18n('pandoraMagic')],
  ['pandora_box_units', i18n('pandoraUnits')],
  ['pandora_box_unit', i18n('pandoraUnits')],
  ['pandora_box', i18n('pandoraBox')],
  ['enchanted_scroll_box', i18n('enchantedScrollBox')],
  ['mythic_scroll_box', i18n('mythicScrollBox')],
  ['scroll_box', i18n('scrollBox')],
  ['pickup_random_items', i18n('randomItems')],
  ['pickup_prison', i18n('prison')],
  ['pickup', i18n('pickup')],
  ['all_stats', i18n('allStats')],
  ['all_default', i18n('allDefault')], // гипотеза
  ['stats_and_gold_mix', i18n('statsGoldMix')],
  // —— ресурсы / шахты / хранилища ——
  ['general_resources', i18n('generalResources')],
  ['basic_mines', i18n('basicMines')],
  ['rare_mines', i18n('rareMines')],
  ['special_mines', i18n('specialMines')],
  ['basic_resources', i18n('basicResources')],
  ['rare_resources', i18n('rareResources')],
  ['special_resources', i18n('specialResources')],
  ['basic_storage', i18n('basicStorage')],
  ['town_gates', i18n('townGates')],
  ['resources', i18n('resources')],
  ['resource', i18n('resources')],
  ['mines', i18n('mines')],
  ['gold', i18n('gold')],
  // —— богатство зоны (dust = «Алхимическая пыль» — официально) ——
  ['very_poor', i18n('veryPoor')],
  ['rich_no_scrolls', i18n('richNoScrolls')],
  ['dust_only', i18n('dustOnly')],
  ['poor', i18n('poor')],
  ['medium', i18n('medium')],
  ['rich', i18n('rich')],
  ['zero', i18n('zero')],
  // —— роли зон ——
  ['start_zone', i18n('startZone')],
  ['side_spawn_zone', i18n('sideSpawnZone')],
  ['second_spawn_zone', i18n('secondSpawnZone')],
  ['side2_zone', i18n('side2Zone')],
  ['side_zone', i18n('sideZone')],
  ['treasure_zone', i18n('treasureZone')],
  ['supertreasure_zone', i18n('superTreasureZone')],
  ['center_zone', i18n('centerZone')],
  ['connector_zone', i18n('connectorZone')],
  ['spawn_zone', i18n('spawnZone')],
  ['branch_zone', i18n('branchZone')],
  ['trunk_zone', i18n('trunkZone')],
  ['special_zones', i18n('specialZones')],
  ['big_treasure', i18n('bigTreasure')],
  ['center_treasure', i18n('centerTreasure')],
  ['corner_treasure', i18n('cornerTreasure')],
  ['super_treasure', i18n('superTreasure')],
  ['side_spawn', i18n('sideSpawn')],
  ['second_spawn', i18n('secondSpawn')],
  ['side_army', i18n('sideArmy')],
  ['side_gold', i18n('sideGold')],
  ['side2', i18n('side2')],
  ['supertreasure', i18n('superTreasure')],
  ['start', i18n('start')],
  ['side', i18n('side')],
  ['center', i18n('center')],
  ['connector', i18n('connector')],
  ['treasure', i18n('treasure')],
  ['spawn', i18n('spawn')],
  ['leafs', i18n('leafs')],
  ['branch', i18n('branch')],
  ['trunk', i18n('trunk')],
  ['zone', i18n('zone')],
  ['zones', i18n('zone')],
  // —— доп. токены (исторически добавлены сканом имён корневых групп 60 штатных
  //    шаблонов; остаются в словаре — greedy-матчу имён пулов/списков не вредят:
  //    напр. supertreasure_zone и leafs встречаются в настоящих content_pool_*) ——
  ['ai_spawns', i18n('aiSpawns')],
  ['player_spawn', i18n('playerSpawn')],
  ['small_treasure', i18n('smallTreasure')],
  ['side_treasure', i18n('sideTreasure')],
  ['supertreasures', i18n('superTreasure')],
  ['supercenter', i18n('supercenter')],
  ['treasures', i18n('treasure')],
  ['spawns', i18n('spawn')],
  ['sides', i18n('side')],
  ['country', i18n('country')], // гипотеза: «страна» (Zookeeper)
  ['leaf', i18n('leaf')],
  ['back', i18n('back')], // гипотеза: «тыл» (Harmony)
  ['empty', i18n('empty')],
  ['group', i18n('groupWord')],
  // —— цвета игроков (Sprint/Maneuvers/Maze) ——
  ['green', i18n('green')],
  ['red', i18n('red')],
  ['yellow', i18n('yellow')],
  ['blue', i18n('blue')],
  ['orange', i18n('orange')],
  ['violet', i18n('violet')],
  // —— профили random-пулов (переиспользуем poolTags.profile.*) ——
  ['unit_bank', tag('profile.unit_bank')],
  ['res_bank', tag('profile.res_bank')],
  ['base', tag('profile.base')],
  ['item', tag('profile.item')],
  ['pandora', tag('profile.pandora')],
  ['hire', tag('profile.hire')],
  ['stat', tag('profile.stat')],
  // —— прочее ——
  ['non_content', i18n('nonContent')], // гипотеза: служебные объекты (веса 0)
  ['random', tag('kind.random')],
  ['template', i18n('template')],
  ['objects', i18n('objects')],
  ['default', i18n('default')],
  ['general', i18n('general')],
  ['fix', i18n('fix')], // гипотеза: исправленный состав/веса
  ['equal', i18n('equal')], // гипотеза: равные веса
  ['pro', txt('pro')], // гипотеза: усиленная версия
  ['units', i18n('units')],
  ['unit', i18n('unit')],
  ['items', i18n('items')],
  ['stats', i18n('stats')],
  ['skills', i18n('skills')],
  ['spells', i18n('spells')],
  ['army', i18n('army')],
  ['exp', i18n('exp')],
  ['hires', i18n('hires')],
  ['scrolls', i18n('scrolls')],
  ['scroll', i18n('scroll')],
  ['buffs', i18n('heroBuffs')],
  ['buff', i18n('heroBuffs')],
  ['banks', i18n('banks')],
  ['bank', i18n('bank')],
  ['test', i18n('test')],
  ['pool', i18n('poolWord')],
  ['pools', i18n('poolWord')],
  ['list', i18n('listWord')],
  ['content', i18n('contentWord')],
]

// Фразы-имена шаблонов (латиница — официальных русских названий нет).
for (const [tpl, display] of Object.entries(TEMPLATES)) {
  PHRASES_RAW.push([tpl, txt(display)])
}

/** Фразы, отсортированные по убыванию длины (greedy longest-first). */
const PHRASES: Array<[string, PoolNamePart | PoolNamePart[]]> = [...PHRASES_RAW].sort(
  (a, b) => b[0].length - a[0].length,
)

const BANK_PAIR_RE = /^(.+_units_banks)_2_([1-7])_([1-7])$/

/**
 * Разложить имя пула/списка на смысловые части.
 * Неизвестный токен → null (UI показывает сырое имя как есть).
 */
export function humanizePoolName(name: string): PoolNamePart[] | null {
  if (!name) return null
  let rest = name
  const tail: PoolNamePart[] = []
  const pair = BANK_PAIR_RE.exec(name)
  if (pair) {
    rest = pair[1]
    tail.push({ type: 'bankPair', a: Number(pair[2]), b: Number(pair[3]) })
  }
  const parts: PoolNamePart[] = []
  let s = rest
  while (s.length > 0) {
    let matched = false
    for (const [ph, part] of PHRASES) {
      if (s === ph || s.startsWith(`${ph}_`)) {
        if (Array.isArray(part)) parts.push(...part)
        else parts.push(part)
        s = s.slice(ph.length + 1)
        matched = true
        break
      }
    }
    if (matched) continue
    // одиночный токен: t0–t5, tier+N, №N
    const cut = s.indexOf('_')
    const tok = cut === -1 ? s : s.slice(0, cut)
    const after = cut === -1 ? '' : s.slice(cut + 1)
    if (/^t[0-5]$/.test(tok)) {
      parts.push(txt(tok))
    } else if (tok === 'tier' && /^\d+$/.test(after.slice(0, after.indexOf('_') === -1 ? after.length : after.indexOf('_')))) {
      const n = after.slice(0, after.indexOf('_') === -1 ? after.length : after.indexOf('_'))
      parts.push({ type: 'i18n', key: 'poolNames.tierN', params: { n } })
      s = after.slice(n.length + 1)
      continue
    } else if (/^\d+$/.test(tok)) {
      parts.push({ type: 'i18n', key: 'poolNames.numN', params: { n: tok } })
    } else {
      return null // неизвестный токен — честно показываем сырое имя
    }
    s = after
    if (cut === -1) break
    if (s === '' && cut !== -1) break
  }
  parts.push(...tail)
  return parts
}
