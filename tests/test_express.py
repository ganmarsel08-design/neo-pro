"""Экспресс-дневник: карточки заболеваний не превращают правила-кандидаты в обязательные решения. Синтетические данные."""
import pytest
from harness import open_app, kid

pytestmark = pytest.mark.asyncio
KIDS = [kid('k1', 'Кювез 5 Сидоров', bd='2026-11-21', ga='25', bw='780'), kid('k2', 'Петрова', bd='2026-11-08', ga='30', bw='1350')]
TXT = ("Сидоров, пятые сутки, масса 800, ИВЛ PIP 17 PEEP 6 FiO2 40, сатурация 91, ЧСС 168. Состояние тяжелое. Живот мягкий, кормление по 2 мл "
       "каждые 3 часа, переносит. Диурез снижен, стула не было. ЭхоКГ: ОАП 2,8 мм, сброс слева направо, ЛП/Ао 1,8, реверс диастолического кровотока в аорте.")


async def _pda(page):
    await page.evaluate("localStorage.setItem('neo.ex.day','0')")
    await page.click('#exTExp'); await page.fill('#exText', TXT); await page.click('[data-kid="k1"]')
    await page.click('#exNext'); await page.wait_for_timeout(400)
    await page.click('[data-ctact="pda"][data-v="ibu"]'); await page.wait_for_timeout(200)


async def test_pda_card_detected_and_quotes_kz(browser, base):
    page, errs, _ = await open_app(browser, base, KIDS, tools=False)
    await _pda(page)
    assert await page.locator('#exC-pda').count() == 1
    assert not errs


async def test_candidate_rule_does_not_block_diary(browser, base):
    page, errs, _ = await open_app(browser, base, KIDS, tools=False)
    await _pda(page)
    await page.click('#exBuild'); await page.wait_for_timeout(300)
    assert await page.locator('#exOut').count() == 0, 'первое нажатие показывает поле причины'
    assert 'без причины' in await page.inner_text('#exBuild')
    await page.click('#exBuild'); await page.wait_for_timeout(300)
    assert await page.locator('#exOut').count() == 1, 'второе нажатие собирает дневник'
    assert 'причина не указана' in await page.inner_text('.ex-check')
    assert not errs


async def test_reason_goes_into_diary(browser, base):
    page, errs, _ = await open_app(browser, base, KIDS, tools=False)
    await _pda(page)
    await page.fill('[data-cwhy="pda"]', 'решение консилиума (синтетика)'); await page.click('#exBuild'); await page.wait_for_timeout(300)
    assert 'консилиума' in await page.input_value('#exOut')
