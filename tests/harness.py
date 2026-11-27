"""Общая обвязка браузерных тестов НеоДневника. Только синтетические данные.

Сборка под тестом: переменная NEO_INDEX (по умолчанию index.html в корне).
Копия сборки кладётся во временную папку; в копии отключён экран активации —
в репозиторий эта правка не попадает.
"""
import asyncio, contextlib, datetime, http.server, json, os, pathlib, shutil, socket, tempfile, threading

ROOT = pathlib.Path(__file__).resolve().parent.parent
ACTIVATION = 'if(O0&&!kx())return ca();'
TZ = datetime.timezone(datetime.timedelta(hours=5))  # Алматы
CHROME = os.environ.get('NEO_CHROME') or (shutil.which('google-chrome') or None)


def site(index_path=None):
    """Папка с копией сайта; возвращает путь."""
    src = pathlib.Path(index_path or os.environ.get('NEO_INDEX') or ROOT / 'index.html')
    d = pathlib.Path(tempfile.mkdtemp(prefix='neo-site-'))
    for f in ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']:
        if (ROOT / f).exists(): shutil.copy(ROOT / f, d / f)
    html = src.read_text(encoding='utf-8')
    if html.count(ACTIVATION) != 1:
        raise RuntimeError('Не нашёл проверку активации в сборке — обновите tests/harness.py')
    (d / 'index.html').write_text(html.replace(ACTIVATION, 'if(0)return ca();'), encoding='utf-8')
    return d


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


@contextlib.contextmanager
def serve(index_path=None):
    d = site(index_path)
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), lambda *a, **k: _Quiet(*a, directory=str(d), **k))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try: yield f'http://127.0.0.1:{port}'
    finally: srv.shutdown(); shutil.rmtree(d, ignore_errors=True)


def kid(id, label, bd='2026-11-25', ga='32', bw='1800', **kw):
    k = {'id': id, 'label': label, 'bd': bd, 'bt': '10:00', 'ga': ga, 'bw': bw, 'days': {}, 'upd': 1}
    k.update(kw); return k


async def open_app(browser, base, kids, now=(2026, 11, 26, 16, 0), hash='#kids', tools=True):
    """Новая вкладка с детьми и замороженными часами. Возвращает (page, errs, dialogs)."""
    ctx = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, timezone_id='Asia/Almaty', locale='ru-RU')
    page = await ctx.new_page(); errs, dialogs = [], []
    if now: await page.clock.install(time=datetime.datetime(*now, tzinfo=TZ))
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.accept_dialogs = False  # по умолчанию «Отмена» на confirm — так проверяется, что без согласия ничего не пишется

    def on_dialog(d):
        dialogs.append(d.message)
        asyncio.ensure_future(d.accept() if (page.accept_dialogs or d.type == 'alert') else d.dismiss())
    page.on('dialog', on_dialog)
    await page.add_init_script("""try{ sessionStorage.setItem('neo.open','1'); %s
      if(!localStorage.getItem('neo.kids')) localStorage.setItem('neo.kids', %s); }catch(e){}"""
                               % ("localStorage.setItem('neo.ex.tools','1');" if tools else '', json.dumps(json.dumps(kids))))
    await page.goto(base + '/' + hash); await page.wait_for_timeout(1500)
    return page, errs, dialogs


QUOTA_JS = """(()=>{const o=Storage.prototype.setItem; window.__realSet=o; Storage.prototype.setItem=function(k,v){
  if(k==='neo.kids'){const e=new Error('quota'); e.name='QuotaExceededError'; throw e;} return o.call(this,k,v);};})()"""


def nurse_code(rows):
    """QR медсестры: NEOV1.<base64url(JSON)>; rows: [{l, d, t, v:{...}, n}]"""
    import base64
    return 'NEOV1.' + base64.urlsafe_b64encode(json.dumps(rows, ensure_ascii=False).encode()).decode().rstrip('=')


def shift_code(kids):
    """Код передачи смены без сжатия: NEOS1.<base64url(JSON)>"""
    import base64, time
    return 'NEOS1.' + base64.urlsafe_b64encode(json.dumps({'v': 1, 'at': int(time.time() * 1000), 'kids': kids}, ensure_ascii=False).encode()).decode().rstrip('=')
