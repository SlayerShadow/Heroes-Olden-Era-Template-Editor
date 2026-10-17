import type { RmgTemplate } from '../types/rmg'
import type { Point } from './graph'
import { stringifyJson } from './jsonFormat'

export interface OpenedTemplate {
  fileName: string
  template: RmgTemplate
  /** Данные sidecar `.editor.json` (позиции, раскладка секций, заметки) — иначе null */
  sidecar: SidecarData | null
}

export interface FolderTemplate {
  name: string
  fileName: string
  template: RmgTemplate
  /** Данные sidecar `.editor.json` (позиции, раскладка секций, заметки) — иначе null */
  sidecar: SidecarData | null
}

/**
 * Разобранный sidecar `.editor.json`.
 * `sectionStates`/`notes` опциональны — у файла только с позициями они пустые.
 */
export interface SidecarData {
  /** Позиции узлов схемы по вариантам (ключ — имя зоны). */
  positions: Record<string, Point>[]
  /** Раскладка свёрнутых секций инспектора: persistKey → развёрнут (true). */
  sectionStates: Record<string, boolean>
  /** Пользовательские заметки по зонам (ключ — имя зоны); в `.rmg.json` не попадают. */
  notes: Record<string, string>
}

export function supportsFsAccess(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

/** Коды ошибок для UI-перевода (common:fsErrors.*); сообщения бросаются кодами, не текстом. */
export const FS_ERROR_CODES = ['fs.notJsonObject', 'fs.notTemplate', 'fs.pickerOpenError'] as const
export type FsErrorCode = (typeof FS_ERROR_CODES)[number]

export function parseTemplate(text: string): RmgTemplate {
  const data = JSON.parse(text) as RmgTemplate
  if (!data || typeof data !== 'object') throw new Error('fs.notJsonObject')
  if (typeof data.name !== 'string' || !Array.isArray(data.variants)) {
    throw new Error('fs.notTemplate')
  }
  return data
}

/** Если сообщение ошибки — известный код fsAccess, вернуть перевод; иначе исходное сообщение. */
export function fsErrorMessage(err: unknown, translate: (code: string) => string): string {
  const msg = String((err as Error)?.message ?? err)
  return (FS_ERROR_CODES as readonly string[]).includes(msg) ? translate(msg) : msg
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'template'
}

/** Базовое имя файла шаблона без расширения (`.rmg.json`/`.json`) — по нему ищется пара. */
export function templateBaseName(fileName: string): string {
  return fileName.replace(/\.rmg\.json$/i, '').replace(/\.json$/i, '')
}

/** Имя парного sidecar-файла `.editor.json` для файла шаблона. */
export function sidecarFileName(fileName: string): string {
  return `${templateBaseName(fileName)}.editor.json`
}

/**
 * Парсит sidecar `.editor.json` (формат без версий): позиции по вариантам (валидирует форму),
 * раскладка секций и заметки — опциональные поля, недостающие читаются пустыми записями.
 * Посторонние поля игнорируются. Битый/отсутствующий файл — null.
 */
export function parseSidecar(text: string | null): SidecarData | null {
  if (!text) return null
  try {
    const data = JSON.parse(text) as { positions?: unknown; sectionStates?: unknown; notes?: unknown }
    if (!data || typeof data !== 'object' || !Array.isArray(data.positions)) return null
    const out: Record<string, Point>[] = []
    for (const entry of data.positions) {
      if (!entry || typeof entry !== 'object') return null
      const map: Record<string, Point> = {}
      for (const [key, val] of Object.entries(entry as Record<string, unknown>)) {
        if (!val || typeof val !== 'object') continue
        const { x, y } = val as Point
        if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
          map[key] = { x, y }
        }
      }
      out.push(map)
    }
    return { positions: out, sectionStates: parseSectionStates(data.sectionStates), notes: parseNotes(data.notes) }
  } catch {
    return null
  }
}

/** `sectionStates`: объект ключ→boolean; всё остальное игнорируется (мягкий разбор). */
function parseSectionStates(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof val === 'boolean') out[key] = val
  }
  return out
}

/** `notes`: объект имяЗоны→текст; всё остальное игнорируется (мягкий разбор). */
function parseNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof val === 'string' && val.trim() !== '') out[key] = val
  }
  return out
}

/**
 * Открытие шаблона пикером: можно выбрать один `.rmg.json` или пару
 * `.rmg.json` + `<Имя>.editor.json` — тогда позиции/секции/заметки восстановятся.
 */
export async function pickTemplateFile(fileTypeDescription: string): Promise<OpenedTemplate | null> {
  if (!supportsFsAccess()) return pickTemplateFileUpload()
  try {
    const handles = await window.showOpenFilePicker({
      types: [
        { description: fileTypeDescription, accept: { 'application/json': ['.rmg.json', '.editor.json', '.json'] } },
      ],
      multiple: true,
    })
    const files = await Promise.all(handles.map((h) => h.getFile()))
    return readTemplateFromFiles(files)
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return null
    throw err
  }
}

