import { Swords } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../store/editorStore'
import type { BiomeName } from '../types/viewMode'
import { BIOME_LAYERS, biomeColor } from '../utils/viewModes'
import { PLAYER_COLORS } from '../utils/zoneStyle'

const CONN_TYPES = [
  { name: 'Direct', color: '#d9b45b', width: 3, dash: undefined as string | undefined },
  { name: 'Default', color: '#8e96a6', width: 1.5, dash: undefined },
  { name: 'Portal', color: '#62a8f2', width: 2, dash: '7 5' },
  { name: 'Proximity', color: '#5cc4a4', width: 1.5, dash: '2 6' },
  { name: 'GladiatorArena', color: '#f0cf4a', width: 2.5, dash: '12 4' },
]

const BIOMES: BiomeName[] = ['Grass', 'Sand', 'Snow', 'Dirt', 'Deathland', 'Autumn', 'Lava']

function Players() {
  const { t } = useTranslation()
  return (
    <section className="legend__section">
      <h4>{t('legend.players')}</h4>
      <div className="legend__grid">
        {Object.entries(PLAYER_COLORS).map(([key, color]) => (
          <span key={key} className="legend__swatch">
            <i style={{ background: color }} />
            {key.replace('Player', 'P')}
          </span>
        ))}
      </div>
    </section>
  )
}

function Connections() {
  const { t } = useTranslation()
  return (
    <section className="legend__section">
      <h4>{t('legend.connections')}</h4>
      {CONN_TYPES.map((c) => (
        <div key={c.name} className="legend__conn">
          <svg width="60" height="10">
            <line x1="2" y1="5" x2="58" y2="5" stroke={c.color} strokeWidth={c.width} strokeDasharray={c.dash} />
          </svg>
          <span>{c.name}</span>
        </div>
      ))}
    </section>
  )
}

function Wealth() {
  const { t } = useTranslation()
  return (
    <section className="legend__section">
      <h4>{t('legend.wealth')}</h4>
      <div className="legend__grad" />
      <div className="legend__grad-labels">
        <span>0</span>
        <span>8M</span>
      </div>
    </section>
  )
}

function BudgetLegend() {
  const { t } = useTranslation()
  return (
    <>
      <Wealth />
      <section className="legend__section">
        <h4>{t('legend.budgetItems')}</h4>
        <div className="legend__hint">{t('legend.budgetNodesHint')}</div>
        <div className="legend__row">
          <span className="legend__dot" style={{ background: '#d9b45b' }} />
          <span>{t('legend.guardedValue')}</span>
        </div>
        <div className="legend__row">
          <span className="legend__dot" style={{ background: '#8e96a6' }} />
          <span>{t('legend.unguardedValue')}</span>
        </div>
        <div className="legend__row">
          <span className="legend__dot" style={{ background: '#5cc4a4' }} />
          <span>{t('legend.resourcesValue')}</span>
        </div>
        <div className="legend__hint">{t('legend.budgetSwitchHint')}</div>
      </section>
    </>
  )
}

function GuardLegend() {
  const { t } = useTranslation()
  return (
    <section className="legend__section">
      <h4>{t('legend.guards')}</h4>
      <div className="legend__row">
        <Swords size={12} />
        <span>{t('legend.guardMultiplier')}</span>
      </div>
      <div className="legend__row">
        <span className="legend__dot" style={{ background: 'hsl(30 55% 55%)' }} />
        <span>{t('legend.guardSmall')}</span>
        <span className="legend__dot" style={{ background: 'hsl(120 55% 55%)' }} />
        <span>{t('legend.guardLarge')}</span>
      </div>
      <div className="legend__hint">{t('legend.guardColorHint')}</div>
      <div className="legend__row">
        <span className="legend__dot" style={{ background: '#ff8f8f' }} />
        <span>{t('legend.guardNegative')}</span>
      </div>
      <div className="legend__conn">
        <span className="legend__guard">◆</span>
        <span>{t('legend.guardMatchGroup')}</span>
      </div>
    </section>
  )
}

function BiomeLegend() {
  const { t } = useTranslation()
  const biomeLayer = useEditorStore((s) => s.biomeLayer)
  return (
    <>
      <section className="legend__section">
        <h4>{t('legend.biomes')}</h4>
        <div className="legend__grid">
          {BIOMES.map((b) => (
            <span key={b} className="legend__swatch">
              <i style={{ background: biomeColor(b) }} />
              {t(`biomes.${b}`)}
            </span>
          ))}
        </div>
      </section>
      <section className="legend__section">
        <h4 title={BIOME_LAYERS.find((l) => l.id === biomeLayer)?.field}>
          {t('legend.activeLayer', { layer: t(`biomes.layers.${biomeLayer}`) })}
        </h4>
        <div className="legend__row"><span className="legend__mono">{t('legend.matchZoneSym')}</span><span>{t('legend.matchZoneDesc')}</span></div>
        <div className="legend__row"><span className="legend__mono">MO #0</span><span>{t('legend.matchObjectDesc')}</span></div>
        <div className="legend__row"><span className="legend__mono">{t('legend.diffFromSym')}</span><span>{t('legend.diffFromDesc')}</span></div>
        <div className="legend__row"><span className="legend__mono">{t('legend.anySym')}</span><span>{t('legend.anyDesc')}</span></div>
        <div className="legend__row"><span className="legend__mono">{t('legend.multiSym')}</span><span>{t('legend.multiDesc')}</span></div>
      </section>
    </>
  )
}

