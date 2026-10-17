/**
 * Хеш URL как адрес открытого раздела мануала.
 *
 * Приложение без роутера, и хеш принадлежит целиком мануалу: `#<id-заголовка>`
 * в адресной строке означает «открыть мануал и подскроллить к этому заголовку»
 * (App читает хеш при старте, ManualDialog скроллит и пишет хеш при кликовой
 * навигации, при закрытии мануала хеш стирается).
 *
 * Запись и стирание — без записей в истории (replace-семантика): «Назад»
 * выводит из приложения, а не ходит по разделам мануала.
 *
 * Основной механизм — `history.replaceState`: чистая перезапись адресной
 * строки без побочных эффектов, скролл полностью остаётся под управлением
 * мануала (плавный scrollIntoView). На `file://` (single-file релиз) Chrome
 * запрещает History API для документов с origin null (SecurityError) — там
 * фолбэк `location.replace('#…')`: same-document навигация без перезагрузки
 * и без новой записи истории, но браузер сам выполняет мгновенный прыжок к
 * элементу (вместо плавного). Это приемлемая деградация только для file://;
 * http (dev-сервер, GitHub Pages) всегда идёт через replaceState.
 */

/** Чистая функция: якорь из хеша (`#якорь` → `якорь`, percent-decoded); null, если хеша нет. */
export function anchorFromHash(hash: string): string | null {
  if (hash.length <= 1 || hash[0] !== '#') return null
  const raw = hash.slice(1)
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw // невалидный percent-encoding (напр. «#100%») — трактуем как есть
  }
}

/** Якорь текущего раздела мануала из URL; null, если хеш пуст. */
export function readManualAnchor(): string | null {
  return anchorFromHash(window.location.hash)
}

/** Записать якорь раздела в URL: replaceState, на file:// фолбэк location.replace. */
export function writeManualAnchor(id: string): void {
  try {
    window.history.replaceState(null, '', `#${id}`)
  } catch {
    window.location.replace(`#${id}`)
  }
}

/** Стереть хеш из URL без перезагрузки страницы (same-document навигация). */
export function clearManualAnchor(): void {
  const bare = window.location.pathname + window.location.search
  try {
    window.history.replaceState(null, '', bare)
  } catch {
    // Фолбэк file://: удаление фрагмента через location.replace(bare) Chrome
    // исполняет как полную перезагрузку страницы, а location.hash = '' плодит
    // лишнюю запись истории («Назад» вернул бы хеш и снова открыл мануал).
    // replace('#') — единственный same-document-вариант без роста истории;
    // в адресной строке остаётся хвостовой '#' (location.hash читается как ''),
    // что anchorFromHash корректно трактует как «якоря нет».
    window.location.replace('#')
  }
}