/** Из выбранных файлов собирает шаблон + sidecar по совпадающему базовому имени. */
async function readTemplateFromFiles(files: File[]): Promise<OpenedTemplate | null> {
  const tplFile = files.find(
    (f) => !/\.editor\.json$/i.test(f.name) && /\.(rmg\.json|json)$/i.test(f.name),
  )
  if (!tplFile) return null
  const sidecarFile = files.find((f) => f.name === sidecarFileName(tplFile.name))
  return {
    fileName: tplFile.name,
    template: parseTemplate(await tplFile.text()),
    sidecar: parseSidecar(sidecarFile ? await sidecarFile.text() : null),
  }
}

export async function pickRootFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await window.showDirectoryPicker({ mode: 'readwrite' })
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return null
    throw err
  }
}

/** Фолбэк открытия файла вне Chrome/Edge: обычный input[type=file] (можно выбрать пару файлов). */
export async function pickTemplateFileUpload(): Promise<OpenedTemplate | null> {
  const files = await showFilePicker({ multiple: true, accept: '.rmg.json,.editor.json,.json' })
  if (files.length === 0) return null
  return readTemplateFromFiles(files)
}

/** Фолбэк открытия папки вне Chrome/Edge: input[type=file] с `webkitdirectory`. */
export async function pickRootFolderUpload(fallbackDirName: string): Promise<{ dirName: string; list: FolderTemplate[] } | null> {
  const files = await showFilePicker({ multiple: true, directory: true, accept: '.json' })
  if (files.length === 0) return null
  const dirName = files[0].webkitRelativePath.split('/')[0] || fallbackDirName
  const byName = new Map<string, File>()
  for (const f of files) byName.set(f.name, f)
  const list: FolderTemplate[] = []
  for (const f of files) {
    if (!/\.(rmg\.json|json)$/i.test(f.name) || /\.editor\.json$/i.test(f.name)) continue
    try {
      const sidecar = byName.get(sidecarFileName(f.name))
      list.push({
        name: f.name.replace(/\.json$/i, ''),
        fileName: f.name,
        template: parseTemplate(await f.text()),
        sidecar: parseSidecar(sidecar ? await sidecar.text() : null),
      })
    } catch {
      // битый файл — пропускаем
    }
  }
  return { dirName, list }
}

function showFilePicker(opts: { multiple?: boolean; directory?: boolean; accept?: string }): Promise<File[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    if (opts.multiple) input.multiple = true
    if (opts.directory) input.webkitdirectory = true
    if (opts.accept) input.accept = opts.accept
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = () => {
      input.remove()
      resolve(Array.from(input.files ?? []))
    }
    input.oncancel = () => {
      input.remove()
      resolve([])
    }
    input.onerror = () => {
      input.remove()
      reject(new Error('fs.pickerOpenError'))
    }
    input.click()
  })
}

export async function listTemplates(dir: FileSystemDirectoryHandle): Promise<FolderTemplate[]> {
  const out: FolderTemplate[] = []
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file') continue
    if (!entry.name.endsWith('.rmg.json') && !entry.name.endsWith('.json')) continue
    try {
      const file = await (entry as FileSystemFileHandle).getFile()
      const sidecar = await readTextFile(dir, sidecarFileName(entry.name))
      out.push({
        name: entry.name.replace(/\.json$/i, ''),
        fileName: entry.name,
        template: parseTemplate(await file.text()),
        sidecar: parseSidecar(sidecar),
      })
    } catch {
      // битый файл — пропускаем
    }
  }
  return out
}

export async function writeBlobFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  blob: Blob,
): Promise<boolean> {
  try {
    const handle = await dir.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return true
  } catch {
    return false
  }
}

export async function writeTextFile(dir: FileSystemDirectoryHandle, name: string, text: string): Promise<boolean> {
  return writeBlobFile(dir, name, new Blob([text], { type: 'text/plain;charset=utf-8' }))
}

export async function readTextFile(dir: FileSystemDirectoryHandle, name: string): Promise<string | null> {
  try {
    const handle = await dir.getFileHandle(name)
    const file = await handle.getFile()
    return await file.text()
  } catch {
    return null
  }
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadTextFile(name: string, text: string): void {
  downloadBlob(new Blob([text], { type: 'application/json;charset=utf-8' }), name)
}

/**
 * Собирает sidecar `.editor.json`: позиции узлов, раскладка свёрнутых секций
 * и заметки по зонам. Пустые `sectionStates`/`notes` не пишутся (файл не шумит).
 */
export function buildSidecar(
  template: RmgTemplate,
  positions: Record<string, Point>[],
  sectionStates?: Record<string, boolean>,
  notes?: Record<string, string>,
): string {
  const data: Record<string, unknown> = {
    editor: 'oe-template-editor',
    templateFile: `${sanitizeFileName(template.name)}.rmg.json`,
    positions,
  }
  if (sectionStates && Object.keys(sectionStates).length > 0) data.sectionStates = sectionStates
  if (notes && Object.keys(notes).length > 0) data.notes = notes
  return stringifyJson(data)
}