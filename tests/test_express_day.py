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


async def test_due_draft_needs_explicit_exam_time(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    await day(page)
    assert await page.locator('#exDraftBtn').count() == 0, 'до начала интервала подтверждать нечего'
    await page.clock.set_system_time(datetime.datetime(2026, 11, 27, 13, 5, tzinfo=TZ))
    await page.evaluate("window.__neoExpress.openDrafts('r1')"); await page.wait_for_timeout(300)
    await page.click('[data-dsame]:not([disabled])'); await page.wait_for_timeout(300)
    # «как утром» — не одним кликом: форма, текст виден и правится, нужно время осмотра
    await page.click('[data-dsave]'); await page.wait_for_timeout(200)
    assert 'время вашего осмотра' in await page.locator('#exDErr').inner_text()
    for bad in ['13:30', '11:00']:  # будущая часть интервала / до интервала
        await page.fill('[data-dexam]', bad); await page.click('[data-dsave]'); await page.wait_for_timeout(200)
        assert 'время вашего осмотра' in await page.locator('#exDErr').inner_text(), bad
    d = json.loads(await page.evaluate("JSON.stringify(window.__neo.kids()[0].days['2026-11-27'])"))
    assert '12:00–15:00' not in d['slotNote'] and len(d['drafts']) == 7
    await page.fill('[data-dexam]', '12:40'); await page.click('[data-dsave]'); await page.wait_for_timeout(300)
    d = json.loads(await page.evaluate("JSON.stringify(window.__neo.kids()[0].days['2026-11-27'])"))
    t = d['slotNote']['12:00–15:00']
    assert 'Осмотр в 12:40' in t and 'без отрицательной динамики' in t and 'За время наблюдения' not in t
    assert '12:00–15:00' not in d['drafts'] and len(d['drafts']) == 6
    assert not errs


async def test_hr_only_does_not_confirm_exam(browser, base):
    """Замечание ChatGPT #10 (1): одно измерение не утверждает дыхание, неврологический статус и динамику."""
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 16, 30))
    d = (await day(page, {'12:00–15:00|hr': '150'}))['2026-11-27']
    assert '12:00–15:00' not in d['slotNote'], 'без времени осмотра интервал — только черновик'
    t = d['drafts']['12:00–15:00']['text']
    assert 'ЧСС – 150' in t
    for bad in ['прежний', 'без отрицательной динамики', 'Продолжается респираторная', 'усваивает', 'Получает', 'При осмотре']:
        assert bad not in t, (bad, t)
    assert 'Неврологический статус: ___' in t and 'Состояние ребёнка: ___' in t


async def test_exam_time_without_same_keeps_claims_blank_then_with_same(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 16, 30))
    d = (await day(page, {'12:00–15:00|hr': '150', '12:00–15:00|spo2': '94', '12:00–15:00|exam': '13:10'}))['2026-11-27']
    t = d['slotNote']['12:00–15:00']
    assert 'Осмотр в 13:10' in t and 'ЧСС – 150' in t and 'введено ___' in t
    assert 'прежний' not in t and 'усваивает' not in t and 'Состояние ребёнка: ___' in t
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 16, 30))
    await page.click('#exTExp'); await page.fill('#exText', TXT); await page.click('[data-kid="r1"]'); await page.click('#exNext'); await page.wait_for_timeout(300)
    await page.click('[data-dyn="stab"]'); await page.fill('[data-vs="12:00–15:00|exam"]', '13:10'); await page.check('[data-vs="12:00–15:00|same"]')
    await page.click('#exBuild'); await page.wait_for_timeout(300); await page.click('#exSave'); await page.wait_for_timeout(400)
    d = json.loads(await page.evaluate("JSON.stringify(window.__neo.kids()[0].days['2026-11-27'])"))
    t = d['slotNote']['12:00–15:00']
    assert 'При осмотре' in t and 'Осмотр в 13:10' in t and 'без отрицательной динамики' in t and 'за время наблюдения' not in t.lower()
    assert '15:00–18:00' in d['drafts'] and d['drafts']['15:00–18:00'].get('same'), 'текущий интервал без осмотра — черновик'


async def test_copy_excludes_drafts(browser, base):
    """Замечание ChatGPT #10 (2): обычное копирование не выносит черновики в МИС."""
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    await page.evaluate("window.__cp=[]; Object.defineProperty(navigator,'clipboard',{value:{writeText:t=>{window.__cp.push(t);return Promise.resolve();}},configurable:true})")
    await page.click('#exTExp'); await page.fill('#exText', TXT); await page.click('[data-kid="r1"]'); await page.click('#exNext'); await page.wait_for_timeout(300)
    await page.click('#exBuild'); await page.wait_for_timeout(300)
    await page.click('#exCopy'); await page.wait_for_timeout(200)
    txt = (await page.evaluate("window.__cp"))[-1]
    assert '12:00–15:00' not in txt and 'Состояние ребёнка: ___' not in txt, 'черновиков в обычной копии нет'
    await page.click('#exCopyDr'); await page.wait_for_timeout(200)
    dr = (await page.evaluate("window.__cp"))[-1]
    assert dr.count('[ЧЕРНОВИК') == 7