function RoadLegend() {
  const { t } = useTranslation()
  return (
    <>
      <section className="legend__section">
        <h4>{t('legend.roadsConn')}</h4>
        <div className="legend__conn">
          <svg width="60" height="10">
            <line x1="2" y1="5" x2="58" y2="5" stroke="#e8e6df" strokeWidth={2.4} />
          </svg>
          <span>{t('legend.roadTrue')}</span>
        </div>
        <div className="legend__conn">
          <svg width="60" height="10">
            <line x1="2" y1="5" x2="58" y2="5" stroke="#6a6f7c" strokeWidth={1.6} strokeDasharray="3 7" />
          </svg>
          <span>{t('legend.roadFalse')}</span>
        </div>
        <div className="legend__conn">
          <svg width="60" height="10">
            <line x1="2" y1="5" x2="58" y2="5" stroke="#454e60" strokeWidth={1.4} strokeDasharray="2 4" />
          </svg>
          <span>{t('legend.roadUnset')}</span>
        </div>
      </section>
      <section className="legend__section">
        <h4>{t('legend.roadInZone')}</h4>
        <div className="legend__conn">
          <svg width="60" height="10">
            <line x1="2" y1="5" x2="58" y2="5" stroke="#d8c9a0" strokeWidth={2.6} strokeLinecap="round" />
          </svg>
          <span>{t('legend.stoneRoad')}</span>
        </div>
        <div className="legend__conn">
          <svg width="60" height="10">
            <line x1="2" y1="5" x2="58" y2="5" stroke="#a08a62" strokeWidth={2.2} strokeDasharray="6 5" strokeLinecap="round" />
          </svg>
          <span>{t('legend.dirtRoad')}</span>
        </div>
        <div className="legend__conn">
          <span className="legend__mono" style={{ letterSpacing: 2 }}>■ ◯ ◆ ◎</span>
          <span>{t('legend.routeEnds')}</span>
        </div>
        <div className="legend__row"><span className="legend__mono">✕NN%</span><span>{t('legend.crossroads')}</span></div>
        <div className="legend__row"><span className="legend__mono">layout</span><span>{t('legend.layoutRow')}</span></div>
      </section>
    </>
  )
}

function MandatoryLegend() {
  const { t } = useTranslation()
  return (
    <>
      <section className="legend__section">
        <h4>{t('legend.mcPoints')}</h4>
        <div className="legend__row">
          <span className="legend__dot" style={{ background: '#c9d4e8' }} />
          <span>{t('legend.mcItem')}</span>
        </div>
        <div className="legend__row">
          <span className="legend__dot" style={{ background: '#62a8f2' }} />
          <span>{t('legend.mcMainObject')}</span>
        </div>
        <div className="legend__row">
          <span className="legend__dot" style={{ background: '#e0b34b' }} />
          <span>{t('legend.mcCrossroads')}</span>
        </div>
        <div className="legend__row">
          <span className="legend__dot" style={{ background: '#5cc4a4' }} />
          <span>{t('legend.mcConnection')}</span>
        </div>
        <div className="legend__row">
          <span className="legend__dot" style={{ background: '#b08ad9' }} />
          <span>{t('legend.mcSid')}</span>
        </div>
        <div className="legend__row">
          <span className="legend__dot" style={{ background: '#a8c68c' }} />
          <span>{t('legend.mcRoad')}</span>
        </div>
      </section>
      <section className="legend__section">
        <h4>{t('legend.mcRings')}</h4>
        <div className="legend__hint">{t('legend.mcRingHint')}</div>
        <div className="legend__hint">{t('legend.mcMineHint')}</div>
      </section>
    </>
  )
}

export function Legend() {
  const { t } = useTranslation()
  const viewMode = useEditorStore((s) => s.viewMode)

  return (
    <div className="legend">
      <h3 className="legend__title">{t('legend.title', { mode: t(`legend.mode.${viewMode}`) })}</h3>
      {viewMode === 'overview' && (
        <>
          <Players />
          <Connections />
          <Wealth />
        </>
      )}
      {viewMode === 'budget' && <BudgetLegend />}
      {viewMode === 'guard' && <GuardLegend />}
      {viewMode === 'biome' && (
        <>
          <BiomeLegend />
          <Players />
        </>
      )}
      {viewMode === 'road' && (
        <>
          <RoadLegend />
          <Players />
        </>
      )}
      {viewMode === 'mandatory' && <MandatoryLegend />}
    </div>
  )
}
