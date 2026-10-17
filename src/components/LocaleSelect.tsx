import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LOCALES, setLocale } from '../i18n'

/** Селектор локали интерфейса (правый верхний угол шапки). */
export function LocaleSelect() {
  const { i18n, t } = useTranslation()
  return (
    <div className="app__locale">
      <Languages size={13} aria-hidden />
      <select
        value={i18n.language}
        onChange={(e) => setLocale(e.target.value)}
        aria-label={t('locale.selectLabel')}
        title={t('locale.selectLabel')}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  )
}
