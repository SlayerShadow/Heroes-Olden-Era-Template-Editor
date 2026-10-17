/**
 * Фиксированные каталоги пресетов/имён для редактора.
 * Чистые данные, без зависимостей — используются и чистым валидатором
 * (src/utils/validate.ts), и компонентами-инспекторами (PresetSelect и др.).
 *
 * Пресеты застройки/банлистов собраны из core_db
 * (`DB/buildings_constructions/*.json`, `DB/buildings_bans/*.json`).
 */

/** Каталог пресетов застройки (`buildingsConstructionSid`), алфавитный порядок. */
export const BUILDINGS_CONSTRUCTION_PRESETS: string[] = [
  'M10_dungeon_city',
  'M2_dungeon_city',
  'M2_sylvan_city',
  'M3_ai_human_city',
  'M3_ai_human_city_1',
  'M3_ai_undead_city',
  'M3_human_city',
  'M3_human_city_1',
  'M3_undead_city',
  'M4_ai_human_city',
  'M4_ai_sylvan_city',
  'M4_druid_city',
  'M4_human_city',
  'M4_sylvan_city',
  'M5_undead_city',
  'M9_antagonist_city',
  'M9_dungeon_treasury_city',
  'M9_galthran_city',
  'M9_starting_city',
  'Tutorial_C1_buildlist',
  'Tutorial_C2_buildlist',
  'Tutorial_C3_buildlist',
  'Tutorial_C5_buildlist',
  'Tutorial_C6_buildlist',
  'Tutorial_C8_buildlist',
  'Tutorial_buildlist_1',
  'Tutorial_buildlist_2',
  'arcade_buildings_construction',
  'army_buildings_construction',
  'ba_buildings_construction_1',
  'ba_buildings_construction_2',
  'chosen_one_buildings_construction',
  'chosen_one_buildings_construction_up_1',
  'chosen_one_buildings_construction_up_2',
  'chosen_one_buildings_construction_up_3',
  'default_buildings_construction',
  'exodus_extra_rich_buildings_construction',
  'exodus_poor_buildings_construction',
  'extra_rich_buildings_construction',
  'full_buildings_construction',
  'if_buildings_construction_1',
  'if_buildings_construction_2',
  'jebus_cross_center_buildings_construction',
  'jebus_cross_side_buildings_construction',
  'jebus_cross_side_center_buildings_construction',
  'jebus_cross_side_main_buildings_construction',
  'jebus_tournament_center_buildings_construction',
  'jebus_tournament_side_buildings_construction',
  'jebus_tournament_side_center_buildings_construction',
  'jebus_tournament_side_main_buildings_construction',
  'massacre_buildings_construction',
  'massacre_buildings_construction_up_1',
  'massacre_buildings_construction_up_2',
  'massacre_buildings_construction_up_3',
  'medium_buildings_construction',
  'only_mage_guild',
  'poor_buildings_construction',
  'rich_buildings_construction',
  'siege_buildings_construction',
  'ultra_rich_buildings_construction',
]

/**
 * Известные битые ссылки пресетов застройки в штатных шаблонах.
 * Игра переносит их молча — их нет в каталоге,
 * и валидатор помечает их предупреждением (не ошибкой).
 */
export const KNOWN_BROKEN_CONSTRUCTION_PRESETS: string[] = [
  'bank_and_gm_buildings_construction',
  'bank_buildings_construction',
  'extra_poor_buildings_construction',
  'sprint_green_buildings_construction',
  'sprint_orange_buildings_construction',
]

/** Каталог пресетов банлистов (`buildingsBanSid`), алфавитный порядок. */
export const BUILDINGS_BAN_PRESETS: string[] = [
  'M10_dungeon_city',
  'M2_dungeon_city',
  'M2_sylvan_city',
  'M3_abandoned_outpost',
  'M3_ai_human_city',
  'M3_ai_human_city_1',
  'M3_ai_undead_city',
  'M3_human_city',
  'M3_human_city_1',
  'M3_undead_city',
  'M4_ai_human_city',
  'M4_ai_sylvan_city',
  'M4_druid_city',
  'M4_human_city',
  'M4_sylvan_city',
  'M5_undead_city',
  'M9_antagonist_city',
  'M9_dungeon_treasury_city',
  'M9_starting_city',
  'Tutorial_C1_banlists',
  'Tutorial_C2_banlists',
  'Tutorial_C3_banlists',
  'Tutorial_C5_banlists',
  'Tutorial_C6_banlists',
  'Tutorial_C8_banlists',
  'Tutorial_M2_banlists',
  'Tutorial_banlists',
  'ba_buildings_ban_1',
  'ba_buildings_ban_2',
  'campaign_default_buildings_ban',
  'default_buildings_ban',
  'economic_buildings_ban',
  'exodus_poor_buildings_banlist',
  'if_buildings_ban_1',
  'if_buildings_ban_2',
  'magic_buildings_ban',
  'only_mage_guild',
  'prison_buildings_ban',
  'somm_buildings_ban_1',
  'tmi_general_ban',
  'tmi_res_generation_ban',
]

/** Фракции Heroes of Might and Magic: Olden Era (ровно 5). */
export const FACTION_NAMES: readonly string[] = ['human', 'demon', 'dungeon', 'nature', 'unfrozen']

/** Имена биомов карты Olden Era (ровно 7). */
export const BIOME_NAMES: readonly string[] = ['Snow', 'Grass', 'Dirt', 'Autumn', 'Lava', 'Deathland', 'Sand']