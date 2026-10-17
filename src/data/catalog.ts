import type { ContentList, ContentPool } from './poolCatalog'

export interface Catalog {
  pools: ContentPool[]
  lists: ContentList[]
  poolMap: Readonly<Record<string, ContentPool>>
  listMap: Readonly<Record<string, ContentList>>
  poolNames: string[]
  listNames: string[]
}

let cached: Promise<Catalog> | null = null

/** Лениво подгружает каталог пулов/списков (отдельный chunk благодаря dynamic import). */
export function loadCatalog(): Promise<Catalog> {
  if (!cached) {
    cached = import('./poolCatalog').then((m) => ({
      pools: m.POOLS,
      lists: m.LISTS,
      poolMap: m.POOL_MAP,
      listMap: m.LIST_MAP,
      poolNames: [...m.POOL_NAMES],
      listNames: [...m.LIST_NAMES],
    }))
  }
  return cached
}