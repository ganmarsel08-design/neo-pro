#!/usr/bin/env python3
"""Собирает index.html из src/ и data/ по src/manifest.json.
Запуск:  python3 tools/build.py            -> index.html
         python3 tools/build.py --dev      -> без сжатия (удобно читать в браузере)
Нужен Node.js (esbuild подтягивается через npx)."""
import json, pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parent.parent
dev = '--dev' in sys.argv

def esbuild(code, loader, minify_whitespace_only=False):
    if dev: return code
    args = ['npx', '--yes', 'esbuild', f'--loader={loader}', '--charset=utf8']
    args += ['--minify-whitespace'] if loader == 'js' else ['--minify']
    r = subprocess.run(args, input=code, text=True, capture_output=True, encoding='utf-8')
    if r.returncode: raise SystemExit('esbuild: ' + r.stderr)
    return r.stdout.rstrip('\n')

out = []
for part in json.load(open(root / 'src/manifest.json', encoding='utf-8')):
    t = part['type']
    if t == 'text':
        out.append(part['text']); continue
    body = (root / part['file']).read_text(encoding='utf-8')
    for ph, df in (part.get('subst') or {}).items():   # данные подставляются при сборке: правила «Антидефекта», метаданные протоколов
        if ph not in body: raise SystemExit(f'{part["file"]}: нет метки {ph}')
        body = body.replace(ph, (root / df).read_text(encoding='utf-8').strip())
    if t == 'html':
        out.append(body); continue
    attrs = (' ' + part['attrs']) if part.get('attrs') else ''
    tag = 'style' if t == 'style' else 'script'
    if t == 'style':   body = esbuild(body, 'css')
    elif t == 'json':  body = json.dumps(json.loads(body), ensure_ascii=False).replace('</', '<\\/')  # формат как в исходном index.html — база протоколов байт в байт
    elif part.get('minify'): body = esbuild(body, 'js')
    if '</script' in body.lower() and tag == 'script':
        raise SystemExit(f'{part["file"]}: внутри кода встретилось </script — разделите строку')
    out.append(f'<{tag}{attrs}>{body}</{tag}>')
(root / 'index.html').write_text(''.join(out), encoding='utf-8')
print('index.html', (root / 'index.html').stat().st_size, 'байт')
