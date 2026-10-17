import { SID_NAMES_EN, SID_NAMES_RU } from './sidNames'

/** Язык каталога имён sid (не путать с локалью интерфейса: каталог поддерживает ru/en). */
export type SidNameLang = 'ru' | 'en'

/** Нормализация i18n.language в язык каталога имён: en-теги → 'en', остальное → 'ru'. */
export function sidNameLang(language: string | undefined): SidNameLang {
  return language && language.toLowerCase().split('-')[0] === 'en' ? 'en' : 'ru'
}

export interface SidInfo {
  sid: string
  /** Русская подсказка (curated). */
  hint?: string
  /** Английская подсказка — только для RE-подписей, у которых нет официального <sid>_name-токена в Lang. */
  hintEn?: string
}

// Подсказки для sid. Два источника:
// 1) официальные имена объектов из локализации игры (core_db:
//    Lang/russian/texts / Lang/english/texts, распаковка Core.zip; записи сверены
//    с игрой — совпадают) — генерируемый каталог sidNames.ts;
// 2) в конце списка — подписи, выведенные реверс-инжинирингом, для специальных
//    генераторных sid, у которых официальных <sid>_name-токенов в Lang НЕТ
//    (проверено: все 13717 токенов Lang/russian/texts; для en — тот же набор).
//    Для них curated-подпись нужна в обеих языках: ru — hint, en — hintEn.
//    Остальные записи блока 1 дублируют официальные русские имена (исторически —
//    курируемый источник до генератора); для en ветка берёт имя из SID_NAMES_EN.
export const SID_CATALOG: SidInfo[] = [
  { sid: 'pandora_box', hint: 'Ящик Пандоры' },
  { sid: 'mine_gold', hint: 'Золотая шахта' },
  { sid: 'mine_wood', hint: 'Лесопилка' },
  { sid: 'mine_ore', hint: 'Рудная шахта' },
  { sid: 'mine_mercury', hint: 'Ртутная расселина' },
  { sid: 'mine_crystals', hint: 'Жила кристаллов' },
  { sid: 'mine_gemstones', hint: 'Рудник драгоценных камней' },
  { sid: 'alchemy_lab', hint: 'Лаборатория алхимиков' },
  { sid: 'watchtower', hint: 'Наблюдательная вышка' },
  { sid: 'mana_well', hint: 'Колодец' },
  { sid: 'mythic_scroll_box', hint: 'Мифический магический свиток' },
  { sid: 'prison', hint: 'Клетка с героем' },
  { sid: 'remote_foothold', hint: 'Опорный пункт' },
  { sid: 'mystical_tower', hint: 'Алтарь озарения' },
  { sid: 'market', hint: 'Рынок' },
  { sid: 'forge', hint: 'Кузня Второго человека' },
  { sid: 'town_gate', hint: 'Врата в город' },
  { sid: 'mirage', hint: 'Мираж' },
  { sid: 'fountain', hint: 'Фонтан' },
  { sid: 'tree_of_abundance', hint: 'Древо изобилия' },
  { sid: 'university', hint: 'Университет' },
  { sid: 'tavern', hint: 'Таверна' },
  { sid: 'orb_observatory', hint: 'Обсерватория четырёх мудрецов' },
  { sid: 'research_laboratory', hint: 'Исследовательская лаборатория' },
  { sid: 'eternal_dragon', hint: 'Предвечный дракон' },
  { sid: 'unstable_ruins', hint: 'Заросшие руины вори' },
  { sid: 'dragon_utopia', hint: 'Утопия драконов' },
  { sid: 'college_of_wonder', hint: 'Монастырь в горах' },
  { sid: 'monty_hall', hint: 'Монти-Холл' },
  { sid: 'shady_den', hint: 'Хижина охотника за трофеями' },
  { sid: 'mercenary_guild', hint: 'Гильдия наёмников' },
  { sid: 'stables', hint: 'Конюшни' },
  { sid: 'arena', hint: 'Арена славы' },
  { sid: 'circus', hint: 'Странствующий цирк' },
  { sid: 'wind_rose', hint: 'Роза ветров' },
  { sid: 'sacrificial_shrine', hint: 'Жертвенный алтарь' },
  { sid: 'beer_fountain', hint: 'Пивной фонтанчик' },
  { sid: 'quixs_path', hint: 'Алтарь Кииха' },
  { sid: 'crystal_trail', hint: 'След дракона' },
  { sid: 'celestial_sphere', hint: 'Шпиль небесный' },
  { sid: 'tear_of_truth', hint: 'Слеза истины' },
  { sid: 'ritual_pyre', hint: 'Ритуальный костёр' },
  { sid: 'petrified_memorial', hint: 'Памятник окаменевшим' },
  { sid: 'boreal_call', hint: 'Борейский призыв' },
  { sid: 'jousting_range', hint: 'Колизей' },
  { sid: 'the_gorge', hint: 'Гора мяса' },
  { sid: 'unforgotten_grave', hint: 'Гробница неупокоенных' },
  { sid: 'point_of_balance', hint: 'Точка равновесия' },
  // Заклинание с name-токеном, не совпадающим с id: id — change_use_necromancy,
  // токен — neutral_1_magic_change_use_necromancy_name (сверка через алиас в скрипте;
  // поэтому ключа change_use_necromancy в генерируемых каталогах нет — en-имя здесь
  // curated, официальный текст токена: «Necromancer Will»).
  { sid: 'change_use_necromancy', hint: 'Воля некроманта', hintEn: 'Necromancer Will' },
  // —— RE-подписи (официальных имён в Lang нет в обеих локалях; источник фактов — у каждой записи). ——
  // fountain_2 — реальный объект: DB/map/objects/4_interactables.json явно переопределяет
  // name-токен на fountain_name, т.е. в игре объект отображается как «Фонтан» (как fountain);
  // en — официальный текст fountain_name («Fountain»).
  { sid: 'fountain_2', hint: 'Фонтан', hintEn: 'Fountain' },
  // random_item_* — generator/generator_config.json → metaObjects, type RandomItem,
  // args = редкость (Common/Rare/Epic/Legendary). Термины редкости — официальные
  // (Lang/.../texts/artifacts.json: artifactRarity_*_ITEM_SLOT = Обычный/Редкий/Эпический/
  // Легендарный предмет и Common/Rare/Epic/Legendary Item), префикс «Случайный/Random» —
  // перевод type RandomItem.
  { sid: 'random_item_common', hint: 'Случайный обычный предмет', hintEn: 'Random Common Item' },
  { sid: 'random_item_rare', hint: 'Случайный редкий предмет', hintEn: 'Random Rare Item' },
  { sid: 'random_item_epic', hint: 'Случайный эпический предмет', hintEn: 'Random Epic Item' },
  { sid: 'random_item_legendary', hint: 'Случайный легендарный предмет', hintEn: 'Random Legendary Item' },
  // random_hire_1..7 — metaObjects, type RandomHire, args = ярус 1..7 (здания внешнего найма
  // существ; составы списков content_list_building_random_hires*_tier подтверждают ярусы).
  // Терминология — как в разделе редактора «Внешний найм (random_hire 1–7)»
  // (en-локаль интерфейса: «External hire (random_hire 1–7)»).
  { sid: 'random_hire_1', hint: 'Внешний найм · ярус 1', hintEn: 'External hire · tier 1' },
  { sid: 'random_hire_2', hint: 'Внешний найм · ярус 2', hintEn: 'External hire · tier 2' },
  { sid: 'random_hire_3', hint: 'Внешний найм · ярус 3', hintEn: 'External hire · tier 3' },
  { sid: 'random_hire_4', hint: 'Внешний найм · ярус 4', hintEn: 'External hire · tier 4' },
  { sid: 'random_hire_5', hint: 'Внешний найм · ярус 5', hintEn: 'External hire · tier 5' },
  { sid: 'random_hire_6', hint: 'Внешний найм · ярус 6', hintEn: 'External hire · tier 6' },
  { sid: 'random_hire_7', hint: 'Внешний найм · ярус 7', hintEn: 'External hire · tier 7' },
]

