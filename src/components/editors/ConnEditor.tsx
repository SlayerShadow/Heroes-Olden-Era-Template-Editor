import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../store/editorStore'
import type { Connection, ConnectionType, McRuleType } from '../../types/rmg'
import { ComboInput, Label, Num, Section, Select, Text, TriSelect } from './fields'
import { RulesEditor } from './McRulesEditor'

const CONN_TYPES: ConnectionType[] = ['Direct', 'Default', 'Portal', 'Proximity', 'GladiatorArena']
const GATE_PLACEMENTS = ['Center', 'NearZone']
const PORTAL_RULE_TYPES: McRuleType[] = ['Crossroads', 'MainObject']

export function ConnEditor({ conn }: { conn: Connection }) {
  const { t } = useTranslation()
  const patch = useEditorStore((s) => s.patchConnection)
  const zoneNames = useEditorStore(
    useShallow((s) => s.template.variants[s.activeVariant]?.zones?.map((z) => z.name) ?? []),
  )
  const guardMatchGroups = useEditorStore(
    useShallow((s) => {
      const vr = s.template.variants[s.activeVariant]
      const groups = new Set<string>()
      for (const c of vr?.connections ?? []) if (c.guardMatchGroup) groups.add(c.guardMatchGroup)
      return [...groups]
    }),
  )
  const id = conn.name ?? `${conn.from}-${conn.to}`
  const update = (p: Partial<Connection>) => patch(id, p)

  return (
    <div className="editor">
      <Section title={t('conn.sectionMain')} open persistKey="conn.main">
        <Text
          label={t('conn.nameLabel')}
          value={conn.name}
          placeholder={t('conn.namePlaceholder')}
          hint={t('conn.nameHint')}
          onChange={(v) => update({ name: v || undefined })}
        />
        <Select
          label={t('conn.fromLabel')}
          allowBlank={false}
          value={conn.from}
          onChange={(v) => update({ from: v })}
          options={zoneNames.map((z) => ({ value: z }))}
        />
        <Select
          label={t('conn.toLabel')}
          allowBlank={false}
          value={conn.to}
          onChange={(v) => update({ to: v })}
          options={zoneNames.map((z) => ({ value: z }))}
        />
        <Select
          label={t('conn.connectionTypeLabel')}
          hint={t('conn.connectionTypeHint')}
          allowBlank={false}
          value={conn.connectionType}
          onChange={(v) => update({ connectionType: v as ConnectionType })}
          options={CONN_TYPES.map((ct) => ({ value: ct, label: t(`conn.connTypes.${ct}`) }))}
        />
      </Section>

      <Section title={t('conn.sectionGuard')} open persistKey="conn.guard">
        <Num
          label={t('conn.guardValueLabel')}
          step={100}
          hint={t('conn.guardValueHint')}
          value={conn.guardValue}
          onChange={(v) => update({ guardValue: v })}
        />
        <Num label={t('conn.guardWeeklyLabel')} hint={t('conn.guardWeeklyHint')} step={0.05} value={conn.guardWeeklyIncrement} onChange={(v) => update({ guardWeeklyIncrement: v })} />
        <Num label={t('conn.guardRandomLabel')} hint={t('conn.guardRandomHint')} min={0} max={1} step={0.05} value={conn.guardRandomization} onChange={(v) => update({ guardRandomization: v })} />
        <Select
          label={t('conn.guardZoneLabel')}
          blankLabel="—"
          hint={t('conn.guardZoneHint')}
          value={conn.guardZone}
          onChange={(v) => update({ guardZone: v || undefined })}
          options={zoneNames.map((z) => ({ value: z }))}
        />
        <Label label={t('conn.guardGroupLabel')} hint={t('conn.guardGroupHint')}>
          <ComboInput
            text={conn.guardMatchGroup ?? ''}
            onText={(v) => update({ guardMatchGroup: v || undefined })}
            suggestions={guardMatchGroups.map((g) => ({ value: g }))}
            placeholder="spawn_main_guard_1"
          />
        </Label>
        <TriSelect label={t('conn.guardEscapeLabel')} hint={t('conn.guardEscapeHint')} value={conn.guardEscape} onChange={(v) => update({ guardEscape: v })} />
      </Section>

      <Section title={t('conn.sectionRoad')} persistKey="conn.road">
        <TriSelect label={t('conn.roadLabel')} hint={t('conn.roadHint')} value={conn.road} onChange={(v) => update({ road: v })} />
        <TriSelect label={t('conn.simTurnSquadLabel')} hint={t('conn.simTurnSquadHint')} value={conn.simTurnSquad} onChange={(v) => update({ simTurnSquad: v })} />
        {conn.connectionType === 'Proximity' && (
          <Num label={t('conn.lengthLabel')} step={1} hint={t('conn.lengthHint')} value={conn.length} onChange={(v) => update({ length: v })} />
        )}
      </Section>

      <Section title={t('conn.sectionGate')} persistKey="conn.gate">
        <Select
          label={t('conn.gatePlacementLabel')}
          blankLabel="—"
          hint={t('conn.gatePlacementHint')}
          value={conn.gatePlacement}
          onChange={(v) => update({ gatePlacement: v || undefined })}
          options={GATE_PLACEMENTS.map((p) => ({ value: p, label: t(`conn.gatePlacements.${p}`) }))}
        />
        <Select
          label={t('conn.gatePlacementArgsLabel')}
          blankLabel="—"
          hint={t('conn.gatePlacementArgsHint')}
          value={conn.gatePlacementArgs}
          onChange={(v) => update({ gatePlacementArgs: v || undefined })}
          options={zoneNames.map((z) => ({ value: z }))}
        />
      </Section>

      <Section title={t('conn.sectionPortalRules')} persistKey="conn.portalRules">
        <RulesEditor
          value={conn.portalPlacementRulesFrom ?? []}
          onChange={(rules) => update({ portalPlacementRulesFrom: rules.length > 0 ? rules : undefined })}
          label={t('conn.rulesFromLabel')}
          typeOptions={PORTAL_RULE_TYPES}
        />
        <RulesEditor
          value={conn.portalPlacementRulesTo ?? []}
          onChange={(rules) => update({ portalPlacementRulesTo: rules.length > 0 ? rules : undefined })}
          label={t('conn.rulesToLabel')}
          typeOptions={PORTAL_RULE_TYPES}
        />
      </Section>
    </div>
  )
}