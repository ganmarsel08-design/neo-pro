# Читаемые исходники НеоДневника

`index.html` — собранный файл (его раздаёт GitHub Pages). Правьте части в `src/` и `data/`, затем пересобирайте.

## Структура
- `src/manifest.json` — порядок частей в index.html и подстановки данных (`subst`)
- `src/app.js` — основной код (отформатирован)
- `src/modules/` — отдельные модули:
  - `save-guard.js` — предупреждение о несохранённых данных
  - `quick-input.js`, `shift-tools.js`, `aig-import.js`, `sw-register.js`
  - `proto-hints.js` — подсказки по протоколам РК (правила «Антидефекта» подставляются из `data/antidefect-rules.json`)
  - `shift-log.js` — журнал смены и диктовка по нескольким детям
  - `express.js` — главный экран и экспресс-дневник (весь день, кормление, мл/кг/сут)
  - `conds.js` — карточки заболеваний «как в мире» (метаданные протоколов РК — из `data/kz-protocols-meta.json`)
- `src/styles.css`, `src/html-*.html` — стили и разметка
- `data/protocols.json` — встроенная база 29 протоколов РК. **Не менять**: сборка выдаёт её байт в байт.
- `data/antidefect-rules.json` — правила «Антидефекта» (кандидаты, не утверждены экспертом)
- `data/kz-protocols-meta.json` — номера, даты протоколов РК для карточек

## Команды
- Сборка: `python3 tools/build.py` (без минификации: `--dev`)
- Сравнить с прежней сборкой: `python3 tools/verify.py старый-index.html index.html`
- Проверить цитаты протоколов в карточках: `node tools/check-quotes.js`
- Разбор заново (если правили index.html напрямую): `python3 tools/extract.py index.html`

Нужны Node, esbuild и prettier (`npx` ставит сам). После правок поднимайте версию в `sw.js`.
