import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../store/editorStore'
import { parseJson, type JsonDraftError } from '../../utils/jsonEdit'

export interface JsonEditorProps {
  /** Ключ черновика в сторе (`zone:<имя>`, `conn:<id>`, `root`). */
  draftKey: string
  /** Текущее значение из стора — сериализуется как эталон. */
  value: unknown
  /** Проверка формы разобранного черновика (null — валиден). */
  validate: (parsed: unknown) => JsonDraftError | null
  /** Коммит разобранного значения в стор; вернуть ошибку, если коммит отклонён — она показывается тем же alert'ом и регистрируется в сторе. */
  onApply: (parsed: unknown) => JsonDraftError | null
  rows?: number
}

/**
 * «Умный» JSON-редактор: обычный textarea с живым разбором.
 * - черновик отличается от эталона → включается кнопка «Применить»;
 * - SyntaxError или невалидная форма → поле подсвечивается красным, ошибка
 *   показывается рядом и регистрируется в сторе (ValidatorPanel + блокировка
 *   сохранения в App.tsx);
 * - отклонённый коммит (ошибка от onApply) показывается тем же alert'ом и
 *   тоже регистрируется в сторе;
 * - успешное применение коммитит значение в стор → канва и формы обновляются.
 * Пока черновик совпадает с эталоном, внешние изменения (форма-редактор)
 * синхронизируются в текст автоматически; «грязный» черновик не затирается.
 */
export function JsonEditor({ draftKey, value, validate, onApply, rows = 14 }: JsonEditorProps) {
  const { t } = useTranslation()
  const setJsonDraftError = useEditorStore((s) => s.setJsonDraftError)
  const serialized = JSON.stringify(value, null, 2)

  const [text, setText] = useState(serialized)
  // Эталон — последняя сериализация value, с которой синхронизирован текст.
  const [base, setBase] = useState(serialized)
  const [prev, setPrev] = useState(serialized)
  // Флаг: следующий приход нового эталона нужно принудительно записать в текст
  // (ставится после успешного «Применить» — черновик уже не «грязный»).
  const [syncNext, setSyncNext] = useState(false)
  // Ошибка отклонённого коммита (onApply вернул ошибку): показывается тем же
  // alert'ом, что и ошибки живой валидации; снимается правкой текста,
  // «Сбросить» и успешным применением.
  const [applyError, setApplyError] = useState<JsonDraftError | null>(null)

  // Синхронизация с внешними изменениями value (форма-редактор, «Применить») —
  // рекомендованный React паттерн «хранить предыдущее значение в состоянии».
  // «Грязный» черновик (text !== base) не затирается.
  if (serialized !== prev) {
    setPrev(serialized)
    setBase(serialized)
    if (syncNext) {
      setSyncNext(false)
      setText(serialized)
    } else if (text === base) {
      setText(serialized)
    }
  }

  const dirty = text !== base

  const error = useMemo<JsonDraftError | null>(() => {
    if (!dirty) return null
    const res = parseJson(text)
    if (!res.ok) return res.error
    return validate(res.value)
  }, [dirty, text, validate])

  // Живая валидация приоритетнее; ошибка отклонённого коммита — запасная.
  const shownError = error ?? applyError

  // Регистрация ошибки в сторе (ValidatorPanel + блокировка «Сохранить»).
  // При размонтировании (смена выделения/вкладки) ошибка снимается — черновик
  // не сохраняется между переключениями.
  useEffect(() => {
    setJsonDraftError(draftKey, shownError)
    return () => setJsonDraftError(draftKey, null)
  }, [draftKey, shownError, setJsonDraftError])

  const apply = useCallback(() => {
    const res = parseJson(text)
    if (!res.ok) return
    const err = validate(res.value)
    if (err) return // уже показана живой валидацией (error-memo)
    const applyErr = onApply(res.value)
    if (applyErr) {
      setApplyError(applyErr)
      return
    }
    setApplyError(null)
    // Коммит меняет value → синхронизация в рендере перезапишет текст эталоном;
    // канонизация здесь покрывает случай, когда сериализация не изменилась.
    setSyncNext(true)
    setText(JSON.stringify(res.value, null, 2))
  }, [text, validate, onApply])

  const reset = useCallback(() => {
    setApplyError(null)
    setText(base)
  }, [base])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      // Tab вставляет два пробела вместо ухода из поля.
      e.preventDefault()
      const ta = e.currentTarget
      const s = ta.selectionStart
      const en = ta.selectionEnd
      setText((prev) => prev.slice(0, s) + '  ' + prev.slice(en))
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = s + 2
      })
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      apply()
    }
  }

  const taClass = ['json-edit__ta']
  if (shownError) taClass.push('is-invalid')
  else if (dirty) taClass.push('is-dirty')

  return (
    <div className="json-edit">
      <textarea
        className={taClass.join(' ')}
        value={text}
        rows={rows}
        spellCheck={false}
        onChange={(e) => {
          setApplyError(null)
          setText(e.target.value)
        }}
        onKeyDown={onKeyDown}
        aria-label={t('jsonEditor.aria')}
        aria-invalid={shownError ? true : undefined}
      />
      {shownError && (
        <div className="json-edit__err" role="alert">
          {t(
            `jsonEditor.errors.${shownError.code}`,
            shownError.detail !== undefined ? { detail: shownError.detail } : undefined,
          )}
        </div>
      )}
      <div className="json-edit__bar">
        <button
          type="button"
          className="btn"
          disabled={!dirty || !!error}
          onClick={apply}
          title={t('jsonEditor.applyTitle')}
        >
          <Check size={12} /> {t('jsonEditor.apply')}
        </button>
        <button type="button" className="btn" disabled={!dirty} onClick={reset} title={t('jsonEditor.resetTitle')}>
          <RotateCcw size={12} /> {t('jsonEditor.reset')}
        </button>
        {dirty && !error && <span className="json-edit__status">{t('jsonEditor.dirty')}</span>}
      </div>
    </div>
  )
}
