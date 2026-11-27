"""Экспресс-дневник за сутки: будущие интервалы — только черновики, план отдельно от факта, смена 08:30–08:30.
Синтетические данные."""
import datetime, json, pytest
from harness import open_app, kid, TZ

pytestmark = pytest.mark.asyncio
K = [kid('r1', 'Ахметов', bd='2026-11-26', ga='28', bw='1100', days={'2026-11-27': {'slotNote': {'15:00–18:00': 'В 15:20 назначено: кофеин.'}}})]
TXT = ("Ахметов, вторые сутки, масса 1080, CPAP PEEP 6 FiO2 30, сатурация 93, ЧСС 158, ЧД 52, температура 36,8, АД 52/30/38. Состояние тяжелое. "
       "Кормление СГМ по 4 мл через зонд каждые 3 часа с наращиванием по 1 мл до 10 мл, усваивает. Инфузия 90 мл в сутки. Живот мягкий, не вздут. "
       "Диурез адекватный, стул был. Неврологический статус: угнетён, мышечная гипотония.")
SLOTS = ['12:00–15:00', '15:00–18:00', '18:00–21:00', '21:00–24:00', '00:00–03:00', '03:00–06:00', '06:00–08:30']


async def day(page, vs=None):
    await page.click('#exTExp'); await page.wait_for_timeout(200)
    await page.fill('#exText', TXT); await page.click('[data-kid="r1"]'); await page.click('#exNext'); await page.wait_for_timeout(300)
    await page.click('[data-dyn="stab"]')
    for k, v in (vs or {}).items(): await page.fill(f'[data-vs="{k}"]', v)
    await page.click('#exBuild'); await page.wait_for_timeout(300)
    await page.click('#exSave'); await page.wait_for_timeout(400)
    return json.loads(await page.evaluate("JSON.stringify(window.__neo.kids()[0].days)"))


async def test_future_intervals_are_drafts_not_diary(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    d = (await day(page))['2026-11-27']
    assert 'тяжёлое' in d['note'] and 'План лечения' in d['note']
    assert d['slotNote'] == {'15:00–18:00': 'В 15:20 назначено: кофеин.'}, 'будущие интервалы не попадают в дневник'
    assert sorted(d['drafts']) == sorted(SLOTS)
    for sl, x in d['drafts'].items():
        t = x['text']
        for bad in ['усваивает', 'прежний', 'без отрицательной динамики', 'Получает энтеральное']:
            assert bad not in t, (sl, bad, t)
        assert 'Состояние ребёнка: ___' in t and 'Неврологический статус: ___' in t
    hydro = d['drafts']['06:00–08:30']['text']
    assert 'энтерально по плану' in hydro and 'фактически ___' in hydro
    assert not errs


async def test_future_draft_cannot_be_confirmed(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    await day(page)
    ok = await page.evaluate("window.__neoExpress.confirmDraft('r1','2026-11-27','18:00–21:00','текст')")
    assert ok is False
    assert '18:00–21:00' not in (await page.evaluate("JSON.stringify(window.__neo.kids()[0].days['2026-11-27'].slotNote||{})"))


async def test_due_draft_confirmed_by_doctor(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    await day(page)
    assert await page.locator('#exDraftBtn').count() == 0, 'до начала интервала подтверждать нечего'
    await page.clock.set_system_time(datetime.datetime(2026, 11, 27, 13, 5, tzinfo=TZ))
    await page.evaluate("window.__neoExpress.openDrafts('r1')"); await page.wait_for_timeout(300)
    await page.click('[data-dsame]:not([disabled])'); await page.wait_for_timeout(300)
    d = json.loads(await page.evaluate("JSON.stringify(window.__neo.kids()[0].days['2026-11-27'])"))
    assert 'без отрицательной динамики' in d['slotNote']['12:00–15:00']
    assert '12:00–15:00' not in d['drafts'] and len(d['drafts']) == 6
    assert not errs


async def test_doctor_entered_interval_saved_with_plan_not_fact(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 16, 30))
    d = (await day(page, {'12:00–15:00|hr': '150', '12:00–15:00|spo2': '94'}))['2026-11-27']
    t = d['slotNote']['12:00–15:00']
    assert 'ЧСС – 150' in t and 'по плану' in t and 'введено ___' in t and 'усваивает' not in t
    assert '15:00–18:00' in d['drafts'] and d['drafts']['15:00–18:00'].get('same'), 'текущий интервал без данных — черновик, доступен сразу'


async def test_night_belongs_to_previous_shift(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 28, 2, 0))
    await page.evaluate("window.__neoExpress.open({kid:'r1'})"); await page.wait_for_timeout(200)
    assert await page.evaluate("window.__neoExpress.state().date") == '2026-11-27'
