# Читаемые исходники НеоДневника

`index.html` — собранный файл (его и раздаёт GitHub Pages). Чтобы править безопасно, правьте части в `src/` и `data/`, затем пересобирайте.

## Структура
- `src/manifest.json` — порядок частей в index.html
- `src/app.js` — основной код (отформатирован)
- `src/modules/*.js` — отдельные модули (save-guard, quick-input, shift-tools, aig-import, sw-register)
- `src/styles.css`, `src/html-*.html` — стили и разметка
- `data/protocols.json` — встроенные протоколы

## Команды
- Сборка: `python3 tools/build.py` (быстрая отладочная, без минификации: `--dev`)
- Разбор заново (если правили index.html напрямую): `python3 tools/extract.py index.html`

Нужны Node/esbuild и prettier (`npx` ставит сам).

## Проверка
Сборка из неизменённых `src/` даёт JS, идентичный оригиналу после `esbuild --minify-whitespace`. После правок поднимайте версию в `sw.js`.
