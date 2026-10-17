import { describe, expect, it } from 'vitest'
import { gameModeLabel } from './labels'

/**
 * Unit-тест labels.ts (vitest-проект `unit`, node): чистая функция,
 * перевод подменяется маппингом ключ → строка (как в реальном t()).
 */

const fakeT = (key: string): string =>
  key === 'root.gameModes.Classic.label'
    ? 'Классический'
    : key === 'root.gameModes.SingleHero.label'
      ? 'Один герой'
      : key

describe('gameModeLabel', () => {
  it('известные режимы — русское имя из ключей root.gameModes.*.label', () => {
    expect(gameModeLabel('Classic', fakeT)).toBe('Классический')
    expect(gameModeLabel('SingleHero', fakeT)).toBe('Один герой')
  })

  it('неизвестное значение (битый файл) — сырая строка, без подстановки ключа', () => {
    expect(gameModeLabel('Weird', fakeT)).toBe('Weird')
  })
})
