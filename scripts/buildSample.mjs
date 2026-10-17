// Генератор демо-шаблона для документации: собирает пару файлов из фикстура src/data/sampleTemplate.ts
//   - src/data/sampleTemplate.json        — содержимое шаблона (формат .rmg.json, как пишет «Сохранить»)
//   - src/data/sampleTemplate.editor.json — sidecar с раскладкой узлов схемы (формат buildSidecar)
// Пара загружается штатным «Открыть» (файлы спариваются по базовому имени) — для кадров мануала.
// Файлы ГЕНЕРИРУЕМЫЕ — не редактировать руками; регенерация: `npm run sample`.
// Требует Node >= 22.18 (нативный TS type-stripping, как check_root_validate.mjs). Детерминирован (zero-diff).
//
// src/ использует bundler-импорты без расширений, а Node ESM их не достраивает —
// регистрируем resolve-хук, дополняющий относительные спецификаторы до `.ts`,
// и берём buildSidecar из самого приложения (единый источник формата sidecar, без дублирования).
import { existsSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { samplePositions, sampleTemplate } from '../src/data/sampleTemplate.ts'
import { stringifyJson } from '../src/utils/jsonFormat.ts'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
      if (!existsSync(base) && existsSync(`${base}.ts`)) {
        return { url: pathToFileURL(`${base}.ts`).href, shortCircuit: true }
      }
    }
    return nextResolve(specifier, context)
  },
})

const { buildSidecar } = await import('../src/utils/fsAccess.ts')

const outDir = new URL('../src/data/', import.meta.url)
const tplPath = new URL('sampleTemplate.json', outDir)
const sidecarPath = new URL('sampleTemplate.editor.json', outDir)

// Формат байт-в-байт как у приложения: stringifyJson (табы), без завершающего перевода строки.
writeFileSync(tplPath, stringifyJson(sampleTemplate))
writeFileSync(sidecarPath, buildSidecar(sampleTemplate, [samplePositions]))

const zones = sampleTemplate.variants[0]?.zones.length ?? 0
const connections = sampleTemplate.variants[0]?.connections.length ?? 0
const positions = samplePositions ? Object.keys(samplePositions).length : 0
console.log(
  `OK: src/data/sampleTemplate.json + sampleTemplate.editor.json ` +
    `(«${sampleTemplate.name}»: 1 вариант, ${zones} зон, ${connections} связей, ${positions} позиций)`,
)
