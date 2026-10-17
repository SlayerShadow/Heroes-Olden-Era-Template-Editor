import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../../store/editorStore'
import type {
  Border,
  BorderNoise,
  Orientation,
  OrientationMode,
} from '../../types/rmg'
import { Num, Section, Select, Text } from './fields'

const ORIENTATION_MODES: OrientationMode[] = ['MinimalBoundingSquare', 'BoundingCircle']

function OrientationEditor({
  orientation,
  zoneNames,
  onPatch,
}: {
  orientation: Orientation | undefined
  zoneNames: string[]
  onPatch: (o: Orientation) => void
}) {
  const { t } = useTranslation()
  const o = orientation ?? {}
  const set = (p: Partial<Orientation>) => onPatch({ ...o, ...p })
  const hasAngles = typeof o.baseAngleMin === 'number' || typeof o.baseAngleMax === 'number'

  return (
    <div className="full">
      <div className="hint full">{t('variant.orientationHint')}</div>
      <Select
        label={t('variant.modeLabel')}
        blankLabel="—"
        hint={t('variant.modeHint')}
        value={o.mode}
        onChange={(v) => set({ mode: v ? (v as OrientationMode) : undefined })}
        options={ORIENTATION_MODES.map((m) => ({ value: m, label: `${t(`variant.modes.${m}`)} · ${m}` }))}
      />
      <Num
        label={t('variant.angleMinLabel')}
        min={0}
        max={360}
        step={15}
        hint={t('variant.angleMinHint')}
        value={o.baseAngleMin}
        onChange={(v) => set({ baseAngleMin: v })}
      />
      <Num
        label={t('variant.angleMaxLabel')}
        min={0}
        max={360}
        step={15}
        hint={t('variant.angleMaxHint')}
        value={o.baseAngleMax}
        onChange={(v) => set({ baseAngleMax: v })}
      />
      {hasAngles && <div className="hint full">{t('variant.anglesNote')}</div>}
      <Num
        label={t('variant.amplitudeLabel')}
        min={0}
        max={360}
        step={15}
        hint={t('variant.amplitudeHint')}
        value={o.randomAngleAmplitude}
        onChange={(v) => set({ randomAngleAmplitude: v })}
      />
      <Num
        label={t('variant.stepLabel')}
        min={0}
        max={180}
        step={15}
        hint={t('variant.stepHint')}
        value={o.randomAngleStep}
        onChange={(v) => set({ randomAngleStep: v })}
      />
      <Select
        label={t('variant.zeroZoneLabel')}
        blankLabel="—"
        hint={t('variant.zeroZoneHint')}
        value={o.zeroAngleZone}
        onChange={(v) => set({ zeroAngleZone: v || undefined })}
        options={zoneNames.map((z) => ({ value: z }))}
      />
    </div>
  )
}

function NoiseList({
  label,
  value,
  onChange,
}: {
  label: string
  value: BorderNoise[] | undefined
  onChange: (v: BorderNoise[] | undefined) => void
}) {
  const { t } = useTranslation()
  const list = value ?? []
  const set = (next: BorderNoise[]) => onChange(next.length ? next : undefined)
  const patch = (i: number, p: Partial<BorderNoise>) =>
    set(list.map((n, j) => (j === i ? { ...n, ...p } : n)))

  return (
    <div className="full">
      <span className="ef__label">{t('variant.noiseSuffix', { label })}</span>
      {list.map((n, i) => (
        <div key={i} className="mc-rule">
          <div className="full mc-rule__head">
            <span>{t('variant.noiseItem', { n: i + 1 })}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => set(list.filter((_, j) => j !== i))}
              title={t('variant.noiseDeleteTitle')}
            >
              <X size={12} />
            </button>
          </div>
          <Num label={t('variant.ampLabel')} hint={t('variant.ampHint')} step={0.1} min={0.5} max={2} value={n.amp} onChange={(v) => patch(i, { amp: v })} />
          <Num label={t('variant.freqLabel')} hint={t('variant.freqHint')} step={1} min={1} max={12} value={n.freq} onChange={(v) => patch(i, { freq: v })} />
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() => {
          if (list.length) set([...list, { amp: 1, freq: 12 }])
          else set([{ amp: 1, freq: 12 }])
        }}
      >
        <Plus size={12} /> {t('variant.noiseAdd')}
      </button>
    </div>
  )
}

function BorderEditor({
  border,
  onPatch,
}: {
  border: Border | undefined
  onPatch: (b: Border) => void
}) {
  const { t } = useTranslation()
  const b = border ?? {}
  const set = (p: Partial<Border>) => onPatch({ ...b, ...p })

  return (
    <div className="full">
      <div className="hint full">{t('variant.borderHint')}</div>
      <Num
        label={t('variant.cornerLabel')}
        min={0}
        max={0.8}
        step={0.05}
        hint={t('variant.cornerHint')}
        value={b.cornerRadius}
        onChange={(v) => set({ cornerRadius: v })}
      />
      <Num
        label={t('variant.obstaclesWidthLabel')}
        min={2}
        max={6}
        step={1}
        hint={t('variant.obstaclesWidthHint')}
        value={b.obstaclesWidth}
        onChange={(v) => set({ obstaclesWidth: v })}
      />
      <NoiseList
        label={t('variant.obstaclesNoiseLabel')}
        value={b.obstaclesNoise}
        onChange={(v) => set({ obstaclesNoise: v })}
      />
      <Num
        label={t('variant.waterWidthLabel')}
        min={0}
        max={6}
        step={1}
        hint={t('variant.waterWidthHint')}
        value={b.waterWidth}
        onChange={(v) => set({ waterWidth: v })}
      />
      <NoiseList
        label={t('variant.waterNoiseLabel')}
        value={b.waterNoise}
        onChange={(v) => set({ waterNoise: v })}
      />
      <Text
        label={t('variant.waterTypeLabel')}
        hint={t('variant.waterTypeHint')}
        placeholder="water grass"
        value={b.waterType}
        onChange={(v) => set({ waterType: v || undefined })}
      />
    </div>
  )
}

export function VariantPanel() {
  const { t } = useTranslation()
  const variant = useEditorStore((s) => s.template.variants[s.activeVariant])
  const zoneNames = useEditorStore(
    useShallow((s) => s.template.variants[s.activeVariant]?.zones?.map((z) => z.name) ?? []),
  )
  const patchActiveVariant = useEditorStore((s) => s.patchActiveVariant)
  const activeVariant = useEditorStore((s) => s.activeVariant)

  if (!variant) return null

  const patchOrientation = (o: Orientation) => patchActiveVariant({ orientation: o })
  const patchBorder = (b: Border) => patchActiveVariant({ border: b })

  return (
    <div className="editor">
      <div className="variant-head">
        <span className="variant-head__title">V{activeVariant + 1}</span>
        <span className="variant-head__meta">
          {t('variant.meta', { zones: variant.zones?.length ?? 0, connections: variant.connections?.length ?? 0 })}
        </span>
      </div>

      <Section title={t('variant.sectionOrientation')} open>
        <OrientationEditor
          orientation={variant.orientation}
          zoneNames={zoneNames}
          onPatch={patchOrientation}
        />
      </Section>

      <Section title={t('variant.sectionBorder') + (variant.border ? '' : t('variant.sectionBorderNone'))}>
        <BorderEditor border={variant.border} onPatch={patchBorder} />
      </Section>
    </div>
  )
}