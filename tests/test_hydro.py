"""Факт введения жидкости: только подтверждённые события; неизвестное ≠ 0 и ≠ план; масса с датой. Синтетические данные."""
import json, pytest
from harness import open_app, kid

pytestmark = pytest.mark.asyncio
K = [kid('r1', 'Ахметов', bd='2026-11-26', ga='28', bw='1100')]
NOW = (2026, 11, 27, 16, 30)
HYDRO = "(a)=>{const k=window.__neo.kids()[0]; return window.__neoExpress.hydro(a.f, a.fp, k, '2026-11-27');}"
ADD = "(o)=>window.__neoExpress.fluidAdd('r1', Object.assign({date:'2026-11-27'}, o))"
FP = {'tot': 80, 'mlkg': 72.7, 'n': 8}


async def hy(page, fp=FP, f=None):
    return await page.evaluate(HYDRO, {'f': f or {'iv': 90}, 'fp': fp})


async def test_no_events_is_unknown_not_zero_not_plan(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=NOW)
    t = await hy(page)
    assert t.count('фактически ___ мл') == 2 and 'Масса на утро ___ г' in t
    assert 'фактически 0' not in t and 'фактически 80' not in t


async def test_feed_facts_only_from_confirmed_events(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=NOW)
    for hm, ml_, st in [('09:00', '4', 'given'), ('12:00', '5', 'given'), ('15:00', '', 'skipped')]:
        r = await page.evaluate(ADD, {'kind': 'feed', 'hm': hm, 'ml': ml_, 'st': st}); assert r['ok'], r
    t = await hy(page)
    assert 'фактически 9,0 мл по 2 подтверждённым кормлениям из 8 плановых' in t
    assert 'пропущено/отменено 1' in t and 'по остальным данных нет' in t
    assert 'в/в по плану 90 мл, фактически ___ мл' in t, 'в/в без событий — неизвестно'


async def test_interrupted_infusion_and_cancelled(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=NOW)
    await page.evaluate(ADD, {'kind': 'iv', 'hm': '10:00', 'ml': '30', 'st': 'partial'})
    await page.evaluate(ADD, {'kind': 'iv', 'hm': '14:00', 'ml': '', 'st': 'cancelled'})
    t = await hy(page)
    assert 'в/в по плану 90 мл, фактически 30,0 мл по 1 подтверждённым записям (частично/прервано: 1), пропущено/отменено 1' in t


async def test_weight_needs_date(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=NOW)
    await page.evaluate("()=>window.__neoExpress.fluidAdd('r1',{kind:'wt',date:'2026-11-26',hm:'09:00',g:'1100'})")
    t = await hy(page)
    assert 'Масса на утро ___ г (последняя известная 1100 г от 26.11)' in t, 'вчерашняя масса не выдаётся за утреннюю'
    await page.evaluate(ADD, {'kind': 'wt', 'hm': '09:00', 'g': '1080'})
    t = await hy(page)
    assert 'Масса на утро 1080 г (измерена 27.11 09:00)' in t


async def test_shift_boundary(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 28, 10, 0))
    # 02:00 ночи 28.11 — ещё смена 27.11; 09:00 28.11 — уже следующая смена
    r1 = await page.evaluate("()=>window.__neoExpress.fluidAdd('r1',{kind:'feed',date:'2026-11-27',hm:'02:00',ml:'6',st:'given'})"); assert r1['ok'] and r1['it']['date'] == '2026-11-28'
    r2 = await page.evaluate("()=>window.__neoExpress.fluidAdd('r1',{kind:'feed',date:'2026-11-28',hm:'09:00',ml:'7',st:'given'})"); assert r2['ok']
    t = await hy(page)
    assert 'фактически 6,0 мл по 1 подтверждённым' in t and '7,0' not in t


async def test_validation_and_future_rejected(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=NOW)
    for o in [{'kind': 'feed', 'hm': '17:30', 'ml': '4', 'st': 'given'}, {'kind': 'feed', 'hm': '12:00', 'ml': '', 'st': 'given'}, {'kind': 'feed', 'hm': '', 'ml': '4', 'st': 'given'}, {'kind': 'wt', 'hm': '09:00', 'g': '12'}]:
        r = await page.evaluate(ADD, o); assert not r['ok'], o
    assert await page.evaluate("window.__neo.kids()[0].fluid||null") is None


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
    await page.reload(); await page.wait_for_timeout(600)
    assert await page.evaluate("window.__neo.kids()[0].fluid.length") == 1


async def test_ui_add_and_note_text(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    await page.click('#exTExp'); await page.fill('#exText', "Ахметов, вторые сутки, масса 1080, кормление СГМ по 4 мл каждые 3 часа, инфузия 90 мл в сутки.")
    await page.click('[data-kid="r1"]'); await page.click('#exNext'); await page.wait_for_timeout(300)
    await page.fill('#flHm', '09:00'); await page.fill('#flMl', '4'); await page.click('#flAdd'); await page.wait_for_timeout(200)
    assert '09:00 · Кормление · введено · 4,0 мл' in await page.locator('#exFluid').inner_text()
    await page.fill('#flHm', '23:00'); await page.fill('#flMl', '4'); await page.click('#flAdd'); await page.wait_for_timeout(200)
    assert 'будущ' in await page.locator('#flErr').inner_text()
    await page.click('#exBuild'); await page.wait_for_timeout(300)
    last = await page.locator('[data-out="06:00–08:30"]').input_value()
    assert 'фактически 4,0 мл по 1 подтверждённым кормлениям' in last and 'фактически ___ мл' in last
