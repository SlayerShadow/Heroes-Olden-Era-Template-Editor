import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Генератор каталога пулов контента для редактора.
 *
 * Читает распакованную базу игры (Core.zip) из core_db:
 *   generator/content_pools/*.json                  — пулы шаблонов и базовые
 *   generator/content_pools/random_pools/*.json     — случайные пулы t0–t5
 *   generator/content_pools/random_pools/classic_version/*.json — classic-зеркало
 *   generator/content_lists/*.json                  — списки контента (includeLists)
 * и пишет типизированный модуль src/data/poolCatalog.ts.
 *
 * Путь к core_db обязателен — аргументом или переменной окружения CORE_DB:
 *   node scripts/buildPools.mjs <путь-к-core_db>
 *   CORE_DB=<путь-к-core_db> node scripts/buildPools.mjs
 */

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const coreDb = process.argv[2] || process.env.CORE_DB
if (!coreDb) {
  console.error('Укажите путь к распакованной базе игры: аргумент или CORE_DB.')
  console.error('Пример: node scripts/buildPools.mjs C:/path/to/core_db')
  process.exit(1)
}
const poolsRoot = join(coreDb, 'generator', 'content_pools')
const listsRoot = join(coreDb, 'generator', 'content_lists')

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

function walkJson(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...walkJson(full))
    } else if (name.endsWith('.json')) {
      out.push(full)
    }
  }
  return out
}

function collectPools() {
  const pools = new Map()
  const files = walkJson(poolsRoot).filter((f) => !f.includes('_analysis'))
  for (const file of files) {
    let data
    try {
      data = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      console.warn('skip (broken json):', file)
      continue
    }
    const arr = Array.isArray(data)
      ? data
      : Object.values(data).filter(isObj)
    for (const p of arr) {
      if (!isObj(p) || typeof p.name !== 'string' || !p.name) continue
      if (!Array.isArray(p.groups)) continue
      const prev = pools.get(p.name)
      const key = JSON.stringify(p)
      if (prev && prev.key !== key) {
        console.warn('DUPLICATE pool name with different content:', p.name, file)
      }
      pools.set(p.name, { pool: p, key, src: file })
    }
  }
  return pools
}

function collectLists() {
  const lists = new Map()
  const files = walkJson(listsRoot)
  for (const file of files) {
    let data
    try {
      data = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      console.warn('skip (broken json):', file)
      continue
    }
    const arr = Array.isArray(data)
      ? data
      : Object.values(data).filter(isObj)
    for (const l of arr) {
      if (!isObj(l) || typeof l.name !== 'string' || !l.name) continue
      if (!Array.isArray(l.content)) continue
      const prev = lists.get(l.name)
      const key = JSON.stringify(l)
      if (prev && prev.key !== key) {
        console.warn('DUPLICATE list name with different content:', l.name, file)
      }
      lists.set(l.name, { list: l, key, src: file })
    }
  }
  return lists
}

function fmtContent(content) {
  if (!Array.isArray(content)) return undefined
  const out = []
  for (const c of content) {
    if (!isObj(c)) continue
    const e = { sid: String(c.sid ?? '') }
    if (typeof c.weight === 'number') e.weight = c.weight
    if (typeof c.biome === 'string' && c.biome) e.biome = c.biome
    out.push(e)
  }
  return out.length ? out : undefined
}

function normPool(p) {
  const out = { name: p.name }
  if (Array.isArray(p.priceBounds) && p.priceBounds.length) out.priceBounds = p.priceBounds
  if (Array.isArray(p.weights) && p.weights.length) out.weights = p.weights
  if (isObj(p.valueDistribution)) {
    if (Array.isArray(p.valueDistribution.priceBounds) && p.valueDistribution.priceBounds.length) {
      out.priceBounds = p.valueDistribution.priceBounds
    }
    if (Array.isArray(p.valueDistribution.weights) && p.valueDistribution.weights.length) {
      out.weights = p.valueDistribution.weights
    }
  }
  const groups = (p.groups ?? []).map((g) => {
    const og = { weight: typeof g.weight === 'number' ? g.weight : 1 }
    if (Array.isArray(g.includeLists) && g.includeLists.length) og.lists = g.includeLists
    const content = fmtContent(g.content)
    if (content) og.content = content
    return og
  })
  out.groups = groups
  if (Array.isArray(p.bans) && p.bans.length && p.bans.some((b) => typeof b === 'string')) {
    out.bans = p.bans.filter((b) => typeof b === 'string')
  }
  return out
}

function normList(l) {
  const out = { name: l.name }
  out.content = fmtContent(l.content) ?? []
  return out
}

function sortByName(a, b) {
  return a.name.localeCompare(b.name)
}

function main() {
  if (!existsDir(poolsRoot) || !existsDir(listsRoot)) {
    console.error(`Не найдена база игры: "${coreDb}". Распакуйте Core.zip в эту папку и проверьте путь.`)
    process.exit(1)
  }

  const pools = collectPools()
  const lists = collectLists()
  console.log(`пулов: ${pools.size}, списков: ${lists.size}`)

  const sortedPools = [...pools.values()].map((v) => normPool(v.pool)).sort(sortByName)
  const sortedLists = [...lists.values()].map((v) => normList(v.list)).sort(sortByName)

  const out = `// Файл генерируется автоматически: scripts/buildPools.mjs
// Источник — распакованная база игры (generator/content_pools, generator/content_lists).
// НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ.
export interface PoolGroupContent {
  sid: string
  weight?: number
  /** биом-специфичный вес (только в списках) */
  biome?: string
}

export interface PoolGroup {
  weight: number
  /** includeLists — имена content lists, чьи записи попадают в выбор */
  lists: string[]
  content?: PoolGroupContent[]
}

export interface ContentPool {
  name: string
  /** valueDistribution.priceBounds — границы корзин цены (value) */
  priceBounds?: number[]
  /** valueDistribution.weights — веса корзин (на 1 больше, чем priceBounds) */
  weights?: number[]
  groups: PoolGroup[]
  /** bans — запрещённые sid на уровне пула */
  bans?: string[]
}

export interface ContentList {
  name: string
  content: PoolGroupContent[]
}

export const POOLS: ContentPool[] = [
${sortedPools.map((p) => '  ' + JSON.stringify(p)).join(',\n')},
]

export const LISTS: ContentList[] = [
${sortedLists.map((l) => '  ' + JSON.stringify(l)).join(',\n')},
]

export const POOL_NAMES: readonly string[] = POOLS.map((p) => p.name)
export const LIST_NAMES: readonly string[] = LISTS.map((l) => l.name)

export const POOL_MAP: Readonly<Record<string, ContentPool>> = Object.fromEntries(
  POOLS.map((p) => [p.name, p]),
)

export const LIST_MAP: Readonly<Record<string, ContentList>> = Object.fromEntries(
  LISTS.map((l) => [l.name, l]),
)
`

  const dest = join(root, 'src', 'data', 'poolCatalog.ts')
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