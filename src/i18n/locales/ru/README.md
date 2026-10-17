# Локаль `ru` — структура файлов

Строки UI разбиты по доменным файлам (как CSS по компонентам): каждый файл
владеет своими верхнеуровневыми группами ключей, ключи `t('…')` в компонентах
не зависят от раскладки. Неймспейсов i18next по-прежнему два — `common` и
`validator` (см. `src/i18n/index.ts`); слияние файлов в ресурс выполняют
`common/index.ts` и `validator/index.ts`, их подхватывает `src/i18n/resources.ts`.

```
ru/
├── common/            # неймспейс common — строки UI
│   ├── index.ts       # ruCommon = { ...app, ...dialogs, … } — слияние файлов
│   ├── app.json       # app, locale, fs, store, toasts — шапка, файловые ошибки, тосты
│   ├── biomes.json    # biomes — словарь имён биомов и слоёв (чипы инспектора и канвы, легенда, узлы)
│   ├── dialogs.json   # manual, pick, preview, confirm — модальные окна
│   ├── panels.json    # sidebar, inspector, tree, compare, validator — боковые панели
│   ├── canvas.json    # graph, zoneNode, edge, legend, mcPoint — схема шаблона
│   ├── shared.json    # fields, jsonEditor, mcRules — сквозные компоненты
│   ├── zone.json      # zone — инспектор зоны
│   ├── conn.json      # conn — инспектор связи
│   ├── variant.json   # variant — панель варианта карты
│   ├── root.json      # root, rootPanels — корень шаблона
│   ├── roads.json     # roads, roadEnd — дороги
│   ├── pools.json     # pools, poolList, poolTags, poolNames — пулы контента
│   └── error.json     # error — экран краша рендера (ErrorBoundary)
└── validator/         # неймспейс validator — тексты замечаний валидатора
    ├── index.ts       # RU_SCOPES/RU_ISSUES (Record<ScopeCode|IssueCode, string>)
    ├── scope.json     # подписи областей замечаний (8 кодов ScopeCode)
    └── issues/        # тексты замечаний, ключи — коды IssueCode, по группам validate.ts
        ├── root.json       # корень: общее, группы контента, overrides/bans/rules, zoneLayouts
        ├── variant.json    # вариант + ориентация макета (orientation*) + граница карты (border*)
        ├── connection.json # связи (conn*)
        ├── zone.json       # зоны: ссылки (zoneRef*), поля зоны, правила групп (mcGroupRule*)
        └── road.json       # дороги (road*)
```

## Правила правок

- Новая строка UI → ключ в файл, владеющий его доменной группой; новая
  верхнеуровневая группа → файл по домену (или новый файл + импорт в
  `common/index.ts`).
- Новый код `IssueCode`/`ScopeCode` → перевод в соответствующий
  `validator/issues/*.json` / `scope.json`; без него ломает `npm run build`
  (компиляторная проверка `Record<…>` в `validator/index.ts`).
- Ключ не может встречаться в двух файлах одного неймспейса: spread при слиянии
  молча затрёт дубль — целостность сборки (нет потерь и дублей) проверяет тест
  `src/i18n/locales.test.ts`.
- Формат файлов: JSON, отступ 2 пробела, перевод строки в конце.
