import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run release` — single-file дистрибуция:
// один самодостаточный HTML, работающий с file:// без сервера.
// Обычные режимы не затрагиваются: `npm run dev` — сервер с HMR и ленивыми
// чанками, `npm run build` — прежняя сборка dist/ (используется как typecheck).
const RELEASE_MODE = 'release'
const RELEASE_FILE_NAME = 'heroes-oe-template-editor.html'

/**
 * Постобработка release-сборки (встаёт после vite:singlefile, который инлайнит
 * JS/CSS и удаляет их из бандла):
 * - favicon инлайнится data URI (ассеты из public/ не инлятся автоматически,
 *   а с file:// ссылка на внешний файл — недостижимый запрос);
 * - index.html переименовывается в дистрибутивное имя (emitFile — rolldown
 *   игнорирует присвоение новых ключей бандлу в generateBundle).
 * publicDir в release-режиме отключён, поэтому в dist остаётся ровно один файл.
 */
function releaseHtml(): Plugin {
  let root = ''
  return {
    name: 'oe:release-html',
    enforce: 'post',
    apply: 'build',
    configResolved(config) {
      root = config.root
    },
    generateBundle(_options, bundle) {
      const htmlKey = Object.keys(bundle).find((key) => key.endsWith('.html'))
      if (!htmlKey) return
      const html = bundle[htmlKey]
      if (html.type !== 'asset') return
      const favicon = readFileSync(resolve(root, 'public', 'favicon.svg'))
      const iconHref = `data:image/svg+xml;base64,${favicon.toString('base64')}`
      const source = String(html.source).replace(
        /<link[^>]*rel="icon"[^>]*>/,
        `<link rel="icon" type="image/svg+xml" href="${iconHref}">`,
      )
      this.emitFile({ type: 'asset', fileName: RELEASE_FILE_NAME, source })
      delete bundle[htmlKey]
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const release = mode === RELEASE_MODE
  return {
    // public/ в single-file не нужен: favicon инлайнится в HTML, icons.svg не используется.
    publicDir: release ? false : 'public',
    plugins: release ? [react(), viteSingleFile(), releaseHtml()] : [react()],
  }
})
