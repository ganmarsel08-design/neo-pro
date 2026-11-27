"""Диктовка по нескольким детям: ребёнок и время определяются для каждой фразы отдельно. Синтетические данные."""
import pytest
from harness import open_app, kid

pytestmark = pytest.mark.asyncio
kids = [kid('k1', 'Сидорова', bd='2026-11-22'), kid('k2', 'Петрова', bd='2026-11-21'), kid('k3', 'Бокс 3 (К.)', bd='2026-11-20'),
        kid('k4', 'Иванова 1'), kid('k5', 'Иванова 2'), kid('k6', 'Иванов', bd='2026-11-24')]
CASES = [  # текст, ожидание [(kid, hmHow, hm?)]
 ("Сидорова: в 13:50 поступила, апноэ. В 14:10 куросурф 2 флакона. Назначил адреналин 0,1 мкг/кг/мин.", [('k1','said','13:50'),('k1','said','14:10'),('k1','prev','14:10')]),
 ("Петрова в 15:00 ЭхоКГ. Куросурф 2 флакона.", [('k2','said','15:00'),('','now','16:00')]),
 ("Сидорова в 13:50 апноэ. Петрова КОС pH 7,2.", [('k1','said','13:50'),('k2','now','16:00')]),
 ("Ивановой назначен ампициллин.", [('','now',None)]),
 ("Иванова 2: КОС pH 7,2. Иванова первая — глюкоза 2,1.", [('k5','now',None),('k4','now',None)]),
 ("КОС как у Сидоровой.", [('','now',None)]),
 ("Сидоровой и Петровой ОАК в 12:00.", [('','said','12:00')]),
 ("Третий бокс: снизил PIP до 13 в 02:15. Сидорова: в 10:00 ЭхоКГ.", [('k3','said','02:15'),('k1','said','10:00')]),
 ("Сидорова: апноэ.\n\nКуросурф 2 флакона.", [('k1','now',None),('','now',None)]),
 ("Иванов в 11:00 НСГ. Иванова 1: ОАК.", [('','said','11:00'),('k4','now',None)]),
]
FIND = [("Ребенок Петрова, 5 сутки жизни, масса 2300", 'k2'), ("Иванова, 5 сутки", None), ("Сидоровой 7 сутки", 'k1'), ("Сидорова и Петрова", None), ("масса 1800, ИВЛ", None)]


@pytest.mark.parametrize('text,exp', CASES)
async def test_parse(browser, base, text, exp):
    page, errs, _ = await open_app(browser, base, kids)
    rows = await page.evaluate("(t)=>window.__neoLog.parse(t, window.__neo.kids())", text)
    got = [(r.get('kid'), r.get('hmHow'), r.get('hm')) for r in rows]
    assert len(got) == len(exp), got
    for g, e in zip(got, exp):
        assert g[0] == e[0] and g[1] == e[1] and (e[2] is None or g[2] == e[2]), (got, exp)
    assert not errs


@pytest.mark.parametrize('text,exp', FIND)
async def test_find_kid(browser, base, text, exp):
    page, errs, _ = await open_app(browser, base, kids)
    k = await page.evaluate("(t)=>{const m=window.__neoLog.find(t); return m&&m.kid?m.kid.id:null}", text)
    assert k == exp


