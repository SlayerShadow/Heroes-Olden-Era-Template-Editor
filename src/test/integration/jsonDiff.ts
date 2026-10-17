/**
 * Глубокое сравнение двух JSON-значений с подробным диффом.
 *
 * Зачем не `expect(a).toEqual(b)`: при расхождении с эталоном нужно точно знать,
 * ЧТО и ГДЕ разошлось (путь в структуре, факт/эталон), а не «объекты не равны».
 *
 * Особенности:
 * - порядок ключей объектов не важен (JSON-объект неупорядочен);
 * - массивы элементов с устойчивыми ключами (зоны/группы — `name`, связи —
 *   `name ?? from-to`) сопоставляются ПО КЛЮЧУ: расхождение порядка выводится
 *   отдельной записью kind='order', а содержимое сравнивается попарно
 *   (порядок зон/связей в .rmg.json на семантику игры не влияет, но для
 *   «чётко повторяет файл» важен — поэтому фиксируется отдельно);
 * - прочие массивы (mainObjects, roads, args, …) сравниваются по индексам:
 *   порядок элементов в них значим (номер главного объекта — адрес ссылки).
 */

export type DiffKind = 'value' | 'missing' | 'extra' | 'order'

export interface DiffOptions {
  /**
   * Пути (regex по полному пути) массивов, где порядок элементов НЕ сравнивается:
   * элементы сопоставляются по ключу, количество и наполнение каждого — строго
   * (решение пользователя от 04.10.2026: порядок zones[]/connections[] в .rmg.json
   * на семантику игры не влияет).
   */
  orderFree?: RegExp[]
}

