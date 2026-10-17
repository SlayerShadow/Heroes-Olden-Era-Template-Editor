import { readFileSync, writeFileSync, statSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Генератор каталога официальных имён объектов для редактора (ru + en).
 *
 * Читает распакованную базу игры (Core.zip) из core_db:
 *   Lang/<locale>/texts/*.json — файлы локализации вида { tokens: [{ sid, text }] }.
 * Токены с sid вида `<object_sid>_name` дают официальное имя объекта.
 * Локали: russian → SID_NAMES_RU, english → SID_NAMES_EN (раскладка файлов и
 * набор токенов в них совпадают; паритет ключей каталогов фиксирует тест
 * src/data/sidCatalog.test.ts).
 *
 * Берутся только «объектные» файлы (WHITELIST ниже) — ui/menu/tutorial/dialogues и т.п.
 * содержат служебные строки интерфейса, а не имена объектов карты.
 *
 * Дополнительно (имена, которых нет в виде токенов `<sid>_name`):
 *   1. Герои: id из DB/heroes/<подпапка>/<id>.json; имя — «голой» токен <id>
 *      в heroInfo.json (без суффикса _name; суффиксные токены _motto/_description/
 *      _spec_* — не имена). Часть campaign/tutorial-героев имён не имеет — пропускаются.
 *   2. Свитки заклинаний: id из DB/items/items/*.json вида
 *      `[enchanted_|mythic_]magic_scroll_artifact_<spellId>` — личного токена имени
 *      не имеют; в игре отображаются как «<scroll_box_name>: <имя заклинания>»
 *      (artifacts.json + magic.json), так и собираются.
 *      Ловушка: у заклинания некромантии sid (change_use_necromancy) не совпадает
 *      с префиксом name-токена (neutral_1_magic_...) — см. MAGIC_NAME_ALIAS.
 *
 * Пишет типизированный модуль src/data/sidNames.ts (SID_NAMES_RU / SID_NAMES_EN: sid → имя).
 * Новые локали — дописывать в LOCALES (Lang/<dir>/texts).
 *
 * Путь к core_db обязателен — аргументом или переменной окружения CORE_DB:
 *   node scripts/buildSidNames.mjs <путь-к-core_db>
 *   CORE_DB=<путь-к-core_db> node scripts/buildSidNames.mjs
 */

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const coreDb = process.argv[2] || process.env.CORE_DB
if (!coreDb) {
  console.error('Укажите путь к распакованной базе игры: аргумент или CORE_DB.')
  console.error('Пример: node scripts/buildSidNames.mjs C:/path/to/core_db')
  process.exit(1)
}

/** Локали имени: dir — папка Lang/<dir>/texts, ident — суффикс экспорта SID_NAMES_<ident>. */
const LOCALES = [
  { dir: 'russian', ident: 'RU' },
  { dir: 'english', ident: 'EN' },
]

/** «Объектные» файлы локализации (имена карт-объектов, артефактов, юнитов, героев, магии, законов). */
const WHITELIST = [
  'artifacts.json',
  'cities.json',
  'factionLaws.json',
  'heroInfo.json',
  'heroSkills.json',
  'magic.json',
  'mapObjects.json',
  'unitsAbility.json',
]

const NAME_SUFFIX = '_name'

/** sid заклинания → токен имени, когда они не совпадают механически (см. шапку). */
const MAGIC_NAME_ALIAS = { change_use_necromancy: 'neutral_1_magic_change_use_necromancy' }
/** Паттерн sid свитков: [префикс_]magic_scroll_artifact_<spellId>. */
const SCROLL_RE = /^([a-z_]*?)magic_scroll_artifact_(.+)$/

function readTokens(textsDir, file) {
  const full = join(textsDir, file)
  let data
  try {
    data = JSON.parse(readFileSync(full, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return new Map()
  }
  const m = new Map()
  for (const tok of Array.isArray(data?.tokens) ? data.tokens : []) {
    if (tok && typeof tok.sid === 'string' && typeof tok.text === 'string' && !m.has(tok.sid)) {
      m.set(tok.sid, tok.text)
    }
  }
  return m
}

/** Имена файлов *.json в папке как id (без расширения), детерминированно отсортированные. */
function listIds(dir) {
  let files
  try {
    files = readdirSync(dir)
  } catch {
    return []
  }
  return files
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => f.slice(0, -'.json'.length))
}

function collectNames(textsDir) {
  const names = new Map()
  for (const file of WHITELIST) {
    const full = join(textsDir, file)
    let data
    try {
      data = JSON.parse(readFileSync(full, 'utf8').replace(/^\uFEFF/, ''))
    } catch (e) {
      console.warn('skip (broken json):', full, String(e))
      continue
    }
    const tokens = Array.isArray(data?.tokens) ? data.tokens : []
    for (const tok of tokens) {
      if (!tok || typeof tok.sid !== 'string' || typeof tok.text !== 'string') continue
      if (!tok.sid.endsWith(NAME_SUFFIX)) continue
      const base = tok.sid.slice(0, -NAME_SUFFIX.length)
      if (!base) continue
      const prev = names.get(base)
      if (prev != null && prev !== tok.text) {
        console.warn(`DUPLICATE name for "${base}": keeping "${prev}", ignoring "${tok.text}" (${file})`)
        continue
      }
      names.set(base, tok.text)
    }
  }
  return names
}

/** sid героев: id файлов из DB/heroes/<подпапка>; имя — только если есть «голой» токен в heroInfo.json. */
function collectHeroNames(names, textsDir) {
  const heroRoot = join(coreDb, 'DB', 'heroes')
  const info = readTokens(textsDir, 'heroInfo.json')
  let subdirs
  try {
    subdirs = readdirSync(heroRoot)
      .filter((d) => {
        try {
          return statSync(join(heroRoot, d)).isDirectory()
        } catch {
          return false
        }
      })
      .sort()
  } catch {
    console.warn('skip heroes: нет папки DB/heroes')
    return
  }
  let added = 0
  for (const sub of subdirs) {
    for (const id of listIds(join(heroRoot, sub))) {
      const text = info.get(id)
      if (text == null) continue // безымянные (campaign/tutorial) — пропускаем
      const prev = names.get(id)
      if (prev != null && prev !== text) {
        console.warn(`DUPLICATE name for "${id}": keeping "${prev}", ignoring "${text}" (heroInfo.json)`)
        continue
      }
      names.set(id, text)
      added++
    }
  }
  return added
}

/** id предметов из DB/items/items/*.json — файлы вида { array: [{ id, ... }] } (по слотам). */
function listItemIds() {
  const dir = join(coreDb, 'DB', 'items', 'items')
  let files
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  } catch {
    return []
  }
  const ids = []
  for (const f of files) {
    let data
    try {
      data = JSON.parse(readFileSync(join(dir, f), 'utf8').replace(/^\uFEFF/, ''))
    } catch {
      continue
    }
    for (const it of Array.isArray(data?.array) ? data.array : []) {
      if (it && typeof it.id === 'string') ids.push(it.id)
    }
  }
  return ids
}

/** Имена свитков заклинаний: id из DB/items/items, «<коробка>: <заклинание>». */
function collectScrollNames(names, textsDir) {
  const artifacts = readTokens(textsDir, 'artifacts.json')
  const magic = readTokens(textsDir, 'magic.json')
  const ids = listItemIds()
  if (ids.length === 0) {
    console.warn('skip scrolls: нет предметов в DB/items/items')
    return 0
  }
  let added = 0
  for (const id of ids) {
    const m = SCROLL_RE.exec(id)
    if (!m) continue
    const [, prefix, spellId] = m
    const base = artifacts.get(`${prefix}scroll_box_name`)
    const spell = magic.get(`${MAGIC_NAME_ALIAS[spellId] ?? spellId}_name`)
    if (base == null || spell == null) {
      console.warn('skip scroll (no name):', id, base == null ? 'нет scroll_box_name' : '', spell == null ? 'нет имени заклинания' : '')
      continue
    }
    names.set(id, `${base}: ${spell}`)
    added++
  }
  return added
}

/** Каталог имён одной локали: Lang/<dir>/texts → Map(sid → имя). */
function buildLocale(locale) {
  const textsDir = join(coreDb, 'Lang', locale.dir, 'texts')
  if (!existsDir(textsDir)) {
    console.error(`Не найдена база игры: "${textsDir}". Распакуйте Core.zip в эту папку и проверьте путь.`)
    process.exit(1)
  }
  const names = collectNames(textsDir)
  const heroes = collectHeroNames(names, textsDir)
  const scrolls = collectScrollNames(names, textsDir)
  const sorted = [...names.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  console.log(`${locale.dir}: имён ${sorted.length} (героев ${heroes}, свитков ${scrolls}, файлов ${WHITELIST.length})`)
  return sorted
}

function main() {
  const locales = LOCALES.map((l) => ({ ...l, sorted: buildLocale(l) }))

  const body = locales
    .map(
      (l) => `/** Официальные ${l.dir === 'russian' ? 'русские' : 'английские'} имена объектов игры: sid → имя. */
export const SID_NAMES_${l.ident}: Readonly<Record<string, string>> = {
${l.sorted.map(([sid, text]) => `  ${JSON.stringify(sid)}: ${JSON.stringify(text)}`).join(',\n')},
}`,
    )
    .join('\n\n')

  const out = `// Файл генерируется автоматически: scripts/buildSidNames.mjs
// Источник — распакованная база игры (Lang/russian|english/texts/*.json, токены <sid>_name;
// плюс имена героев из heroInfo.json и составные имена свитков из DB/items).
// НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ.

${body}
`

  const dest = join(root, 'src', 'data', 'sidNames.ts')
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, out, 'utf8')
  console.log(`written: ${dest} (${(statSync(dest).size / 1024).toFixed(1)} KB)`)
}

function existsDir(p) {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

main()
