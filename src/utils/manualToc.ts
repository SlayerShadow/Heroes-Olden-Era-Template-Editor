/**
 * Оглавление мануала: чистая функция, строящая дерево глав и заголовков
 * (конвенция слоя utils/: без React, без DOM, без side-эффектов).
 */
import type { MarkdownHeading } from './markdown'

export type ManualTocNode = {
  /** id элемента-цели: у главы — slug секции, у заголовка — якорь `<slug>--<id>` */
  id: string
  text: string
  children: ManualTocNode[]
}

export type ManualToc = {
  chapters: ManualTocNode[]
  /** id узла → id родительского узла (для автораскрытия при прокрутке) */
  parentOf: Map<string, string>
  /** якорь заголовка в HTML → id узла оглавления (h1 главы → узел главы) */
  nodeByHeading: Map<string, string>
}

/** Дерево оглавления: глава (H1) — корень, H2–H4 — вложенные узлы по уровням. */
export function buildManualToc(
  chapters: { slug: string; title: string; headings: MarkdownHeading[] }[],
): ManualToc {
  const parentOf = new Map<string, string>()
  const nodeByHeading = new Map<string, string>()
  const roots = chapters.map((ch) => {
    const root: ManualTocNode = { id: ch.slug, text: ch.title, children: [] }
    const stack: ManualTocNode[] = [root]
    const levels: number[] = [1]
    ch.headings.forEach((h, idx) => {
      if (idx === 0 && h.level === 1) {
        // Первый H1 — это заголовок самой главы, его представляет корень
        nodeByHeading.set(h.id, root.id)
        return
      }
      while (stack.length > 1 && levels[levels.length - 1] >= h.level) {
        stack.pop()
        levels.pop()
      }
      const node: ManualTocNode = { id: h.id, text: h.text, children: [] }
      parentOf.set(node.id, stack[stack.length - 1].id)
      stack[stack.length - 1].children.push(node)
      stack.push(node)
      levels.push(h.level)
      nodeByHeading.set(h.id, node.id)
    })
    return root
  })
  return { chapters: roots, parentOf, nodeByHeading }
}