async def test_preview_requires_kid_and_confirmation(browser, base):
    page, errs, _ = await open_app(browser, base, kids)
    await page.locator('#slDictBtn').click(); await page.wait_for_timeout(300)
    assert await page.locator('.sl-kids').count() == 0, 'ребёнок по умолчанию не предлагается'
    await page.locator('#dtText').fill("Петрова в 15:00 ЭхоКГ, снижение СВ. Куросурф 2 флакона. КОС как у Сидоровой.")
    await page.locator('#dtParse').click(); await page.wait_for_timeout(400)
    await page.locator('#dtSave').click(); await page.wait_for_timeout(200)
    assert 'не выбран ребёнок' in await page.locator('#dtErr').inner_text()
    await page.locator('[data-sug="k1"]').click(); await page.wait_for_timeout(200)
    await page.locator('[data-bulk="k2"]').click(); await page.wait_for_timeout(200)
    await page.locator('#dtSave').click(); await page.wait_for_timeout(200)
    assert 'время предположено' in await page.locator('#dtErr').inner_text()
    while await page.locator('[data-ok]').count():
        await page.locator('[data-ok]').first.click(); await page.wait_for_timeout(150)
    await page.locator('#dtSave').click(); await page.wait_for_timeout(200)
    assert 'проверили' in await page.locator('#dtErr').inner_text()
    await page.locator('#dtConfirm').check(); await page.locator('#dtSave').click(); await page.wait_for_timeout(400)
    logs = await page.evaluate("Object.fromEntries(window.__neo.kids().map(k=>[k.id,(k.log||[]).map(e=>e.hm+' '+e.text)]))")
    assert logs['k1'] == ['16:00 КОС как у Сидоровой']
    assert logs['k2'] == ['15:00 ЭхоКГ, снижение СВ', '16:00 Куросурф 2 флакона']
    assert not any(logs[i] for i in ['k3', 'k4', 'k5', 'k6'])
    assert not errs


async def test_single_event_no_silent_previous_kid(browser, base):
    page, errs, _ = await open_app(browser, base, kids)
    await page.evaluate("localStorage.setItem('neo.sl.kid','k2')")
    await page.locator('#slFab').click(); await page.wait_for_timeout(300)
    assert await page.locator('.sl-kids [aria-pressed="true"]').count() == 0


# ---- замечания ChatGPT к PR #6: дата/время не угадываются, неоднозначность не выдаётся за факт ----
AT9 = (2026, 11, 26, 9, 0)
async def parse_open(page, text):
    await page.locator('#slDictBtn').click(); await page.wait_for_timeout(300)
    await page.locator('#dtText').fill(text); await page.locator('#dtParse').click(); await page.wait_for_timeout(400)

async def save_all(page):
    while await page.locator('[data-ok]').count():
        await page.locator('[data-ok]').first.click(); await page.wait_for_timeout(120)
    await page.locator('#dtConfirm').check(); await page.locator('#dtSave').click(); await page.wait_for_timeout(400)

async def test_future_time_date_not_guessed(browser, base):
    page, errs, _ = await open_app(browser, base, kids, now=AT9)
    rows = await page.evaluate("(t)=>window.__neoLog.parse(t, window.__neo.kids())", "Сидорова в 15:00 ЭхоКГ.")
    assert rows[0]['hm'] == '15:00' and rows[0]['date'] == '' and rows[0]['dateHow'] == 'ask'
    await parse_open(page, "Сидорова в 15:00 ЭхоКГ.")
    await page.locator('#dtConfirm').check(); await page.locator('#dtSave').click(); await page.wait_for_timeout(200)
    assert 'не выбрана дата' in await page.locator('#dtErr').inner_text()
    await page.locator('[data-dt="yst"]').click(); await page.wait_for_timeout(200)
    assert await page.locator('[data-f="date"]').input_value() == '2026-11-25', 'выбранная дата видна в поле'
    await save_all(page)
    ev = await page.evaluate("window.__neo.kids().find(k=>k.id==='k1').log[0]")
    assert ev['date'] == '2026-11-25' and ev['hm'] == '15:00' and ev['src']['dateHow'] == 'doc' and ev['src']['hmHow'] == 'said'
    assert 'в 15:00' in ev['src']['phrase'] and ev['ts'] > 0 and not errs

