import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TemplateTree } from './TemplateTree'
import { Legend } from './Legend'

type SidebarView = 'tree' | 'legend'

export function Sidebar() {
  const { t } = useTranslation()
  const [view, setView] = useState<SidebarView>('tree')
  return (
    <aside className="app__sidebar">
      <div className="sb-tabs">
        <button
          type="button"
          className={`sb-tab${view === 'tree' ? ' is-on' : ''}`}
          onClick={() => setView('tree')}
          title={t('sidebar.treeTitle')}
        >
          {t('sidebar.treeTab')}
        </button>
        <button
          type="button"
          className={`sb-tab${view === 'legend' ? ' is-on' : ''}`}
          onClick={() => setView('legend')}
          title={t('sidebar.legendTitle')}
        >
          {t('sidebar.legendTab')}
        </button>
      </div>
      <div className="sb-body">{view === 'tree' ? <TemplateTree /> : <Legend />}</div>
    </aside>
  )
}