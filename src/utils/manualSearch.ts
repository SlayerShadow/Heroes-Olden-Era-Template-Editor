/**
 * Поиск по мануалу: фильтрация оглавления и подсветка совпадений.
 *
 * Чистый слой (конвенция utils/): без React и DOM, функции принимают данные
 * и возвращают данные; перевод строк — забота UI-слоя.
 *
 * Фильтрация начинается с `MIN_SEARCH_LEN` символов (оптимизация: запрос
 * короче не отсеивает ничего и оглавление показывается целиком).
 * Семантика дерева — «предки + всё поддерево»:
 * - узел совпал (запрос в заголовке ИЛИ в тексте раздела) → остаётся со ВСЕМИ детьми;
 * - узел не совпал, но совпал потомок → остаётся как путь, но только с ветвями к совпадениям;
 * - не совпал ни узел, ни потомки → ветка вырезается.
 */
import type { ManualTocNode } from './manualToc'

/** Минимальная длина запроса (после trim), с которой начинается фильтрация. */
export const MIN_SEARCH_LEN = 2

/**
 * Поисковый индекс: id узла оглавления → plain-текст его раздела.
 *
 * `sectionTexts` — по одному `RenderedMarkdown['sectionText']` на главу
 * (ключи — id якорей заголовков вида `<slug>--<localId>`). Якорь H1 главы
 * в оглавлении представлен корневым узлом главы (id = slug), поэтому
 * ключи якорей переводятся в id узлов через `nodeByHeading`; якоря,
 * которых в маппинге нет (теоретически), используются как есть.
 */
export function buildNodeTextIndex(
  sectionTexts: Record<string, string>[],
  nodeByHeading: ReadonlyMap<string, string>,
): Map<string, string> {
  const index = new Map<string, string>()
  for (const sectionText of sectionTexts) {
    for (const [anchorId, text] of Object.entries(sectionText)) {
      const nodeId = nodeByHeading.get(anchorId) ?? anchorId
      index.set(nodeId, text)
    }
  }
  return index
}

/** Узел совпал: запрос в заголовке ИЛИ в тексте раздела (регистронезависимо). */
function nodeMatches(node: ManualTocNode, nodeText: ReadonlyMap<string, string>, q: string): boolean {
  if (node.text.toLowerCase().includes(q)) return true
  return nodeText.get(node.id)?.toLowerCase().includes(q) ?? false
}

/** Рекурсивная фильтрация ветки; null — ветка вырезается целиком. */
function filterNode(
  node: ManualTocNode,
  nodeText: ReadonlyMap<string, string>,
  q: string,
): ManualTocNode | null {
  // Совпал сам — остаётся со всем поддеревом (по ссылке, без копирования детей)
  if (nodeMatches(node, nodeText, q)) return node
  const kept = node.children
    .map((c) => filterNode(c, nodeText, q))
    .filter((c): c is ManualTocNode => c !== null)
  return kept.length > 0 ? { ...node, children: kept } : null
}

/**
 * Отфильтровать главы оглавления по запросу.
 * Запрос короче `MIN_SEARCH_LEN` (или пустой) → исходные главы (та же ссылка).
 */
export function filterManualToc(
  chapters: ManualTocNode[],
  nodeText: ReadonlyMap<string, string>,
  query: string,
): ManualTocNode[] {
  const q = query.trim().toLowerCase()
  if (q.length < MIN_SEARCH_LEN) return chapters
  return chapters
    .map((ch) => filterNode(ch, nodeText, q))
    .filter((ch): ch is ManualTocNode => ch !== null)
}

/** Сегмент текста заголовка для подсветки: match — вхождение запроса. */
export type HighlightSegment = { text: string; match: boolean }

/**
 * Разбить текст заголовка на сегменты «совпадение / не совпадение»
 * (регистронезависимо, все вхождения). Исходный регистр сохраняется.
 * Запрос короче `MIN_SEARCH_LEN` → один non-match сегмент (без подсветки).
 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const needle = query.trim().toLowerCase()
  if (needle.length < MIN_SEARCH_LEN) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const segments: HighlightSegment[] = []
  let pos = 0
  for (;;) {
    const idx = lower.indexOf(needle, pos)
    if (idx === -1) break
    if (idx > pos) segments.push({ text: text.slice(pos, idx), match: false })
    segments.push({ text: text.slice(idx, idx + needle.length), match: true })
    pos = idx + needle.length
  }
  if (pos < text.length) segments.push({ text: text.slice(pos), match: false })
  return segments.length > 0 ? segments : [{ text, match: false }]
}
