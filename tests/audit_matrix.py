"""Матрица «до/после» по дефектам AUDIT.md: прогоняет tests/test_audit.py на базовой сборке и на текущей.
Запуск: python3 tests/audit_matrix.py [база=origin/main]
Падения на базе ожидаемы (дефект воспроизведён). Выход 1 — только если текущая сборка не проходит."""
import os, pathlib, subprocess, sys, tempfile, xml.etree.ElementTree as ET
ROOT = pathlib.Path(__file__).resolve().parent.parent
ref = sys.argv[1] if len(sys.argv) > 1 else 'origin/main'


def run(index):
    xml = tempfile.mktemp(suffix='.xml')
    subprocess.run([sys.executable, '-m', 'pytest', 'tests/test_audit.py', '-q', '-p', 'no:cacheprovider', f'--junitxml={xml}'],
                   cwd=ROOT, env=dict(os.environ, NEO_INDEX=str(index)), capture_output=True)
    res = {}
    for tc in ET.parse(xml).getroot().iter('testcase'):
        st = 'ok'
        if tc.find('failure') is not None or tc.find('error') is not None: st = 'FAIL'
        if tc.find('skipped') is not None: st = 'xfail (открыт)'
        res[tc.get('name')] = st
    return res


base = pathlib.Path(tempfile.mktemp(suffix='.html'))
sha = subprocess.run(['git', 'rev-parse', '--short', ref], cwd=ROOT, capture_output=True, text=True).stdout.strip()
base.write_bytes(subprocess.run(['git', 'show', f'{ref}:index.html'], cwd=ROOT, capture_output=True, check=True).stdout)
head = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, capture_output=True, text=True).stdout.strip()
b, c = run(base), run(ROOT / 'index.html')
lines = [f'| Проверка | {ref} `{sha}` | HEAD `{head}` |', '|---|---|---|']
lines += [f'| {n} | {b.get(n, "—")} | {c.get(n, "—")} |' for n in c]
out = '\n'.join(lines); print(out)
if os.environ.get('GITHUB_STEP_SUMMARY'):
    open(os.environ['GITHUB_STEP_SUMMARY'], 'a').write('### Матрица дефектов AUDIT.md\n\n' + out + '\n')
sys.exit(1 if any(v == 'FAIL' for v in c.values()) else 0)
