"""Защита расчёта доз (замечание ChatGPT, Issue #3, P0): масса — только текущая, строго числовая; возраст/срок не подставляются.
Синтетические данные. Первоисточники и 29 КП не менялись."""
import pytest
from harness import open_app, kid

pytestmark = pytest.mark.asyncio
K = [kid('r1', 'Ахметов', bd='2026-11-20', ga='32', bw='1500')]


async def doses_for(page, f, kid_id='r1', cid='sep'):
    return await page.evaluate("""([f, kid, cid])=>{
      const X=window.__neoExpress; X.open({kid:kid, f:f, date:'2026-11-27'});
      const E=X.state(); E.f=Object.assign(E.f||{}, f); E.kid=kid; E.date='2026-11-27';
      const e=window.__neoConds.make(cid, ''); e.tact='start';
      const c=X.cctx(E,e); const d=window.__neoConds.by[cid];
      return {w:c.w, dol:c.dol, ga:c.ga, doses:d.doses(c), text:X.ctext(E,e)};
    }""", [f, kid_id, cid])


@pytest.mark.parametrize('w', ['', None, '0', '-5', 'NaN', 'Infinity', '12abc', '1080 г', '1e999', '--1', '1,2,3'])
async def test_bad_weight_blocks_doses_everywhere(browser, base, w):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    r = await doses_for(page, {'w': w, 'dol': 5})
    assert r['w'] is None and r['doses'] is None, ('дозы без валидной текущей массы не показываются', r['doses'])
    assert 'мг)' not in r['text'] and 'мг/кг (' not in r['text'], r['text']
    assert '___' in r['text'] and 'масса для расчёта не указана' in r['text'] or 'не указана' in r['text'], 'текст не содержит готовой схемы с дозами'


async def test_birth_weight_not_used_for_doses(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    r = await doses_for(page, {'dol': 5})
    assert r['w'] is None and r['doses'] is None, 'масса при рождении 1500 г не подставляется в дозы'


async def test_valid_current_weight_gives_doses(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    r = await doses_for(page, {'w': '1080', 'dol': 5})
    assert r['w'] == 1080 and r['doses'] and any('Бензилпенициллин' in x['n'] for x in r['doses'])
    r = await doses_for(page, {'w': '1080,5', 'dol': 5}); assert r['w'] == 1080.5


async def test_unknown_dol_does_not_pick_age_regimen(browser, base):
    page, errs, _ = await open_app(browser, base, [kid('r2', 'Бекова', bd='', ga='32', bw='1500')], now=(2026, 11, 27, 10, 0))  # дата рождения неизвестна → сутки неизвестны
    r = await doses_for(page, {'w': '1500'}, kid_id='r2')
    assert r['dol'] is None
    names = {x['n']: x for x in r['doses']}
    assert 'мг/кг' not in names['Ампициллин']['t'] and 'укажите сутки жизни' in names['Ампициллин']['t']
    g = names['Гентамицин (КР РФ, по сроку)']
    assert 'мг/кг' not in g['t'] and 'укажите сутки жизни' in g['t']
    # возрастнонезависимые строки остаются
    assert 'мг/кг' in names['Бензилпенициллин']['t']


async def test_known_dol_selects_branch(browser, base):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    r = await doses_for(page, {'w': '1500', 'dol': 3})
    amp = [x for x in r['doses'] if x['n'] == 'Ампициллин'][0]
    assert '25–50 мг/кг каждые 12 ч' in amp['t']
    r = await doses_for(page, {'w': '1500', 'dol': 9})
    amp = [x for x in r['doses'] if x['n'] == 'Ампициллин'][0]
    assert '50 мг/кг каждые 8 ч' in amp['t']


async def test_ga_garbage_not_accepted(browser, base):
    page, errs, _ = await open_app(browser, base, [kid('r3', 'Дарханова', bd='2026-11-20', ga='32недели?', bw='1500')], now=(2026, 11, 27, 10, 0))
    r = await doses_for(page, {'w': '1500', 'dol': 5}, kid_id='r3')
    assert r['ga'] is None and not [x for x in r['doses'] if 'по сроку' in x['n']]


@pytest.mark.parametrize('cid', ['pda', 'rds', 'sep', 'nec', 'hyp', 'chd'])
@pytest.mark.parametrize('w', ['', '0', '-5', 'Infinity', '12abc'])
async def test_all_cards_no_doses_on_bad_weight(browser, base, cid, w):
    page, errs, _ = await open_app(browser, base, K, now=(2026, 11, 27, 10, 0))
    r = await page.evaluate("""([w, cid])=>{
      const X=window.__neoExpress; X.open({kid:'r1', f:{w:w, dol:5}, date:'2026-11-27'});
      const E=X.state(); E.f=Object.assign(E.f||{}, {w:w, dol:5}); E.kid='r1'; E.date='2026-11-27';
      const e=window.__neoConds.make(cid, ''); e.tact='start';
      const c=X.cctx(E,e); const d=window.__neoConds.by[cid];
      let ds=null; try{ ds=d.doses ? d.doses(c) : null }catch(x){ ds='ERR '+x }
      return {w:c.w, ds:ds, text:X.ctext(E,e)};
    }""", [w, cid])
    assert r['w'] is None and not r['ds'], r
    assert not __import__('re').search(r'<b>[\d.,]+ мг', r['text'] or ''), r['text']
