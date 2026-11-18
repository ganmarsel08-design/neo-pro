#!/usr/bin/env python3
"""Разовая разборка собранного index.html на читаемые части (src/, data/).
Запуск:  python3 tools/extract.py index.html
После разборки правят файлы в src/ и data/, а index.html собирает tools/build.py."""
import re, sys, json, subprocess, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
s = open(sys.argv[1], encoding='utf-8').read()
parts = []   # (kind, name, text)
pos = 0
for m in re.finditer(r'<(script|style)\b([^>]*)>(.*?)</\1>', s, re.S):
    parts.append(('html', None, s[pos:m.start()]))
    tag, attrs, body = m.group(1), m.group(2), m.group(3)
    parts.append((tag, attrs.strip(), body))
    pos = m.end()
parts.append(('html', None, s[pos:]))

names = {'save-guard': 'src/modules/save-guard.js', 'quick-input': 'src/modules/quick-input.js',
         'shift-tools': 'src/modules/shift-tools.js', 'aig-import': 'src/modules/aig-import.js'}
manifest = []
(root/'src').mkdir(exist_ok=True)
hn = 0
def fmt(path, parser):
    subprocess.run(['npx', '--yes', 'prettier', '--parser', parser, '--print-width', '120', '--quote-props', 'preserve', '--write', str(root/path)],
                   check=True, capture_output=True, cwd='/tmp/tools')
for kind, attrs, body in parts:
    if kind == 'html':
        if len(body) <= 100:
            manifest.append({'type': 'text', 'text': body})   # короткие промежутки между блоками
            continue
        hn += 1
        p = f'src/html-{hn:02d}.html'
        (root/p).write_text(body, encoding='utf-8')
        manifest.append({'file': p, 'type': 'html'})
    elif kind == 'style':
        p = 'src/styles.css'
        (root/p).write_text(body, encoding='utf-8'); fmt(p, 'css')
        manifest.append({'file': p, 'type': 'style', 'attrs': attrs})
    elif 'application/json' in attrs:
        p = 'data/protocols.json'
        data = json.loads(body)
        (root/p).write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        manifest.append({'file': p, 'type': 'json', 'attrs': attrs})
    else:
        idm = re.search(r'id="([^"]+)"', attrs)
        if idm and idm.group(1) in names: p = names[idm.group(1)]
        elif 'serviceWorker' in body[:400]: p = 'src/modules/sw-register.js'
        else: p = 'src/app.js'
        (root/p).write_text(body, encoding='utf-8')
        if p != 'src/modules/sw-register.js': fmt(p, 'babel')
        manifest.append({'file': p, 'type': 'script', 'attrs': attrs, 'minify': p == 'src/app.js'})
json.dump(manifest, open(root/'src/manifest.json', 'w'), ensure_ascii=False, indent=1)
print('ok', len(manifest), 'частей')
