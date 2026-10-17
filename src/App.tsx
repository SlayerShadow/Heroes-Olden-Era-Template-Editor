import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { BookOpen, Copy, FilePlus, FolderOpen, Image, Redo2, Save, Trash2, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import './App.css'
import { useEditorStore } from './store/editorStore'
import {
  buildSidecar,
  downloadBlob,
  downloadTextFile,
  fsErrorMessage,
  listTemplates,
  parseSidecar,
  pickRootFolder,
  pickRootFolderUpload,
  pickTemplateFile,
  readTextFile,
  sanitizeFileName,
  sidecarFileName,
  supportsFsAccess,
  writeBlobFile,
  writeTextFile,
  type FolderTemplate,
} from './utils/fsAccess'
import { PREVIEW_SIZE, renderTemplatePngBlob } from './utils/preview'
import { stringifyJson } from './utils/jsonFormat'
import { gameModeLabel } from './utils/labels'
import { readManualAnchor } from './utils/manualHash'
import { Inspector } from './components/Inspector'
import { Sidebar } from './components/Sidebar'
import { PreviewDialog } from './components/PreviewDialog'
import { ManualDialog } from './components/ManualDialog'
import { TemplatePickDialog } from './components/TemplatePickDialog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Toasts } from './components/Toasts'
import { ValidatorPanel } from './components/ValidatorPanel'
import { ComparePanel } from './components/ComparePanel'
import { LocaleSelect } from './components/LocaleSelect'
import { ZoneGraph } from './components/ZoneGraph'

const PANEL_DEFAULT = { left: 200, right: 320 }
const PANEL_MIN = { left: 150, right: 240 }
const PANEL_MAX = { left: 560, right: 760 }
const CANVAS_MIN_WIDTH = 360
const PANEL_LS_KEY = { left: 'oe-editor.panel.left', right: 'oe-editor.panel.right' }

function clampNum(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), Math.max(min, max))
}

function loadPanelWidth(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key))
    if (Number.isFinite(v) && v >= 50 && v <= 2000) return Math.round(v)
  } catch {
    /* localStorage может быть недоступен */
  }
  return fallback
}

