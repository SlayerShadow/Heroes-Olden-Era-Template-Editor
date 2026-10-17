# Редактор RMG-шаблонов Olden Era

Веб-редактор шаблонов случайных карт (`.rmg.json`) для **Heroes of Might and Magic: Olden Era** + пользовательский мануал и справочник формата игры (`docs/manual/`, ru/en, на русском и английском).

## Стек

Vite + React 19 + TypeScript, без роутера и бэкенда — всё работает в браузере.

- `zustand` — единственный store (`src/store/editorStore.ts`), все мутации шаблона через его actions с undo/redo.
- `@xyflow/react` — канва схемы зон (6 режимов отображения).
- `i18next` / `react-i18next` — UI-строки (локали `ru` и `en`).
- `vitest` — unit-тесты чистых функций (`*.test.ts`, окружение node) + компонентные (`*.test.tsx`, jsdom + testing-library).
- Playwright — E2E-сценарии (`src/test/integration/`), матрица chromium/firefox/webkit.

## Быстрый старт

```bash
npm install
npm run dev
```

Откроется dev-сервер Vite (по умолчанию `http://localhost:5173`).

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер Vite |
| `npm run build` | `tsc -b && vite build` — **это и есть typecheck** в `dist/` |
| `npm run release` | single-file дистрибуция: один `dist/heroes-oe-template-editor.html`, работающий с `file://` без сервера |
| `npm run preview` | локальный просмотр production-сборки |
| `npm run lint` | oxlint (предупреждения не валят exit code) |
| `npm run test` | `vitest run` — все тесты |
| `npm run test:watch` | vitest в watch-режиме |
| `npm run test:e2e` | E2E-прогон Playwright (нужны браузеры: `npx playwright install`) |
| `npm run pools` | регенерация `src/data/poolCatalog.ts` (нужен путь к core_db) |
| `npm run names` | регенерация `src/data/sidNames.ts` (нужен путь к core_db) |
| `npm run sample` | регенерация демо-пары `src/data/sampleTemplate.*` для кадров мануала |

Порядок проверки перед коммитом: `npm run lint` → `npm run test` → `npm run build`. Дополнительная живая проверка валидатора: `node scripts/check_root_validate.mjs` (нужен Node ≥ 22.18 — нативный TS type-stripping; эталон `export/JebusCross.rmg.json` обязателен).

## CI

`.github/workflows/ci.yml` — GitHub Actions: на push/PR — lint → test → build → release (single-file HTML прилагается артефактом прогона) → E2E (reusable-workflow `playwright.yml`, матрица трёх браузеров). Из `main` — публикация релизного HTML на GitHub Pages (копией в `index.html`; один раз включить: Settings → Pages → Source: GitHub Actions). Эталон `export/JebusCross.rmg.json` и крупные штатные шаблоны в git не входят (данные игры — лицензия) — эталонные тесты валидатора в CI скипаются (`describe.skipIf`), локально гоняются полностью. Эталон E2E `export/One To One.rmg.json`, напротив, закоммичен (сгенерирован самим редактором) — `first-template.spec.ts` выполняется в CI на chromium.

## Структура

```
src/            код редактора (store, utils, компоненты, i18n, генерируемые data/)
scripts/        генераторы каталогов (buildPools, buildSidNames, buildSample) и check_root_validate.mjs
.github/        CI: GitHub Actions — тесты + release, публикация на GitHub Pages
docs/manual/    мануал редактора: ru/ — источник истины, en/ — зеркало; инлайнится в бандл
public/         статические ассеты
export/         рабочая папка (в git только One To One.rmg.json — эталон E2E); локально обязателен эталон JebusCross.rmg.json
```

## Документация

Пользовательская документация — в `docs/manual/`: главы `NN-slug.md` встраиваются в приложение на сборке и доступны по кнопке «Документация» в самом редакторе (локали ru/en). Начинать стоит с [обзора](docs/manual/ru/00-review.md) и [быстрого старта](docs/manual/ru/01-quick-start.md); справочник формата `.rmg.json` — глава [«Формат .rmg.json»](docs/manual/ru/17-rmg-json.md); про установку шаблона в игру — [«Установка шаблона»](docs/manual/ru/16-install.md).

## Требования браузера

Полноценная работа с папкой шаблонов (открытие/сохранение пары `.rmg.json` + `.editor.json` + авто-PNG) использует **File System Access API — только Chrome/Edge**. В других браузерах работают фолбэки: открытие через upload файла/папки, сохранение через download.

## Генерируемые файлы — не редактировать вручную

- `src/data/poolCatalog.ts` (~1 МБ) — `node scripts/buildPools.mjs <путь-к-core_db>` (или `npm run pools -- <путь>`, или env `CORE_DB`).
- `src/data/sidNames.ts` (~90 КБ) — `node scripts/buildSidNames.mjs <путь-к-core_db>` (или `npm run names -- <путь>`).

Источник — распакованная база `HeroesOldenEra_Data\StreamingAssets\Core.zip` (путь обязателен, зашитого дефолта нет). Генераторы детерминированы (zero-diff), результаты закоммичены — сборка не сломается без core_db.

## Файлы игры — только чтение

Установленную игру никогда не изменять. Пользовательские шаблоны кладутся только в `...\AppData\LocalLow\Unfrozen\HeroesOldenEra\users\Steam_<id>\my_map_templates\`; `.foldercache` руками не трогать — игра перестраивает его сама. Пути и детали — в главах мануала [«Файлы шаблонов»](docs/manual/ru/05-files.md) и [«Установка шаблона»](docs/manual/ru/16-install.md).