async def test_edit_time_recomputes_date_until_chosen(browser, base):
    page, errs, _ = await open_app(browser, base, kids, now=AT9)
    await parse_open(page, "Сидорова в 15:00 ЭхоКГ.")
    await page.locator('[data-f="hm"]').fill('08:45'); await page.locator('[data-f="hm"]').dispatch_event('change'); await page.wait_for_timeout(200)
    assert await page.locator('[data-f="date"]').input_value() == '2026-11-26', 'время стало прошедшим — сегодня, видимо'
    # врач выбрал вчера вручную, затем правит время: выбор остаётся, но дата видна и можно править
    await page.locator('[data-f="date"]').fill('2026-11-25'); await page.locator('[data-f="date"]').dispatch_event('change'); await page.wait_for_timeout(200)
    await page.locator('[data-f="hm"]').fill('08:50'); await page.locator('[data-f="hm"]').dispatch_event('change'); await page.wait_for_timeout(200)
    assert await page.locator('[data-f="date"]').input_value() == '2026-11-25'
    assert 'не сегодняшняя' in await page.locator('.dt-row').inner_text()

async def test_midnight_boundary(browser, base):
    page, errs, _ = await open_app(browser, base, kids, now=(2026, 11, 26, 0, 10))
    rows = await page.evaluate("(t)=>window.__neoLog.parse(t, window.__neo.kids())", "Сидорова в 23:50 ЭхоКГ. Сидорова в 00:05 санация.")
    assert (rows[0]['hm'], rows[0]['dateHow']) == ('23:50', 'ask'), rows[0]
    assert (rows[1]['hm'], rows[1]['date'], rows[1]['dateHow']) == ('00:05', '2026-11-26', 'default'), rows[1]

async def test_two_times_flagged_and_split(browser, base):
    page, errs, _ = await open_app(browser, base, kids, now=(2026, 11, 26, 16, 0))
    txt = "Сидорова в 08:30 назначил препарат, в 09:00 ввёл."
    rows = await page.evaluate("(t)=>window.__neoLog.parse(t, window.__neo.kids())", txt)
    assert len(rows) == 1 and rows[0]['hmHow'] == 'multi' and rows[0]['hm'] == '' and rows[0]['times'] == ['08:30', '09:00']
    await parse_open(page, txt)
    await page.locator('#dtConfirm').check(); await page.locator('#dtSave').click(); await page.wait_for_timeout(200)
    assert 'не выбрана дата или время' in await page.locator('#dtErr').inner_text()
    await page.locator('[data-split]').click(); await page.wait_for_timeout(250)
    hms = await page.locator('[data-f="hm"]').evaluate_all("els=>els.map(e=>e.value)")
    assert hms == ['08:30', '09:00']
    await save_all(page)
    logs = await page.evaluate("window.__neo.kids().find(k=>k.id==='k1').log.map(e=>e.hm+' '+e.text)")
    assert sorted(logs) == ['08:30 препарат', '09:00 ввёл'], logs

async def test_guessed_time_needs_confirmation(browser, base):
    page, errs, _ = await open_app(browser, base, kids)
    await parse_open(page, "Сидорова: апноэ.")
    await page.locator('#dtConfirm').check(); await page.locator('#dtSave').click(); await page.wait_for_timeout(200)
    assert 'время предположено' in await page.locator('#dtErr').inner_text()
    await page.locator('[data-ok]').click(); await page.wait_for_timeout(150)
    await save_all(page)
    ev = await page.evaluate("window.__neo.kids().find(k=>k.id==='k1').log[0]")
    assert ev['src']['hmHow'] == 'now' and ev['src']['hmOk'] is True

async def test_bulk_skips_ambiguous_rows(browser, base):
    page, errs, _ = await open_app(browser, base, kids)
    await parse_open(page, "Сидоровой и Петровой ОАК в 12:00. Куросурф в 12:10.")
    assert await page.locator('.dt-bulk').count() == 1
    await page.locator('[data-bulk="k3"]').click(); await page.wait_for_timeout(200)
    kidsel = await page.locator('select[data-f="kid"]').evaluate_all("els=>els.map(e=>e.value)")
    assert kidsel == ['', 'k3'], 'строка с двумя возможными детьми остаётся без ребёнка'
