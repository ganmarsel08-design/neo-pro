#!/usr/bin/env python3
"""Сравнивает две сборки index.html по частям: разметка, стили и скрипты — после esbuild, база протоколов — по содержанию.
Запуск:  python3 tools/verify.py старый.html [новый.html]"""
import re, json, subprocess, sys, pathlib
A=open(sys.argv[1],encoding='utf-8').read(); B=open(sys.argv[2] if len(sys.argv)>2 else 'index.html',encoding='utf-8').read()
def parts(s):
    out=[]; pos=0
    for m in re.finditer(r'<(script|style)\b([^>]*)>(.*?)</\1>', s, re.S):
        out.append(('html','',s[pos:m.start()])); out.append((m.group(1),m.group(2).strip(),m.group(3))); pos=m.end()
    out.append(('html','',s[pos:])); return out
def mini(code,loader):
    r=subprocess.run([str(pathlib.Path(__file__).resolve().parent.parent/'node_modules/.bin/esbuild'),'--loader='+loader,'--charset=utf8','--minify-whitespace' if loader=='js' else '--minify'],input=code,text=True,capture_output=True,encoding='utf-8')
    if r.returncode: raise SystemExit(r.stderr)
    return r.stdout
pa,pb=parts(A),parts(B); print('parts',len(pa),len(pb)); bad=0
for (ka,aa,ta),(kb,ab,tb) in zip(pa,pb):
    if ka!=kb or aa!=ab: print('TAG MISMATCH',ka,aa,kb,ab); bad+=1; continue
    if ka=='html': same = ta.strip()==tb.strip()
    elif 'application/json' in aa: same = json.loads(ta)==json.loads(tb)
    elif ka=='style': same = mini(ta,'css')==mini(tb,'css')
    else: same = ta==tb or mini(ta,'js')==mini(tb,'js')
    print(('OK ' if same else 'DIFF'), ka, aa[:40], len(ta), len(tb)); bad+= not same
print('mismatches:',bad)
