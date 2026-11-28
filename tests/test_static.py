"""Проверки без браузера: сборка воспроизводима, база протоколов не изменена, цитаты РК дословны, известные дефекты синхронизации."""
import json, pathlib, subprocess, hashlib, pytest
ROOT = pathlib.Path(__file__).resolve().parent.parent


def test_build_reproducible(tmp_path):
    before = (ROOT / 'index.html').read_bytes()
    subprocess.run(['python3', 'tools/build.py'], cwd=ROOT, check=True, capture_output=True)
    after = (ROOT / 'index.html').read_bytes()
    (ROOT / 'index.html').write_bytes(before)
    assert hashlib.sha256(before).hexdigest() == hashlib.sha256(after).hexdigest(), 'index.html не совпадает со сборкой из src/ — пересоберите'


def test_protocols_unchanged():
    """29 протоколов РК — эталонный хэш содержимого; менять нельзя."""
    p = json.loads((ROOT / 'data/protocols.json').read_text(encoding='utf-8'))
    assert len(p['items']) == 29
    h = hashlib.sha256(json.dumps(p, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    assert h == (ROOT / 'tests/protocols.sha256').read_text().strip()


def test_kz_quotes_verbatim():
    r = subprocess.run(['node', 'tools/check-quotes.js'], cwd=ROOT, capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr


def test_sync_two_devices_keeps_both_edits():
    r = subprocess.run(['node', 'tests/sync_merge.js'], cwd=ROOT, capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
