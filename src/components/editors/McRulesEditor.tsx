import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { McRule, McRuleType } from '../../types/rmg'
import { CommaList, Num, Select } from './fields'

function newPortalRule(): McRule {
  return { type: 'Crossroads', args: [], targetMin: 0, targetMax: 0, weight: 2 }
}

export function RulesEditor({
  value,
  onChange,
  label,
  typeOptions,
}: {
  value: McRule[]
  onChange: (v: McRule[]) => void
  label: string
  typeOptions: McRuleType[]
}) {
  const { t } = useTranslation()
  const patch = (i: number, p: Partial<McRule>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...p } : r)))
  return (
    <div className="full">
      <span className="ef__label">{label}</span>
      {value.map((r, i) => (
        <div key={i} className="mc-rule">
          <div className="full mc-rule__head">
            <span>{t('mcRules.rule', { n: i + 1 })}</span>
            <button type="button" className="icon-btn" onClick={() => onChange(value.filter((_, j) => j !== i))} title={t('mcRules.deleteTitle')}>
              <X size={12} />
            </button>
          </div>
          <Select
            label={t('mcRules.typeLabel')}
            allowBlank={false}
            value={r.type}
            onChange={(v) => patch(i, { type: v as McRuleType })}
            options={typeOptions.map((ty) => ({ value: ty, label: `${t(`mcRules.types.${ty}`)} · ${ty}` }))}
          />
          <CommaList
            label={t('mcRules.argsLabel')}
            hint={t('mcRules.argsHint')}
            value={r.args?.map(String)}
            onChange={(args) => patch(i, { args: args.length > 0 ? args : undefined })}
          />
          <Num label={t('mcRules.targetMinLabel')} hint={t('mcRules.targetMinHint')} step={0.05} value={r.targetMin} onChange={(v) => patch(i, { targetMin: v })} />
          <Num label={t('mcRules.targetMaxLabel')} hint={t('mcRules.targetMaxHint')} step={0.05} value={r.targetMax} onChange={(v) => patch(i, { targetMax: v })} />
          <Num label={t('mcRules.weightLabel')} hint={t('mcRules.weightHint')} step={0.5} value={r.weight} onChange={(v) => patch(i, { weight: v })} />
          <Num label={t('mcRules.targetLabel')} hint={t('mcRules.targetHint')} step={0.05} value={r.target} onChange={(v) => patch(i, { target: v })} />
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...value, newPortalRule()])}>
        <Plus size={12} /> {t('mcRules.add')}
      </button>
    </div>
  )
}