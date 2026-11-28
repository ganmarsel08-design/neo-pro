"""Факт введения жидкости: только подтверждённые события; неизвестное ≠ 0 и ≠ план; масса с назначением; версионная отмена;
пересчёт перед подтверждением черновика. Синтетические данные."""
import datetime, json, pytest
from harness import open_app, kid, TZ

pytestmark = pytest.mark.asyncio
K = [kid('r1', 'Ахметов', bd='2026-11-26', ga='28', bw='1100')]
NOW = (2026, 11, 27, 16, 30)
HYDRO = "(a)=>{const k=window.__neo.kids()[0]; return window.__neoExpress.hydro(a.f, a.fp, k, '2026-11-27');}"
ADD = "(o)=>window.__neoExpress.fluidAdd('r1', Object.assign({date:'2026-11-27'}, o))"
FP = {'tot': 80, 'mlkg': 72.7, 'n': 8, 'w': 1100, 'wSrc': 'масса при рождении'}
TXT = "Ахметов, вторые сутки, масса 1080, кормление СГМ по 4 мл каждые 3 часа, инфузия 90 мл в сутки."


async def hy(page, fp=FP, f=None):
    return await page.evaluate(HYDRO, {'f': f or {'iv': 90}, 'fp': fp})


async def test_no_events_is_unknown_not_zero_not_plan(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=NOW)
    t = await hy(page)
    assert t.count('___ мл (событий нет)') == 2 and 'Масса на утро ___ г' in t
    assert 'зарегистрировано 0' not in t and 'смена 27.11 08:30 – 28.11 08:30; данные на 27.11 16:30' in t
    assert '72 мл/кг по массе 1100 г — масса при рождении' in t or '73 мл/кг по массе 1100 г — масса при рождении' in t


async def test_registered_sum_is_not_completeness(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=NOW)
    for hm, ml_, st in [('09:00', '4', 'given'), ('12:00', '5', 'given'), ('15:00', '', 'skipped')]:
        r = await page.evaluate(ADD, {'kind': 'feed', 'hm': hm, 'ml': ml_, 'st': st}); assert r['ok'], r
    t = await hy(page)
    assert 'зарегистрировано 9,0 мл по 2 подтверждённым кормлениям из 8 плановых' in t
    assert 'пропущено/отменено 1' in t and 'полнота периода не подтверждена' in t


async def test_only_skipped_is_not_zero(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=NOW)
    await page.evaluate(ADD, {'kind': 'feed', 'hm': '09:00', 'st': 'skipped'})
    await page.evaluate(ADD, {'kind': 'iv', 'hm': '10:00', 'st': 'cancelled'})
    t = await hy(page)
    assert t.count('введений не зарегистрировано; итог за период ___ мл') == 2
    assert '0,0 мл' not in t and 'зарегистрировано 0' not in t
    assert t.count('полнота периода не подтверждена') == 2, 'и для кормления, и для в/в'


async def test_interrupted_infusion(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=NOW)
    await page.evaluate(ADD, {'kind': 'iv', 'hm': '10:00', 'ml': '30', 'st': 'partial'})
    t = await hy(page)
    assert 'зарегистрировано 30,0 мл по 1 подтверждённым записям (частично/прервано: 1); полнота периода не подтверждена' in t


async def test_weight_purpose_and_date(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=NOW)
    W = "(o)=>window.__neoExpress.fluidAdd('r1',Object.assign({kind:'wt',date:'2026-11-27'},o))"
    assert not (await page.evaluate(W, {'hm': '09:00', 'g': '1080'}))['ok'], 'без назначения массу не принимаем'
    await page.evaluate("()=>window.__neoExpress.fluidAdd('r1',{kind:'wt',date:'2026-11-26',hm:'09:00',g:'1100',purpose:'morning'})")
    t = await hy(page)
    assert 'Масса на утро ___ г (последнее измерение 1100 г, 26.11 09:00, утренняя — за утреннюю не принимается)' in t, 'вчерашняя утренняя не заменяет сегодняшнюю'
    await page.evaluate(W, {'hm': '15:00', 'g': '1070', 'purpose': 'other'})
    t = await hy(page)
    assert 'Масса на утро ___ г (последнее измерение 1070 г, 27.11 15:00, не утренняя' in t, 'дневное измерение не названо утренним'
    await page.evaluate(W, {'hm': '09:00', 'g': '1080', 'purpose': 'morning'})
    t = await hy(page)
    assert 'Масса на утро 1080 г (измерена 27.11 09:00)' in t


async def test_shift_boundary(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 28, 10, 0))
    r1 = await page.evaluate("()=>window.__neoExpress.fluidAdd('r1',{kind:'feed',date:'2026-11-27',hm:'02:00',ml:'6',st:'given'})"); assert r1['ok'] and r1['it']['date'] == '2026-11-28'
    r2 = await page.evaluate("()=>window.__neoExpress.fluidAdd('r1',{kind:'feed',date:'2026-11-28',hm:'09:00',ml:'7',st:'given'})"); assert r2['ok']
    t = await hy(page)
    assert 'зарегистрировано 6,0 мл по 1 подтверждённым' in t and '7,0' not in t


