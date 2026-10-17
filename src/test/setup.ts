/**
 * Setup компонентных тестов (vitest-проект `ui`, окружение jsdom).
 *
 * - jest-dom добавляет матчеры (`toBeInTheDocument`, `toBeDisabled`, …);
 * - реальный i18n-инстанс приложения зафиксирован на ru — тесты ассертят
 *   русские строки локали, что заодно ловит отсутствующие ключи. Фиксация:
 *   jsdom сообщает navigator.language 'en-US', и без сохранённой локали
 *   приложение выбрало бы en (детект: localStorage → браузер → фолбэк en),
 *   поэтому до импорта i18n в localStorage пишется 'oe-editor.locale'='ru'.
 *   Импорт i18n и store динамический: статические импорты исполняются раньше
 *   кода этого файла, и i18n инициализировался бы до фиксации;
 * - cleanup размонтирует компоненты после каждого теста (vitest без globals
 *   не активирует автозачистку testing-library);
 * - сброс localStorage и UI-полей стора между тестами — префы PoolBrowser,
 *   ошибки JSON-черновиков и запросы навигации к группам не должны протекать
 *   из теста в тест.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Фиксируем ru ДО первой инициализации i18n (ключ читает detectLocale()).
localStorage.setItem('oe-editor.locale', 'ru')
await import('../i18n')
const { useEditorStore } = await import('../store/editorStore')

// jsdom не реализует scrollIntoView, а TemplateTree подводит строку выделения
// в видимую область дерева — без заглушки эффект падает в компонентных тестах.
// scrollTo (Element) не реализован так же: ManualDialog сбрасывает прокрутку
// просмотрщика при смене локали мануала.
Element.prototype.scrollIntoView = () => {}
Element.prototype.scrollTo = () => {}

afterEach(() => {
  cleanup()
  localStorage.clear()
  useEditorStore.setState({
    jsonDraftErrors: {},
    toasts: [],
    compareWith: null,
    sectionStates: {},
    groupTarget: null,
    inspectorTab: 'inspector',
  })
})
