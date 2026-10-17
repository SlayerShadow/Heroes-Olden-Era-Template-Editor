import { validateTemplate } from '../src/utils/validate.ts'
import { readFileSync } from 'node:fs'
import { sampleTemplate } from '../src/data/sampleTemplate.ts'

function run(name, tpl) {
  const r = validateTemplate(tpl)
  console.log(`\n== ${name}: errors:${r.errors} warnings:${r.warnings} infos:${r.infos}`)
  // После i18n-рефакторинга validate.ts возвращает code+params (тексты — в src/i18n/locales/*/validator/).
  for (const i of r.issues) console.log(`   [${i.severity}] ${i.scope.code}${i.scope.params ? ' ' + JSON.stringify(i.scope.params) : ''}: ${i.code}${i.params ? ' ' + JSON.stringify(i.params) : ''}`)
}

// Путь резолвится от расположения скрипта — запуск из любой cwd.
const path = new URL('../export/JebusCross.rmg.json', import.meta.url)
const base = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))

run('JebusCross эталон', base)
run('Sample редактора', sampleTemplate)

const bad = structuredClone(base)
bad.valueOverrides.push({ sid: '', variant: -2, guardValue: -500 }, { sid: 'point_of_balance', variant: 0, guardValue: 100 })
bad.gameRules = { ...bad.gameRules, heroCountMin: 9, heroCountMax: 4, heroHireBan: true, bonuses: [{ sid: '', receiverSide: 3, parameters: [] }] }
bad.globalBans = { magics: ['a', 'b', 'a'], items: ['x', 'x'] }
bad.zoneLayouts[0].name = ''
bad.zoneLayouts.push({ name: bad.zoneLayouts[1].name })
bad.gameRules.winConditions = { ...bad.gameRules.winConditions, desertionDay: 3, desertion: false, tournament: true, tournamentDays: [4, 4], tournamentAnnounceDays: [3] }
run('Испорченный (все новые проверки)', bad)