@pytest.mark.parametrize('o', [
    {'kind': 'feed', 'hm': '17:30', 'ml': '4', 'st': 'given'},          # будущее
    {'kind': 'feed', 'hm': '25:00', 'ml': '4', 'st': 'given'},          # HH
    {'kind': 'feed', 'hm': '12:60', 'ml': '4', 'st': 'given'},          # MM
    {'kind': 'feed', 'hm': '99:99', 'ml': '4', 'st': 'given'},
    {'kind': 'feed', 'hm': '12:00', 'ml': 'Infinity', 'st': 'given'},
    {'kind': 'feed', 'hm': '12:00', 'ml': '1e999', 'st': 'given'},
    {'kind': 'feed', 'hm': '12:00', 'ml': 'abc', 'st': 'given'},
    {'kind': 'feed', 'hm': '12:00', 'ml': '-1', 'st': 'given'},
    {'kind': 'feed', 'hm': '12:00', 'ml': '', 'st': 'given'},
    {'kind': 'feed', 'hm': '', 'ml': '4', 'st': 'given'},
    {'kind': 'feed', 'hm': '12:00', 'ml': '4', 'st': 'wow'},
    {'kind': 'feed', 'date': '2026-02-30', 'hm': '12:00', 'ml': '4', 'st': 'given'},   # календарная дата
    {'kind': 'feed', 'date': '27.11.2026', 'hm': '12:00', 'ml': '4', 'st': 'given'},
    {'kind': 'wt', 'hm': '09:00', 'g': 'NaN', 'purpose': 'morning'},
    {'kind': 'wt', 'hm': '09:00', 'g': '0', 'purpose': 'morning'},
    {'kind': 'wt', 'hm': '09:00', 'g': '1080', 'purpose': ''},
    {'kind': 'xx', 'hm': '09:00'},
])
async def test_negative_validation(browser, base, o):
    page, errs, _ = await open_app(browser, base, K, now=NOW)
    r = await page.evaluate(ADD, o); assert not r['ok'], o
    assert await page.evaluate("window.__neo.kids()[0].fluid||null") is None, 'ничего не записано'


async def test_void_not_delete_and_correction(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=NOW)
    r = await page.evaluate(ADD, {'id': 'e1', 'kind': 'feed', 'hm': '09:00', 'ml': '40', 'st': 'given'}); assert r['ok']  # опечатка: 40 вместо 4
    assert not (await page.evaluate("()=>window.__neoExpress.fluidVoid('r1','e1','')"))['ok'], 'без причины нельзя'
    assert (await page.evaluate("()=>window.__neoExpress.fluidVoid('r1','e1','опечатка в объёме')"))['ok']
    assert (await page.evaluate(ADD, {'id': 'e2', 'from': 'e1', 'kind': 'feed', 'hm': '09:00', 'ml': '4', 'st': 'given'}))['ok']
    fl = await page.evaluate("window.__neo.kids()[0].fluid")
    assert len(fl) == 2 and fl[0]['void']['reason'] == 'опечатка в объёме' and fl[1]['from'] == 'e1' and fl[1]['ts'] > 0, 'история сохранена, есть связь и время записи'
    t = await hy(page)
    assert 'зарегистрировано 4,0 мл по 1' in t and '40' not in t.split('в/в')[0].split('энтерально')[1]
    assert not (await page.evaluate(ADD, {'from': 'нет-такого', 'kind': 'feed', 'hm': '10:00', 'ml': '4', 'st': 'given'}))['ok']