export default function App() {
  const { t } = useTranslation()
  const template = useEditorStore((s) => s.template)
  const rootName = useEditorStore((s) => s.rootName)
  const dirHandle = useEditorStore((s) => s.dirHandle)
  const activeVariant = useEditorStore((s) => s.activeVariant)
  const past = useEditorStore((s) => s.past)
  const future = useEditorStore((s) => s.future)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const setActiveVariant = useEditorStore((s) => s.setActiveVariant)
  const loadTemplate = useEditorStore((s) => s.loadTemplate)
  const setDirectory = useEditorStore((s) => s.setDirectory)
  const newTemplate = useEditorStore((s) => s.newTemplate)
  const pushToast = useEditorStore((s) => s.pushToast)
  const duplicateVariant = useEditorStore((s) => s.duplicateVariant)
  const removeVariant = useEditorStore((s) => s.removeVariant)
  const markSaved = useEditorStore((s) => s.markSaved)
  // Незакоммиченный черновик JSON-редактора с ошибкой блокирует сохранение.
  const jsonBlocked = useEditorStore((s) =>
    Object.values(s.jsonDraftErrors).some((e) => e != null),
  )
  const [savedAt, setSavedAt] = useState<string | null>(null)
  /** Имя папки последнего сохранения; null — последнее сохранение было скачиванием (без FS Access API). */
  const [savedFolder, setSavedFolder] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  // Хеш URL принадлежит мануалу: #якорь при старте (deep link, в т.ч. из новой
  // вкладки) открывает мануал, к заголовку скроллит сам ManualDialog.
  const [docsOpen, setDocsOpen] = useState(() => readManualAnchor() !== null)
  const [pickDir, setPickDir] = useState<{ name: string; list: FolderTemplate[]; seq: number } | null>(null)
  const [leftW, setLeftW] = useState(() => loadPanelWidth(PANEL_LS_KEY.left, PANEL_DEFAULT.left))
  const [rightW, setRightW] = useState(() => loadPanelWidth(PANEL_LS_KEY.right, PANEL_DEFAULT.right))
  const [dragSide, setDragSide] = useState<'left' | 'right' | null>(null)
  const [footerTab, setFooterTab] = useState<'issues' | 'compare'>('issues')
  /**
   * Отложенное разрушающее действие («Новый»/«Открыть файл»/«Открыть папку»),
   * запрошенное при наличии несохранённых изменений. null — подтверждения не нужно;
   * иначе показываем модалку и выполняем действие только после «Продолжить».
   */
  const [pendingDiscard, setPendingDiscard] = useState<null | (() => void)>(null)
  const resizeRef = useRef<{ side: 'left' | 'right'; x0: number; w0: number } | null>(null)
  /** Мягкая подсказка про пару файлов с sidecar: показывается раз за сессию. */
  const softPairHintShown = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_LS_KEY.left, String(leftW))
      localStorage.setItem(PANEL_LS_KEY.right, String(rightW))
    } catch {
      /* нет доступа к localStorage — просто не запоминаем ширины */
    }
  }, [leftW, rightW])

  // Внешняя смена хеша без перезагрузки (вставили в адресную строку и Enter) —
  // непустой хеш открывает мануал; подскролл к разделу делает ManualDialog.
  useEffect(() => {
    const onHashChange = () => {
      if (readManualAnchor() !== null) setDocsOpen(true)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const startResize = (side: 'left' | 'right', e: ReactMouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    resizeRef.current = { side, x0: e.clientX, w0: side === 'left' ? leftW : rightW }
    setDragSide(side)
  }

  useEffect(() => {
    if (!dragSide) return
    const onMove = (e: MouseEvent) => {
      const d = resizeRef.current
      if (!d) return
      const space = Math.max(400, window.innerWidth - CANVAS_MIN_WIDTH)
      if (d.side === 'left') {
        const max = Math.min(PANEL_MAX.left, Math.max(PANEL_MIN.left, space - rightW))
        setLeftW(clampNum(d.w0 + (e.clientX - d.x0), PANEL_MIN.left, max))
      } else {
        const max = Math.min(PANEL_MAX.right, Math.max(PANEL_MIN.right, space - leftW))
        setRightW(clampNum(d.w0 - (e.clientX - d.x0), PANEL_MIN.right, max))
      }
    }
    const onUp = () => {
      resizeRef.current = null
      setDragSide(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.classList.add('is-resizing')
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.classList.remove('is-resizing')
    }
  }, [dragSide, leftW, rightW])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // F1 — мануал редактора (работает и из полей ввода)
      if (e.key === 'F1') {
        e.preventDefault()
        setDocsOpen(true)
        return
      }
      const target = e.target as HTMLElement | null
      if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) return
      const key = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault()
        const store = useEditorStore.getState()
        if (e.shiftKey) store.redo()
        else store.undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault()
        useEditorStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  /**
   * «Новый»/«Открыть файл»/«Открыть папку» уничтожают текущую работу. Если есть
   * несохранённые изменения (dirty), сначала спрашиваем подтверждение модалкой и
   * выполняем действие только после «Продолжить». dirty читаем из getState на момент
   * клика (не из снимка рендера), чтобы решение принималось по актуальному состоянию.
   */
  const guardDiscard = (action: () => void) => {
    if (useEditorStore.getState().dirty) setPendingDiscard(() => action)
    else action()
  }

  /**
   * Шаблон открыт без sidecar: пользователь мог не знать про парный файл.
   * Если папка редактора открыта и пара в ней есть — подсказка точная (имя
   * папки и файла); иначе мягкая условная подсказка раз за сессию. Открытие
   * из папки игры (у штатных шаблонов пары нет) идёт через listTemplates —
   * там отсутствие sidecar известно заранее, подсказкой не досаждаем.
   */
  const hintMissingSidecar = async (fileName: string) => {
    const sidecar = sidecarFileName(fileName)
    if (dirHandle) {
      const text = await readTextFile(dirHandle, sidecar)
      if (text !== null && parseSidecar(text) !== null) {
        pushToast(t('app.hintPairInFolder', { folder: dirHandle.name, sidecar }), 'info')
        return
      }
    }
    if (softPairHintShown.current) return
    softPairHintShown.current = true
    pushToast(t('app.hintPairMissing'), 'info')
  }

  const onOpenFile = async () => {
    try {
      const opened = await pickTemplateFile(t('fs.fileTypeDescription'))
      if (!opened) return
      loadTemplate(opened.template, opened.fileName, opened.sidecar)
      if (!opened.sidecar) void hintMissingSidecar(opened.fileName)
    } catch (err) {
      pushToast(fsErrorMessage(err, t))
    }
  }

  const onOpenRoot = async () => {
    try {
      if (!supportsFsAccess()) {
        const picked = await pickRootFolderUpload(t('fs.fallbackDirName'))
        if (!picked) return
        if (picked.list.length === 1) loadTemplate(picked.list[0].template, picked.list[0].fileName, picked.list[0].sidecar)
        else if (picked.list.length > 1) setPickDir((prev) => ({ name: picked.dirName, list: picked.list, seq: (prev?.seq ?? 0) + 1 }))
        else pushToast(t('app.alertNoTemplates'), 'info')
        return
      }
      const dir = await pickRootFolder()
      if (!dir) return
      setDirectory(dir.name, dir)
      const list = await listTemplates(dir)
      if (list.length === 1) loadTemplate(list[0].template, list[0].fileName, list[0].sidecar)
      else if (list.length > 1) setPickDir((prev) => ({ name: dir.name, list, seq: (prev?.seq ?? 0) + 1 }))
      else {
        pushToast(t('app.alertNoTemplates'), 'info')
      }
    } catch (err) {
      pushToast(fsErrorMessage(err, t))
    }
  }

  const onPickTemplate = (t: FolderTemplate) => {
    setPickDir(null)
    loadTemplate(t.template, t.fileName, t.sidecar)
  }

  const onSave = async () => {
    const state = useEditorStore.getState()
    if (Object.values(state.jsonDraftErrors).some((e) => e != null)) return

    // Куда сохранять: уже выбранная папка, иначе — в Chrome/Edge спрашиваем папку
    // нативным диалогом (showDirectoryPicker) и запоминаем её для следующих сохранений.
    // Отмена диалога прерывает сохранение.
    let dir = state.dirHandle
    let justPicked = false
    if (!dir && supportsFsAccess()) {
      try {
        const picked = await pickRootFolder()
        if (!picked) return
        dir = picked
        justPicked = true
        setDirectory(picked.name, picked)
      } catch (err) {
        pushToast(fsErrorMessage(err, t))
        return
      }
    }

    const base = sanitizeFileName(state.template.name)
    const tplJson = stringifyJson(state.template)
    const sidecar = buildSidecar(state.template, state.positions, state.sectionStates, state.notes)
    const png = await renderTemplatePngBlob(state.template, state.positions, state.activeVariant, PREVIEW_SIZE)

    // Фолбэк без File System Access API (Firefox/Safari): скачивание в папку загрузок браузера.
    if (!dir) {
      downloadTextFile(`${base}.rmg.json`, tplJson)
      downloadTextFile(`${base}.editor.json`, sidecar)
      if (png) downloadBlob(png, `${base}.png`)
      markSaved()
      setSavedAt(new Date().toLocaleTimeString())
      setSavedFolder(null)
      return
    }

    const tplOk = await writeTextFile(dir, `${base}.rmg.json`, tplJson)
    if (!tplOk) {
      pushToast(t('app.alertSaveTemplateFail', { base }))
      return
    }
    await writeTextFile(dir, `${base}.editor.json`, sidecar)
    if (png) {
      const pngOk = await writeBlobFile(dir, `${base}.png`, png)
      if (!pngOk) pushToast(t('app.alertSavePreviewFail', { base }))
    }
    markSaved()
    setSavedAt(new Date().toLocaleTimeString())
    setSavedFolder(dir.name)
    // Тосты здесь персистентные (закрываются кликом), поэтому подтверждаем только
    // свежвыбранную папку — повторные сохранения в ту же папку не заспамливают стек.
    if (justPicked) pushToast(t('app.alertSavedFolder', { folder: dir.name }), 'info')
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">{t('app.brand')}</div>

        <div className="app__actions">
          <button type="button" className="btn" onClick={() => guardDiscard(newTemplate)} title={t('app.newTitle')}>
            <FilePlus size={13} /> {t('app.new')}
          </button>
          <button type="button" className="btn" onClick={() => guardDiscard(onOpenFile)}>
            <FolderOpen size={13} /> {t('app.openFile')}
          </button>
          <button type="button" className="btn" onClick={() => guardDiscard(onOpenRoot)}>
            <FolderOpen size={13} /> {t('app.openFolder')}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={undo}
            disabled={past.length === 0}
            title={t('app.undoTitle')}
          >
            <Undo2 size={13} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={redo}
            disabled={future.length === 0}
            title={t('app.redoTitle')}
          >
            <Redo2 size={13} />
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setPreviewOpen(true)}
            title={t('app.previewTitle')}
          >
            <Image size={13} /> {t('app.preview')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onSave}
            disabled={jsonBlocked}
            title={
              jsonBlocked
                ? t('app.saveBlockedJson')
                : dirHandle
                  ? t('app.saveTitleFolder', { folder: rootName })
                  : supportsFsAccess()
                    ? t('app.saveTitlePickFolder')
                    : t('app.saveTitleNoFolder')
            }
          >
            <Save size={13} /> {t('app.save')}
          </button>
        </div>

        <div className="app__template">
          <span className="app__name">{template.name}</span>
          <span className="app__badge">{gameModeLabel(template.gameMode, t)}</span>
          <span className="app__badge">{template.sizeX ?? '?'}×{template.sizeZ ?? '?'}</span>
          {savedAt && (
            <span
              className="app__source app__source--ok"
              title={
                savedFolder
                  ? t('app.savedToFolderTitle', { folder: savedFolder })
                  : t('app.savedToDownloadTitle')
              }
            >
              ✓ {savedAt}
            </span>
          )}
        </div>

        <div className="app__variant">
          <label htmlFor="variant-select">{t('app.variantLabel')}</label>
          <select
            id="variant-select"
            value={activeVariant}
            onChange={(e) => setActiveVariant(Number(e.target.value))}
          >
            {template.variants.map((v, i) => (
              <option key={i} value={i}>
                {t('app.variantOption', { index: i + 1, zones: v.zones?.length ?? 0 })}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-btn"
            onClick={duplicateVariant}
            title={t('app.variantCopyTitle')}
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={removeVariant}
            disabled={template.variants.length <= 1}
            title={t('app.variantDeleteTitle')}
          >
            <Trash2 size={13} />
          </button>
        </div>

        <button
          type="button"
          className="btn btn--docs"
          onClick={() => setDocsOpen(true)}
          title={t('app.docsTitle')}
        >
          <BookOpen size={13} /> {t('app.docs')}
        </button>

        <LocaleSelect />
      </header>

      <div
        className="app__workspace"
        style={{ '--sb-left': `${leftW}px`, '--sb-right': `${rightW}px` } as CSSProperties}
      >
        <aside className="app__sidebar">
          <Sidebar />
        </aside>
        <div
          className={`resizer${dragSide === 'left' ? ' is-on' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label={t('app.resizerLeftAria')}
          title={t('app.resizerLeftTitle')}
          onMouseDown={(e) => startResize('left', e)}
          onDoubleClick={() => setLeftW(PANEL_DEFAULT.left)}
        />
        <main className="app__canvas">
          <ZoneGraph />
        </main>
        <div
          className={`resizer${dragSide === 'right' ? ' is-on' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label={t('app.resizerRightAria')}
          title={t('app.resizerRightTitle')}
          onMouseDown={(e) => startResize('right', e)}
          onDoubleClick={() => setRightW(PANEL_DEFAULT.right)}
        />
        <aside className="app__inspector">
          <Inspector />
        </aside>
      </div>

      <footer className="app__footer">
        <span className="app__footer-hint">{t('app.footerHint')}</span>
        <div className="footer-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={footerTab === 'issues'}
            className={`footer-tab${footerTab === 'issues' ? ' is-on' : ''}`}
            onClick={() => setFooterTab('issues')}
          >
            {t('app.footerTabIssues')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={footerTab === 'compare'}
            className={`footer-tab${footerTab === 'compare' ? ' is-on' : ''}`}
            onClick={() => setFooterTab('compare')}
          >
            {t('app.footerTabCompare')}
          </button>
        </div>
        {footerTab === 'issues' ? <ValidatorPanel /> : <ComparePanel />}
      </footer>

      <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} />
      {docsOpen && <ManualDialog open onClose={() => setDocsOpen(false)} />}
      <TemplatePickDialog
        key={pickDir ? `pick-${pickDir.seq}` : 'closed'}
        open={pickDir !== null}
        dirName={pickDir?.name ?? ''}
        templates={pickDir?.list ?? []}
        onPick={onPickTemplate}
        onClose={() => setPickDir(null)}
      />
      <ConfirmDialog
        open={pendingDiscard !== null}
        title={t('confirm.discardTitle')}
        message={t('confirm.discardMessage')}
        confirmLabel={t('confirm.discardConfirm')}
        cancelLabel={t('confirm.cancel')}
        danger
        onConfirm={() => {
          const action = pendingDiscard
          setPendingDiscard(null)
          action?.()
        }}
        onCancel={() => setPendingDiscard(null)}
      />
      <Toasts />
    </div>
  )
}