LIMIT_JS = """(n)=>{const o=Storage.prototype.setItem; window.__realSet=o; window.__okLeft=n;
  Storage.prototype.setItem=function(k,v){ if(k==='neo.kids'){ if(window.__okLeft-- <= 0){const e=new Error('quota'); e.name='QuotaExceededError'; throw e;} } return o.call(this,k,v); };}"""
RESTORE = "(()=>{Storage.prototype.setItem = window.__realSet;})()"

async def test_confirm_draft_quota_rollback_and_retry(browser, base):
    """Замечание ChatGPT #10 (3): при сбое записи дневник и черновик не меняются, правка текста остаётся, повтор без дублей."""
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    await day(page)
    await page.clock.set_system_time(datetime.datetime(2026, 11, 27, 13, 5, tzinfo=TZ))
    await page.evaluate("window.__neoExpress.openDrafts('r1')"); await page.wait_for_timeout(300)
    await page.click('[data-dsame]:not([disabled])'); await page.wait_for_timeout(300)
    await page.fill('[data-dtext]', 'Правка врача: состояние стабильное.'); await page.fill('[data-dexam]', '12:40')
    await page.evaluate(LIMIT_JS, 0)
    await page.click('[data-dsave]'); await page.wait_for_timeout(300)
    assert 'Не сохранено' in await page.locator('#exDErr').inner_text()
    assert await page.locator('[data-dtext]').input_value() == 'Правка врача: состояние стабильное.'
    d = json.loads(await page.evaluate("JSON.stringify(window.__neo.kids()[0].days['2026-11-27'])"))
    assert '12:00–15:00' not in d['slotNote'] and '12:00–15:00' in d['drafts'], 'откат в памяти'
    await page.evaluate(RESTORE)
    await page.click('[data-dsave]'); await page.wait_for_timeout(300)
    await page.reload(); await page.wait_for_timeout(600)
    d = json.loads(await page.evaluate("JSON.stringify(window.__neo.kids()[0].days['2026-11-27'])"))
    assert d['slotNote']['12:00–15:00'].count('Правка врача') == 1 and '12:00–15:00' not in d['drafts']

async def test_delete_draft_quota_rollback(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    await day(page)
    await page.evaluate("window.__neoExpress.openDrafts('r1')"); await page.wait_for_timeout(300)
    await page.evaluate(LIMIT_JS, 0)
    await page.click('[data-ddel]'); await page.wait_for_timeout(300)
    assert 'Не сохранено' in await page.locator('#exDErr').inner_text()
    assert len(json.loads(await page.evaluate("JSON.stringify(window.__neo.kids()[0].days['2026-11-27'].drafts)"))) == 7, 'черновик не потерян'
    await page.evaluate(RESTORE)
    await page.click('[data-ddel]'); await page.wait_for_timeout(300)
    assert len(json.loads(await page.evaluate("JSON.stringify(window.__neo.kids()[0].days['2026-11-27'].drafts)"))) == 6


async def test_exsave_quota_rollback_and_retry(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 16, 30))
    await page.click('#exTExp'); await page.fill('#exText', TXT); await page.click('[data-kid="r1"]'); await page.click('#exNext'); await page.wait_for_timeout(300)
    await page.fill('[data-vs="12:00–15:00|exam"]', '13:10')
    await page.click('#exBuild'); await page.wait_for_timeout(300)
    before = await page.evaluate("JSON.stringify(window.__neo.kids()[0].days)")
    await page.evaluate(LIMIT_JS, 0)
    await page.click('#exSave'); await page.wait_for_timeout(300)
    assert 'Не сохранено' in await page.locator('#exSave').inner_text()
    assert await page.evaluate("JSON.stringify(window.__neo.kids()[0].days)") == before, 'дневник в памяти не изменился'
    await page.evaluate(RESTORE)
    await page.click('#exSave'); await page.wait_for_timeout(400)
    await page.reload(); await page.wait_for_timeout(600)
    d = json.loads(await page.evaluate("JSON.stringify(window.__neo.kids()[0].days['2026-11-27'])"))
    assert d['slotNote']['12:00–15:00'].count('Осмотр в 13:10') == 1 and d['note'].count('План лечения') == 1


async def test_night_belongs_to_previous_shift(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 28, 2, 0))
    await page.evaluate("window.__neoExpress.open({kid:'r1'})"); await page.wait_for_timeout(200)
    assert await page.evaluate("window.__neoExpress.state().date") == '2026-11-27'
