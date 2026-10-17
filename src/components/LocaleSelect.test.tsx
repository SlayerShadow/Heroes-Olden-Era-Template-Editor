import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import i18n, { LOCALE_LS_KEY } from '../i18n'
import { LocaleSelect } from './LocaleSelect'

/**
 * Селектор локали (vitest-проект `ui`, jsdom; setup фиксирует ru).
 * Проверяет интерактивное переключение языка БЕЗ перезагрузки: onChange →
 * setLocale → i18next.changeLanguage → react-i18next перерисовывает дерево;
 * выбор пользователя пишется в localStorage, <html lang> обновляется.
 * Строки ассертятся настоящие из локалей (ключ locale.selectLabel).
 */

describe('LocaleSelect', () => {
  afterEach(async () => {
    // Возвращаем ru — setup зафиксировал её для остальных тестов файла,
    // а i18n-инстанс в пределах файла общий.
    await i18n.changeLanguage('ru')
    document.documentElement.lang = 'ru'
  })

  it('показывает текущую локаль и оба языка; без взаимодействия localStorage не трогает', () => {
    // Убираем пин setup'а — i18n уже инициализирован, проверяем «чистый» первый визит
    localStorage.removeItem(LOCALE_LS_KEY)
    render(<LocaleSelect />)
    const select = screen.getByLabelText(i18n.t('locale.selectLabel')) as HTMLSelectElement
    expect(select.value).toBe('ru')
    expect([...select.options].map((o) => o.textContent)).toEqual(['Русский', 'English'])
    // Пользователь селектор не трогал — выбор не сохраняется
    expect(localStorage.getItem(LOCALE_LS_KEY)).toBeNull()
  })

  it('переключение на English меняет язык интерфейса без перезагрузки и сохраняет выбор', async () => {
    render(<LocaleSelect />)
    const select = screen.getByLabelText(i18n.t('locale.selectLabel'))
    fireEvent.change(select, { target: { value: 'en' } })
    // aria-label перерисован уже английским — ждём фактический re-render
    const rerendered = (await screen.findByLabelText('Interface language')) as HTMLSelectElement
    expect(rerendered.value).toBe('en')
    expect(i18n.language).toBe('en')
    expect(localStorage.getItem(LOCALE_LS_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('переключение обратно на Русский тоже сохраняется', async () => {
    render(<LocaleSelect />)
    const select = screen.getByLabelText(i18n.t('locale.selectLabel'))
    fireEvent.change(select, { target: { value: 'en' } })
    fireEvent.change(await screen.findByLabelText('Interface language'), { target: { value: 'ru' } })
    const rerendered = (await screen.findByLabelText('Язык интерфейса')) as HTMLSelectElement
    expect(rerendered.value).toBe('ru')
    expect(localStorage.getItem(LOCALE_LS_KEY)).toBe('ru')
    expect(document.documentElement.lang).toBe('ru')
  })
})
