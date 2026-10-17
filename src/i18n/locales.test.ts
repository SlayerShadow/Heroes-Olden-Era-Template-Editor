import { describe, expect, it } from 'vitest'
import { enCommon } from './locales/en/common'
import { EN_ISSUES, EN_SCOPES } from './locales/en/validator'
import enScopeJson from './locales/en/validator/scope.json'
import { ruCommon } from './locales/ru/common'
import { RU_ISSUES, RU_SCOPES } from './locales/ru/validator'
import ruScopeJson from './locales/ru/validator/scope.json'

/**
 * Целостность сборки локалей (ru и en) из доменных файлов (индексы
 * locales/<локаль>/common и locales/<локаль>/validator): ни один файл не забыт
 * в слиянии, ключи не задвоены между файлами (spread молча затирал бы дубли),
 * значения не искажены. Исчерпаемость IssueCode/ScopeCode дополнительно
 * гарантирует компилятор (Record<…, string> в индексах validator обеих локалей).
 * Паритет ключей ru↔en здесь намеренно не проверяется: en может легально
 * отставать от ru (недостающий ключ i18next закроет фолбэком на ru).
 */

type Json = Record<string, unknown>

const commonFiles = {
  ru: import.meta.glob<Json>('./locales/ru/common/*.json', { eager: true, import: 'default' }),
  en: import.meta.glob<Json>('./locales/en/common/*.json', { eager: true, import: 'default' }),
}
const issueFiles = {
  ru: import.meta.glob<Json>('./locales/ru/validator/issues/*.json', { eager: true, import: 'default' }),
  en: import.meta.glob<Json>('./locales/en/validator/issues/*.json', { eager: true, import: 'default' }),
}

const merged = {
  ru: {
    common: ruCommon as Json,
    issues: RU_ISSUES as unknown as Json,
    scopes: RU_SCOPES as unknown as Json,
    scopeJson: ruScopeJson as Json,
  },
  en: {
    common: enCommon as Json,
    issues: EN_ISSUES as unknown as Json,
    scopes: EN_SCOPES as unknown as Json,
    scopeJson: enScopeJson as Json,
  },
}

/** Ключи верхнего уровня всех файлов, с проверкой отсутствия дублей. */
function topKeys(files: Record<string, Json>): string[] {
  const seen = new Map<string, string>()
  for (const [file, json] of Object.entries(files)) {
    for (const key of Object.keys(json)) {
      expect(seen.has(key), `ключ "${key}" продублирован в ${seen.get(key)} и ${file}`).toBe(false)
      seen.set(key, file)
    }
  }
  return [...seen.keys()].sort()
}

for (const locale of ['ru', 'en'] as const) {
  describe(`${locale}-локаль: сборка неймспейса common`, () => {
    it('верхнеуровневые группы не дублируются между файлами', () => {
      expect(topKeys(commonFiles[locale]).length).toBeGreaterThan(0)
    })

    it('слитый common содержит в точности объединение ключей файлов', () => {
      expect(Object.keys(merged[locale].common).sort()).toEqual(topKeys(commonFiles[locale]))
    })

    it('значения слитого common совпадают со значениями в файлах', () => {
      for (const json of Object.values(commonFiles[locale])) {
        for (const [key, value] of Object.entries(json)) {
          expect(merged[locale].common[key], `ключ "${key}"`).toEqual(value)
        }
      }
    })
  })

  describe(`${locale}-локаль: сборка неймспейса validator`, () => {
    it('коды issues не дублируются между файлами', () => {
      expect(topKeys(issueFiles[locale]).length).toBeGreaterThan(0)
    })

    it('ISSUES содержит в точности объединение кодов из issues/*', () => {
      expect(Object.keys(merged[locale].issues).sort()).toEqual(topKeys(issueFiles[locale]))
    })

    it('значения ISSUES совпадают со значениями в файлах', () => {
      for (const json of Object.values(issueFiles[locale])) {
        for (const [code, value] of Object.entries(json)) {
          expect(merged[locale].issues[code], `код "${code}"`).toEqual(value)
        }
      }
    })

    it('SCOPES совпадает со scope.json', () => {
      expect(merged[locale].scopes).toEqual(merged[locale].scopeJson)
    })
  })
}