async def test_hydro_recomputed_at_confirmation_and_stale_flag(browser, base):
    """Замечание ChatGPT #11 (1,3): гидробаланс пересчитывается перед подтверждением; изменение факта после записи помечает дневник устаревшим."""
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    await page.evaluate(ADD, {'kind': 'feed', 'hm': '09:00', 'ml': '4', 'st': 'given'})
    await page.click('#exTExp'); await page.fill('#exText', TXT); await page.click('[data-kid="r1"]'); await page.click('#exNext'); await page.wait_for_timeout(300)
    await page.click('#exBuild'); await page.wait_for_timeout(300); await page.click('#exSave'); await page.wait_for_timeout(400)
    old = await page.evaluate("window.__neo.kids()[0].days['2026-11-27'].drafts['06:00–08:30'].text")
    assert 'зарегистрировано 4,0 мл по 1' in old
    # утром: добавлены кормления и инфузия
    await page.clock.set_system_time(datetime.datetime(2026, 11, 28, 7, 0, tzinfo=TZ))
    for o in [{'kind': 'feed', 'hm': '12:00', 'ml': '5', 'st': 'given'}, {'kind': 'feed', 'hm': '15:00', 'ml': '5', 'st': 'given'}, {'kind': 'iv', 'hm': '02:00', 'ml': '20', 'st': 'partial'}]:
        assert (await page.evaluate(ADD, o))['ok']
    await page.evaluate("window.__neoExpress.openDrafts('r1')"); await page.wait_for_timeout(300)
    await page.locator('[data-dedit]:not([disabled])').last.click(); await page.wait_for_timeout(300)
    shown = await page.locator('[data-dtext]').input_value()
    assert 'зарегистрировано 14,0 мл по 3 подтверждённым кормлениям' in shown, 'форма показывает свежий факт'
    await page.fill('[data-dexam]', '06:40'); await page.click('[data-dsave]'); await page.wait_for_timeout(300)
    d = json.loads(await page.evaluate("JSON.stringify(window.__neo.kids()[0].days['2026-11-27'])"))
    t = d['slotNote']['06:00–08:30']
    assert 'зарегистрировано 14,0 мл по 3' in t and 'зарегистрировано 4,0 мл по 1' not in t and 'частично/прервано: 1' in t
    assert 'данные на 28.11 07:00' in t and d['hsrc']['ids'], 'срез времени и источники сохранены'
    assert await page.evaluate("window.__neoExpress.hydroStale(window.__neo.kids()[0],'2026-11-27')") is False
    # факт изменён после записи → дневник помечен устаревшим
    ids = await page.evaluate("window.__neo.kids()[0].fluid.map(f=>f.id)")
    await page.evaluate("(id)=>window.__neoExpress.fluidVoid('r1', id, 'ошибка времени')", ids[1])
    assert await page.evaluate("window.__neoExpress.hydroStale(window.__neo.kids()[0],'2026-11-27')") is True


LIMIT_JS = """(n)=>{const o=Storage.prototype.setItem; window.__realSet=o; window.__okLeft=n;
  Storage.prototype.setItem=function(k,v){ if(k==='neo.kids'){ if(window.__okLeft-- <= 0){const e=new Error('quota'); e.name='QuotaExceededError'; throw e;} } return o.call(this,k,v); };}"""


async def test_quota_rollback_idempotent_and_reload(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=NOW)
    o = {'id': 'fx1', 'kind': 'feed', 'hm': '09:00', 'ml': '4', 'st': 'given'}
    await page.evaluate(LIMIT_JS, 0)
    r = await page.evaluate(ADD, o); assert not r['ok'] and 'Не сохранено' in r['why']
    assert await page.evaluate("window.__neo.kids()[0].fluid||null") is None
    await page.evaluate("(()=>{Storage.prototype.setItem = window.__realSet;})()")
    assert (await page.evaluate(ADD, o))['ok']
    assert (await page.evaluate(ADD, o)).get('dup') is True
    await page.evaluate(LIMIT_JS, 0)
    r = await page.evaluate("()=>window.__neoExpress.fluidVoid('r1','fx1','ошибка')"); assert not r['ok']
    assert await page.evaluate("window.__neo.kids()[0].fluid[0].void||null") is None, 'откат отмены'
    await page.evaluate("(()=>{Storage.prototype.setItem = window.__realSet;})()")
    await page.reload(); await page.wait_for_timeout(600)
    assert await page.evaluate("window.__neo.kids()[0].fluid.length") == 1


async def test_ui_add_void_and_note_text(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    await page.click('#exTExp'); await page.fill('#exText', TXT)
    await page.click('[data-kid="r1"]'); await page.click('#exNext'); await page.wait_for_timeout(300)
    await page.fill('#flHm', '09:00'); await page.fill('#flMl', '4'); await page.click('#flAdd'); await page.wait_for_timeout(200)
    assert '09:00 · Кормление · введено · 4,0 мл' in await page.locator('#exFluid').inner_text()
    await page.fill('#flHm', '23:00'); await page.fill('#flMl', '4'); await page.click('#flAdd'); await page.wait_for_timeout(200)
    assert 'будущ' in await page.locator('#flErr').inner_text()
    await page.fill('#flHm', '08:45'); await page.select_option('#flKind', 'wt'); await page.fill('#flMl', '1080'); await page.click('#flAdd'); await page.wait_for_timeout(200)
    assert 'назначение массы' in await page.locator('#flErr').inner_text()
    await page.click('[data-fldel]'); await page.wait_for_timeout(200)
    assert 'причину' in await page.locator('#flErr').inner_text()
    await page.fill('#flWhy', 'внесено не тому ребёнку'); await page.click('[data-fldel]'); await page.wait_for_timeout(200)
    assert 'отменено: внесено не тому ребёнку' in await page.locator('#exFluid').inner_text()
    await page.click('#exBuild'); await page.wait_for_timeout(300)
    last = await page.locator('[data-out="06:00–08:30"]').input_value()
    assert '___ мл (событий нет)' in last and 'зарегистрировано 4,0' not in last
