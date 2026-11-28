"""storage-v1: сценарии S1–S5 (синтетические данные, временная база браузера на каждый тест).
S1 обрыв восстановления на каждом шаге; S2 повреждённые/чужие файлы; S3 повторный импорт и конфликты event_id;
S4 quota при миграции; S5 стабильный patient_id и занятая койка."""
import json, hashlib, pytest
from harness import open_app, kid

pytestmark = pytest.mark.asyncio
B = [kid('b1', 'Кувез 1', ga='32', bw='1500'), kid('b2', 'Кувез 2', ga='30', bw='1300')]
NOW = (2026, 11, 27, 10, 0)


def backup(kids, v=2, mutate=None, dele=None):
    payload = json.dumps({'kids': kids, 'del': dele or {}, 'team': None, 'teamT': 0}, ensure_ascii=False)
    f = {'app': 'neo-pro', 'v': v, 'saved': '2026-11-27T00:00:00Z', 'sum': hashlib.sha256(payload.encode()).hexdigest(), 'payload': payload}
    if mutate: f = mutate(f)
    return json.dumps(f, ensure_ascii=False)


async def verify_restore(page, text):
    return await page.evaluate("""async (t)=>{const v=await window.__neoStore.verify(t); if(!v.ok) return {v:v};
       try{ const r=await window.__neoStore.restore(v.data); return {v:{ok:true}, r:r}; }catch(e){ return {crash:String(e.message)} }}""", text)


async def state(page):
    return await page.evaluate("""async()=>({sha:await window.__neoStore.dbSha(), kids:JSON.parse(localStorage.getItem('neo.kids')||'[]'),
       left:['restore.journal','restore.snap','restore.stage'].filter(k=>localStorage.getItem('neo.'+k)!==null), boot:window.__neoStoreBoot})""")


INCOMING = [kid('c1', 'Кувез 3', ga='34', bw='2000'), kid('b1', 'Кувез 1', ga='32', bw='1500', log=[{'id': 'e1', 'text': 'новое событие'}])]


@pytest.mark.parametrize('pt', ['after-snapshot', 'after-journal', 'after-stage', 'after-commit-marker', 'mid-commit', 'after-commit'])
async def test_s1_crash_each_step_db_unchanged(browser, base, pt):
    page, errs, _ = await open_app(browser, base, B, now=NOW)
    before = await state(page)
    await page.evaluate("p=>{window.__neoStoreFault=p}", pt)
    r = await verify_restore(page, backup(INCOMING))
    assert r.get('crash', '').startswith('crash:'), r
    await page.reload(); await page.wait_for_timeout(1200)
    after = await state(page)
    assert after['sha'] == before['sha'], ('база должна вернуться байт в байт', pt)
    assert after['left'] == [], after
    # до записи журнала откатывать нечего (база не тронута), дальше — откат к снимку
    assert after['boot']['state'] == ('clean' if pt == 'after-snapshot' else 'rolled_back'), after
    # повтор после перезапуска проходит и даёт новый результат без потерь
    r = await verify_restore(page, backup(INCOMING)); assert r['r']['ok'], r
    ids = [k['id'] for k in (await state(page))['kids']]
    assert sorted(ids) == ['b1', 'b2', 'c1']


async def test_s1_crash_after_verify_is_complete_new_state(browser, base):
    page, errs, _ = await open_app(browser, base, B, now=NOW)
    before = await state(page)
    await page.evaluate("()=>{window.__neoStoreFault='after-verify'}")
    r = await verify_restore(page, backup(INCOMING)); assert r.get('crash', '').startswith('crash:')
    await page.reload(); await page.wait_for_timeout(1200)
    after = await state(page)
    assert after['sha'] != before['sha'] and sorted(k['id'] for k in after['kids']) == ['b1', 'b2', 'c1']
    assert after['left'] == [] and after['boot']['state'] == 'finished'


