"""Матрица дефектов из AUDIT.md (и найденных при проверке Issue #3).
Каждый тест описывает ПРАВИЛЬНОЕ поведение. На сборке до исправлений он должен падать — так виден «до/после»."""
import json, pytest
from harness import open_app, kid, QUOTA_JS, nurse_code, shift_code

pytestmark = pytest.mark.asyncio
KIDS = [kid('a', 'Койка 1'), kid('b', 'Койка 12'), kid('c', 'Петрова', bd='2026-11-20'), kid('d', 'Сидорова', bd='2026-11-22')]


async def days(page, id):
    return await page.evaluate("(id)=>JSON.stringify(window.__neo.kids().find(k=>k.id===id).days)", id)


# A1. Переполнение памяти: врач сразу узнаёт, что запись не сохранилась
async def test_A1_quota_save_warns(browser, base):
    page, errs, dlg = await open_app(browser, base, KIDS)
    await page.evaluate(QUOTA_JS)
    await page.evaluate("(()=>{const k=window.__neo.kids()[0]; k.days['2026-11-26']={note:'синтетика'}; window.__neo.save(k);})()")
    await page.wait_for_timeout(300)
    assert any('НЕ сохранено' in m for m in dlg), dlg


async def test_A1_quota_shift_event_flagged(browser, base):
    page, errs, dlg = await open_app(browser, base, KIDS)
    await page.evaluate(QUOTA_JS)
    it = await page.evaluate("JSON.stringify(window.__neoLog.add('d',{date:'2026-11-26',hm:'13:00',type:'rx',text:'синтетика'}))")
    assert json.loads(it).get('unsaved') is True


async def test_A1_quota_express_not_reported_saved(browser, base):
    page, errs, dlg = await open_app(browser, base, KIDS)
    await page.evaluate(QUOTA_JS)
    await page.evaluate("window.__neoExpress.open({kid:'a'})")
    await page.fill('#exText', 'Койка 1, ЧСС 150'); await page.click('#exNext'); await page.wait_for_timeout(200)
    await page.click('#exBuild'); await page.wait_for_timeout(200); await page.click('#exSave'); await page.wait_for_timeout(300)
    assert 'Не сохранено' in (await page.evaluate("(document.querySelector('#exSave')||{}).textContent||''"))


# A2. QR медсестры: только точное и единственное совпадение метки
async def _nurse(page, rows):
    code = nurse_code(rows)
    await page.evaluate("(c)=>{window.__neo.scan=function(ok){ok(c)}}", code)
    await page.goto(page.url.split('#')[0] + '#round'); await page.wait_for_timeout(800)
    await page.click('#rdNurse'); await page.wait_for_timeout(500)


async def test_A2_nurse_partial_label_rejected(browser, base):
    page, errs, dlg = await open_app(browser, base, KIDS)
    before = {i: await days(page, i) for i in 'ab'}
    await _nurse(page, [{'l': '1', 'd': '2026-11-26', 't': '14:00', 'v': {'ЧСС': 150}}])
    assert {i: await days(page, i) for i in 'ab'} == before


async def test_A2_nurse_exact_label_written(browser, base):
    page, errs, dlg = await open_app(browser, base, KIDS)
    a0 = await days(page, 'a')
    await _nurse(page, [{'l': 'Койка 12', 'd': '2026-11-26', 't': '14:00', 'v': {'ЧСС': 150}}])
    assert '150' in await days(page, 'b') and await days(page, 'a') == a0


async def test_A2_nurse_duplicate_label_rejected(browser, base):
    ks = KIDS + [kid('e', 'Койка 1')]
    page, errs, dlg = await open_app(browser, base, ks)
    before = {i: await days(page, i) for i in 'ae'}
    await _nurse(page, [{'l': 'Койка 1', 'd': '2026-11-26', 't': '14:00', 'v': {'ЧСС': 150}}])
    assert {i: await days(page, i) for i in 'ae'} == before


# A3. «Остальным — без динамики»: без подтверждения врача ничего не пишется
async def test_A3_round_bulk_requires_confirmation(browser, base):
    page, errs, dlg = await open_app(browser, base, KIDS)
    await page.goto(page.url.split('#')[0] + '#round'); await page.wait_for_timeout(800)  # обход открывается переходом из списка
    before = {k['id']: await days(page, k['id']) for k in KIDS}
    await page.click('#rdAll'); await page.wait_for_timeout(400)
    assert any('осмотрели' in m for m in dlg), dlg
    assert {k['id']: await days(page, k['id']) for k in KIDS} == before


# A4. Приём смены: более новая карточка не заменяется без предупреждения
async def _take(page, kids_in):
    await page.goto(page.url.split('#')[0] + '#kids'); await page.wait_for_timeout(800)
    await page.evaluate("document.getElementById('shiftBox').open=true")
    await page.fill('#shCode', shift_code(kids_in)); await page.wait_for_timeout(500)


async def test_A4_handoff_older_card_needs_confirmation(browser, base):
    mine = [kid('d', 'Сидорова', bd='2026-11-22', upd=9_000_000_000_000, days={'2026-11-26': {'note': 'моя свежая запись'}})]
    page, errs, dlg = await open_app(browser, base, mine)
    await _take(page, [kid('d', 'Сидорова', bd='2026-11-22', upd=1, days={'2026-11-26': {'note': 'старая версия коллеги'}})])
    box = page.locator('#shIn [data-in="0"]')
    assert not await box.is_checked()
    await box.check(); await page.click('#shTake'); await page.wait_for_timeout(300)
    assert dlg, 'нет предупреждения'
    assert 'моя свежая запись' in await days(page, 'd')


async def test_A5_handoff_unencrypted_warning(browser, base):
    page, errs, dlg = await open_app(browser, base, KIDS)
    assert 'не зашифрован' in (await page.locator('#shiftBox').text_content())


# A6. Не исправлено: тот же ребёнок, заведённый на двух телефонах, приходит как «новый» — будет дубль карточки
@pytest.mark.xfail(strict=True, reason='Открытый дефект: нет проверки похожих карточек при приёме смены (план — отдельный PR)')
async def test_A6_handoff_same_child_other_id_flagged(browser, base):
    page, errs, dlg = await open_app(browser, base, KIDS)
    await _take(page, [kid('x9', 'Петрова', bd='2026-11-20')])
    assert 'похож' in (await page.locator('#shIn').inner_text()).lower()


# A7. Не исправлено: синхронизация двух устройств заменяет карточку целиком (тест слияния — tests/test_sync_merge.js)
