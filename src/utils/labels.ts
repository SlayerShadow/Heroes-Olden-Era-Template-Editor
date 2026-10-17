/**
 * Читаемые имена доменных enum для UI-мест без собственного компонента (шапка, дерево, диалог выбора).
 * Слой чистый: возвращает строки, перевод делегируется колбэком translate (прецедент — fsErrorMessage).
 */

/**
 * Русское имя режима игры шаблона: ключи `root.gameModes.*.label` (те же, что у
 * поля «Режим игры» в RootPanel). Значения вне известной пары (битые файлы)
 * возвращаются сырой строкой — их отдельно сигнализирует валидатор.
 */
export function gameModeLabel(mode: string, translate: (key: string) => string): string {
  return mode === 'Classic' || mode === 'SingleHero' ? translate(`root.gameModes.${mode}.label`) : mode
}
