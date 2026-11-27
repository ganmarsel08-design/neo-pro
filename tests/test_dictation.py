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