export interface DiffEntry {
  /** Путь от корня: `$`, `$.gameRules.heroCountMax`, `$.variants[0].zones[Center].size`. */
  path: string
  kind: DiffKind
  /** Значение в эталоне (для value/missing). */
  expected?: unknown
  /** Значение в фактическом результате (для value/extra). */
  actual?: unknown
  /** Для order: порядок ключей факта и эталона. */
  actualOrder?: string[]
  expectedOrder?: string[]
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Ключ массива-элемента для порядка-независимого сопоставления:
 * имя (зоны, группы, лэйауты) или канонический id связи (`name ?? from-to`,
 * как в graph.ts/roads.ts). Null — элемент без устойчивого ключа.
 */
function keyOf(el: unknown): string | null {
  if (!isPlainObject(el)) return null
  if (typeof el.name === 'string' && el.name !== '') return el.name
  if (typeof el.from === 'string' && typeof el.to === 'string') return `${el.from}-${el.to}`
  return null
}

const fmt = (v: unknown): string => JSON.stringify(v) ?? String(v)

export function deepDiff(
  actual: unknown,
  expected: unknown,
  path = '$',
  opts: DiffOptions = {},
): DiffEntry[] {
  const out: DiffEntry[] = []

  if (Array.isArray(actual) && Array.isArray(expected)) {
    const aKeys = actual.map(keyOf)
    const eKeys = expected.map(keyOf)
    const keyed =
      actual.length > 0 &&
      expected.length > 0 &&
      aKeys.every((k): k is string => k !== null) &&
      eKeys.every((k): k is string => k !== null) &&
      new Set(aKeys).size === actual.length &&
      new Set(eKeys).size === expected.length
    if (keyed) {
      const ak = aKeys as string[]
      const ek = eKeys as string[]
      const sameSet = ak.length === ek.length && ek.every((k) => ak.includes(k))
      const orderFree = (opts.orderFree ?? []).some((re) => re.test(path))
      if (sameSet && !orderFree && ak.join('\u0000') !== ek.join('\u0000')) {
        out.push({ path, kind: 'order', actualOrder: ak, expectedOrder: ek })
      }
      for (const k of ek) {
        if (!ak.includes(k)) {
          out.push({ path: `${path}[${k}]`, kind: 'missing', expected: expected[ek.indexOf(k)] })
        }
      }
      for (const k of ak) {
        if (!ek.includes(k)) {
          out.push({ path: `${path}[${k}]`, kind: 'extra', actual: actual[ak.indexOf(k)] })
        }
      }
      for (const k of ek) {
        const ai = ak.indexOf(k)
        if (ai >= 0)
          out.push(...deepDiff(actual[ai], expected[ek.indexOf(k)], `${path}[${k}]`, opts))
      }
      return out
    }
    if (actual.length !== expected.length) {
      out.push({
        path: `${path}.length`,
        kind: 'value',
        expected: expected.length,
        actual: actual.length,
      })
    }
    const len = Math.max(actual.length, expected.length)
    for (let i = 0; i < len; i++) {
      if (i >= actual.length) {
        out.push({ path: `${path}[${i}]`, kind: 'missing', expected: expected[i] })
      } else if (i >= expected.length) {
        out.push({ path: `${path}[${i}]`, kind: 'extra', actual: actual[i] })
      } else {
        out.push(...deepDiff(actual[i], expected[i], `${path}[${i}]`, opts))
      }
    }
    return out
  }

  if (isPlainObject(actual) && isPlainObject(expected)) {
    for (const k of Object.keys(expected)) {
      if (!(k in actual)) out.push({ path: `${path}.${k}`, kind: 'missing', expected: expected[k] })
      else out.push(...deepDiff(actual[k], expected[k], `${path}.${k}`, opts))
    }
    for (const k of Object.keys(actual)) {
      if (!(k in expected)) out.push({ path: `${path}.${k}`, kind: 'extra', actual: actual[k] })
    }
    return out
  }

  // Скаляры (и смешанные типы): строгое равенство. 0 и -0 считаем равными (===).
  if (actual !== expected) {
    out.push({ path, kind: 'value', expected, actual })
  }
  return out
}

const KIND_LABEL: Record<DiffKind, string> = {
  value: 'ЗНАЧЕНИЕ',
  missing: 'НЕТ В РЕЗУЛЬТАТЕ',
  extra: 'ЛИШНЕЕ В РЕЗУЛЬТАТЕ',
  order: 'ПОРЯДОК ЭЛЕМЕНТОВ',
}

/**
 * Человекочитаемый отчёт по диффу. `annotate` — необязательный сопоставитель
 * «путь → комментарий» (например, ссылка на шаг мануала, задавший значение).
 */
export function formatDiff(
  entries: DiffEntry[],
  annotate?: (path: string) => string | undefined,
): string {
  if (entries.length === 0) {
    return 'Расхождений нет: построенный шаблон структурно идентичен эталону.'
  }
  const lines = entries.map((e) => {
    const note = annotate?.(e.path.replace(/^\$\./, ''))
    const head = `${KIND_LABEL[e.kind]}  ${e.path}`
    switch (e.kind) {
      case 'order':
        return [
          head,
          `  факт:    [${(e.actualOrder ?? []).join(', ')}]`,
          `  эталон:  [${(e.expectedOrder ?? []).join(', ')}]`,
          note ? `  примечание: ${note}` : null,
        ]
          .filter((l) => l !== null)
          .join('\n')
      case 'missing':
        return [head, `  эталон:  ${fmt(e.expected)}`, note ? `  примечание: ${note}` : null]
          .filter((l) => l !== null)
          .join('\n')
      case 'extra':
        return [head, `  факт:    ${fmt(e.actual)}`, note ? `  примечание: ${note}` : null]
          .filter((l) => l !== null)
          .join('\n')
      case 'value':
        return [
          head,
          `  факт:    ${fmt(e.actual)}`,
          `  эталон:  ${fmt(e.expected)}`,
          note ? `  примечание: ${note}` : null,
        ]
          .filter((l) => l !== null)
          .join('\n')
    }
  })
  return `Расхождений с эталоном: ${entries.length}\n\n${lines.join('\n\n')}`
}
