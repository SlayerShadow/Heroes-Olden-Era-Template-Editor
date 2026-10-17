import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { loadCatalog } from '../data/catalog'
import { useEditorStore } from '../store/editorStore'
import type { JsonDraftError } from '../utils/jsonEdit'
import { validateTemplate, type Severity, type ValidationIssue } from '../utils/validate'

const SEV_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 }

function sevIcon(sev: Severity): ReactNode {
  switch (sev) {
    case 'error':
      return <XCircle size={12} className="issue__icon issue__icon--error" />
    case 'warning':
      return <AlertTriangle size={12} className="issue__icon issue__icon--warning" />
    case 'info':
      return <Info size={12} className="issue__icon issue__icon--info" />
  }
}

export function ValidatorPanel() {
  const { t } = useTranslation()
  const template = useEditorStore((s) => s.template)
  const activeVariant = useEditorStore((s) => s.activeVariant)
  const setActiveVariant = useEditorStore((s) => s.setActiveVariant)
  const select = useEditorStore((s) => s.select)
  const setInspectorTab = useEditorStore((s) => s.setInspectorTab)

  // Имена пулов/списков подгружаются лениво отдельным chunk'ом (~1 МБ);
  // до загрузки каталога проверки ссылок на пулы не выполняются.
  const [poolNames, setPoolNames] = useState<string[]>([])
  const [listNames, setListNames] = useState<string[]>([])

  useEffect(() => {
    let mounted = true
    loadCatalog().then((c) => {
      if (!mounted) return
      setPoolNames(c.poolNames)
      setListNames(c.listNames)
    })
    return () => {
      mounted = false
    }
  }, [])

  const report = useMemo(
    () => validateTemplate(template, { poolNames, listNames }),
    [template, poolNames, listNames],
  )

  // Ошибки черновиков «умного» JSON-редактора (не в шаблоне — в незакоммиченном
  // тексте): показываются первыми и блокируют сохранение (App.tsx).
  const draftErrorsMap = useEditorStore((s) => s.jsonDraftErrors)
  const draftErrors = useMemo(
    () =>
      Object.entries(draftErrorsMap).filter(
        (entry): entry is [string, JsonDraftError] => entry[1] != null,
      ),
    [draftErrorsMap],
  )
  // `zone:<имя>` / `conn:<id>` / `root` → подпись места (имена могут содержать ':').
  const draftScopeText = (key: string): string => {
    const sep = key.indexOf(':')
    const kind = sep >= 0 ? key.slice(0, sep) : key
    const name = sep >= 0 ? key.slice(sep + 1) : ''
    if (kind === 'zone') return t('validator.jsonDraftZone', { name })
    if (kind === 'conn') return t('validator.jsonDraftConn', { name })
    return t('validator.jsonDraftRoot')
  }

  // scope/code переводятся на слое панели (ns validator); validate.ts остаётся чистой функцией.
  const scopeText = (issue: ValidationIssue): string =>
    t(`validator:scope.${issue.scope.code}`, issue.scope.params)
  const messageText = (issue: ValidationIssue): string =>
    t(`validator:issues.${issue.code}`, issue.params)

  const sorted = useMemo(
    () =>
      [...report.issues].sort(
        (a, b) =>
          SEV_ORDER[a.severity] - SEV_ORDER[b.severity] ||
          t(`validator:scope.${a.scope.code}`, a.scope.params).localeCompare(
            t(`validator:scope.${b.scope.code}`, b.scope.params),
          ),
      ),
    [report, t],
  )

  const goToIssue = (issue: ValidationIssue): void => {
    if (issue.variant !== undefined && issue.variant !== activeVariant) {
      setActiveVariant(issue.variant)
    }
    if (issue.zoneId) {
      select('zone', issue.zoneId, true)
    } else if (issue.connectionId) {
      select('connection', issue.connectionId, true)
    } else if (issue.variant !== undefined) {
      select(null, null)
    } else {
      setInspectorTab('root')
    }
  }

  const errorCount = report.errors + draftErrors.length
  const total = errorCount + report.warnings + report.infos
  if (total === 0) {
    return (
      <div className="validator">
        <span className="validator__ok">
          <CheckCircle2 size={12} /> {t('validator.ok')}
        </span>
      </div>
    )
  }

  return (
    <div className="validator">
      <span className={`validator__chip validator__chip--error${errorCount ? '' : ' is-muted'}`} title={t('validator.errorsTitle')}>
        <XCircle size={11} />
        {errorCount}
      </span>
      <span className={`validator__chip validator__chip--warning${report.warnings ? '' : ' is-muted'}`} title={t('validator.warningsTitle')}>
        <AlertTriangle size={11} />
        {report.warnings}
      </span>
      <span className={`validator__chip validator__chip--info${report.infos ? '' : ' is-muted'}`} title={t('validator.infosTitle')}>
        <Info size={11} />
        {report.infos}
      </span>
      <details className="validator__details">
        <summary title={t('validator.detailsTitle')}>{t('validator.detailsSummary')}</summary>
        <div className="validator__body">
          {draftErrors.map(([key, err]) => (
            <div key={`draft-${key}`} className="issue" title={t('validator.jsonDraftTitle')}>
              <XCircle size={12} className="issue__icon issue__icon--error" />
              <span className="issue__scope">{draftScopeText(key)}</span>
              <span className="issue__msg">
                {t(`jsonEditor.errors.${err.code}`, err.detail !== undefined ? { detail: err.detail } : undefined)}
              </span>
              <span className="issue__path">{t('validator.jsonDraftPath')}</span>
            </div>
          ))}
          {sorted.map((issue, i) => (
            <button
              key={i}
              type="button"
              className={`issue issue--jumpable${issue.variant !== undefined || issue.zoneId || issue.connectionId ? '' : ' is-root'}`}
              onClick={() => goToIssue(issue)}
              title={t('validator.issueTitle')}
            >
              {sevIcon(issue.severity)}
              <span className="issue__scope">{scopeText(issue)}</span>
              <span className="issue__msg" title={issue.path}>
                {messageText(issue)}
              </span>
              <span className="issue__path">{issue.path}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}