export const SID_SUGGESTIONS = SID_CATALOG.map((s) => s.sid)

/**
 * Подсказка для sid в языке каталога `lang`: сначала курируемый SID_CATALOG
 * (ru — hint, en — hintEn для RE-подписей), затем сгенерированный каталог
 * официальных имён из core_db (scripts/buildSidNames.mjs).
 * В ветке 'en' при отсутствии имени — undefined, а НЕ русское имя: иначе
 * в en-интерфейсе вновь протекает кириллица (UI тогда показывает сырой sid).
 */
export function sidHint(sid: string | undefined, lang: SidNameLang): string | undefined {
  if (!sid) return undefined
  const found = SID_CATALOG.find((s) => s.sid === sid)
  if (lang === 'en') return found?.hintEn ?? SID_NAMES_EN[sid]
  return found?.hint ?? SID_NAMES_RU[sid]
}

/**
 * Каталог подсказок для выпадающих списков полей sid (ComboInput):
 * value — сырой sid, label — читаемое имя на языке каталога (sidHint).
 * Структурно совместим с ComboSuggestion из components/editors/fields.
 * Функция, а не модульная константа: подписи зависят от активной локали
 * и должны пересчитываться при её смене (ремоунт/ререндер компонентов).
 */
export function sidOptions(lang: SidNameLang): { value: string; label?: string }[] {
  return SID_SUGGESTIONS.map((s) => ({ value: s, label: sidHint(s, lang) }))
}