@pytest.mark.parametrize('name,mut,reason', [
    ('truncated', lambda f: f, 'truncated_or_not_json'),
    ('changed_byte', lambda f: dict(f, payload=f['payload'].replace('Кувез 1', 'Кувез 9')), 'checksum_mismatch'),
    ('unknown_version', lambda f: dict(f, v=99), 'unknown_schema_version'),
    ('wrong_app', lambda f: dict(f, app='other'), 'wrong_app'),
    ('no_sum', lambda f: {k: v for k, v in f.items() if k != 'sum'}, 'missing_fields'),
])
async def test_s2_bad_files_rejected_before_any_change(browser, base, name, mut, reason):
    page, errs, _ = await open_app(browser, base, B, now=NOW)
    before = await state(page)
    text = backup(INCOMING, mutate=mut)
    if name == 'truncated': text = text[: len(text) // 2]
    r = await verify_restore(page, text)
    assert r['v']['ok'] is False and r['v']['reason'] == reason, r
    after = await state(page)
    assert after['sha'] == before['sha'] and after['left'] == []


async def test_s2_wrong_password_not_applicable_file_backup_is_checksummed(browser, base):
    """Файловая копия не шифруется паролем: защита — контрольная сумма и версия. Неверный ключ облака (AES-GCM) — отдельный контур синхронизации."""
    page, errs, _ = await open_app(browser, base, B, now=NOW)
    r = await verify_restore(page, backup(INCOMING)); assert r['v']['ok']


async def test_s3_reimport_idempotent_and_conflict_not_overwritten(browser, base):
    local = [kid('b1', 'Кувез 1', log=[{'id': 'e1', 'text': 'исходное'}, {'id': 'e2', 'text': 'второе'}])]
    page, errs, _ = await open_app(browser, base, local, now=NOW)
    inc = [kid('b1', 'Кувез 1', log=[{'id': 'e1', 'text': 'исходное'}, {'id': 'e2', 'text': 'ИЗМЕНЕНО'}, {'id': 'e3', 'text': 'новое'}])]
    r = await verify_restore(page, backup(inc))
    rep = r['r']['rep']
    assert rep['events'] == 1 and rep['skipped'] == 1 and len(rep['conflicts']) == 1 and rep['conflicts'][0]['id'] == 'e2'
    log = {x['id']: x['text'] for x in (await state(page))['kids'][0]['log']}
    assert log == {'e1': 'исходное', 'e2': 'второе', 'e3': 'новое'}, 'конфликтное событие не перезаписано молча'
    sha1 = (await state(page))['sha']
    r2 = await verify_restore(page, backup(inc))     # повтор: ничего не дублируется
    assert r2['r']['rep']['events'] == 0 and (await state(page))['sha'] == sha1
    kept = await page.evaluate("()=>JSON.parse(localStorage.getItem('neo.conflicts')||'[]').length")
    assert kept >= 1


async def test_s4_quota_during_migration_no_success_no_loss_then_retry(browser, base):
    k = [kid('m1', 'Кувез 1'), kid('m2', 'Кувез 2')]
    page, errs, _ = await open_app(browser, base, k, now=NOW)
    await page.evaluate("()=>{localStorage.removeItem('neo.schema')}")
    orig = await page.evaluate("()=>localStorage.getItem('neo.mig.v1copy')")
    # имитация quota на записи neo.kids / neo.schema
    await page.evaluate("""()=>{ const o=Storage.prototype.setItem; window.__o=o;
      Storage.prototype.setItem=function(key,v){ if(key==='neo.schema'||key==='neo.kids'){const e=new Error('quota'); e.name='QuotaExceededError'; throw e;} return o.call(this,key,v);} }""")
    raw0 = await page.evaluate("()=>localStorage.getItem('neo.kids')")
    # убираем pid, чтобы миграции было что менять
    await page.evaluate("()=>{ window.__o.call(localStorage,'neo.kids', JSON.stringify(JSON.parse(localStorage.getItem('neo.kids')).map(k=>{delete k.pid; return k}))) }")
    raw1 = await page.evaluate("()=>localStorage.getItem('neo.kids')")
    r = await page.evaluate("()=>window.__neoStore.migrate()")
    assert r['ok'] is False
    assert await page.evaluate("()=>localStorage.getItem('neo.kids')") == raw1, 'база не тронута'
    assert await page.evaluate("()=>localStorage.getItem('neo.schema')") is None, 'успех не объявлен'
    await page.evaluate("()=>{Storage.prototype.setItem=window.__o}")
    r = await page.evaluate("()=>window.__neoStore.migrate()")
    assert r['ok'] and r['migrated'] == 2
    kids = (await state(page))['kids']
    assert [x['id'] for x in kids] == ['m1', 'm2'] and all(x['pid'] == x['id'] for x in kids)
    assert await page.evaluate("()=>localStorage.getItem('neo.mig.v1copy')") == raw1, 'копия старых данных сохранена'
    r = await page.evaluate("()=>window.__neoStore.migrate()"); assert r['already']


async def test_s5_stable_patient_id_bed_clash_not_merged(browser, base):
    local = [kid('B-id', 'Кувез 5', log=[{'id': 'eb', 'text': 'у пациента B'}])]
    page, errs, _ = await open_app(browser, base, local, now=NOW)
    inc = [kid('A-id', 'Кувез 5', log=[{'id': 'ea', 'text': 'у пациента A'}])]
    r = await verify_restore(page, backup(inc))
    rep = r['r']['rep']
    assert rep['added'] == 1 and rep['bedClash'] == [{'incoming': 'A-id', 'local': 'B-id', 'label': 'Кувез 5'}]
    kids = {k['id']: k for k in (await state(page))['kids']}
    assert [x['id'] for x in kids['B-id']['log']] == ['eb'] and [x['id'] for x in kids['A-id']['log']] == ['ea'], 'события не смешаны'
