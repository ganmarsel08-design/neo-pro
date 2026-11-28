"""knowledge-contract-v1: схема, валидатор, сценарии G6–G10 из присланного контракта (синтетические, только структура).
Клинические правила НЕ исполняются и не включаются: advisory-only, candidate_rule, pending_expert, blocking=false.
G1–G5 (22 сценария) в присланный файл не вошли — они не реализованы и не домысливаются."""
import copy, json, subprocess, sys
from pathlib import Path
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'tools'))
import validate_knowledge as vk

ROOT = Path(__file__).resolve().parent.parent
CONTRACT = json.load(open(ROOT / 'knowledge/audit-v3-v4.contract.json', encoding='utf-8'))
SCHEMA = json.load(open(ROOT / 'knowledge/knowledge-contract-v1.schema.json', encoding='utf-8'))
PROTO = ROOT / 'data/protocols.json'
BASE = ROOT / 'knowledge/known-findings.json'


def codes(c):
    E, W, _ = vk.validate(c, SCHEMA, PROTO); return sorted({e['code'] for e in E})


def mut(fn):
    c = copy.deepcopy(CONTRACT); fn(c); return c


# ---- исходный файл ----
def test_report_clean_except_acknowledged():
    rep = vk.run(ROOT / 'knowledge/audit-v3-v4.contract.json', ROOT / 'knowledge/knowledge-contract-v1.schema.json', PROTO, BASE)
    assert rep['errors'] == [], rep['errors']
    assert rep['stale_baseline'] == []
    assert [(a['code'], a['where']) for a in rep['acknowledged']] == [('DOSE_NO_WEIGHT_TIME', 'G7-CMV-PRETERM-OFFLABEL')]
    assert rep['stats']['recommendations'] == 10 and rep['stats']['protocols_covered'] == 29


def test_known_gaps_are_visible_not_hidden():
    rep = vk.run(ROOT / 'knowledge/audit-v3-v4.contract.json', ROOT / 'knowledge/knowledge-contract-v1.schema.json', PROTO, BASE)
    w = {x['code'] for x in rep['warnings']}
    assert 'TEST_COUNT' in w and 'CONFLICT_REGISTRY_ABSENT' in w   # 20 из 42; реестр конфликтов не передан


def test_29_protocols_not_modified():
    r = subprocess.run([sys.executable, 'tests/hash_protocols.py', 'data/protocols.json'], cwd=ROOT, capture_output=True, text=True)
    want = (ROOT / 'tests/protocols.sha256').read_text().split()[0]
    assert want in r.stdout and CONTRACT['protocols_29_modified'] is False


def test_all_statuses_candidate_pending_advisory():
    for r in CONTRACT['recommendations']:
        assert r['regulatory_status'] == 'candidate_rule' and r['approval']['status'] == 'pending_expert' and r['approval']['advisory_only'] is True
        assert all(not r['approval'][k] for k in ('reviewer', 'date', 'decision_ref'))
        assert all(w['blocking'] is False and w['review_status'] == 'pending_expert' for w in r['safety_warnings'])


def test_unique_ids_and_complete_coverage():
    ids = [r['recommendation_id'] for r in CONTRACT['recommendations']]; assert len(ids) == len(set(ids))
    t = [x['id'] for x in CONTRACT['synthetic_tests']]; assert len(t) == len(set(t)) == 20
    a = [c for k, v in CONTRACT['protocols_coverage'].items() if k.startswith('audited') for c in v]; assert len(a) == len(set(a)) == 29


def test_national_and_international_sources_separated():
    for r in CONTRACT['recommendations']:
        kz = {s['jurisdiction'] == 'KZ' for s in r['sources']}
        assert kz == ({True} if r['source_type'] == 'national_protocol' else {False}), r['recommendation_id']


# ---- 20 сценариев G6–G10 (структура: есть правило группы, группа совпадает, нет дублей) ----
@pytest.mark.parametrize('t', CONTRACT['synthetic_tests'], ids=lambda t: t['id'])
def test_scenario_registered(t):
    groups = {r['recommendation_id'].split('-')[0] for r in CONTRACT['recommendations']}
    assert t['group'] in groups and t['id'].split('-')[1] == t['group'] and len(t['assertion']) > 10


# ---- валидатор ловит порчу (негативные случаи) ----
def test_neg_active_hard_block():
    assert 'HARD_BLOCK_ACTIVE' in codes(mut(lambda c: c['recommendations'][0]['safety_warnings'][0].__setitem__('blocking', True)))

def test_neg_approved_without_decision():
    assert 'STATUS' in codes(mut(lambda c: c['recommendations'][0]['approval'].__setitem__('status', 'approved')))

def test_neg_advisory_false():
    assert 'STATUS' in codes(mut(lambda c: c['recommendations'][1]['approval'].__setitem__('advisory_only', False)))

def test_neg_regulatory_status_active():
    assert 'STATUS' in codes(mut(lambda c: c['recommendations'][2].__setitem__('regulatory_status', 'approved_rule')))

def test_neg_duplicate_recommendation_id():
    assert 'DUP_ID' in codes(mut(lambda c: c['recommendations'][1].__setitem__('recommendation_id', c['recommendations'][0]['recommendation_id'])))

def test_neg_duplicate_test_id():
    assert 'DUP_ID' in codes(mut(lambda c: c['synthetic_tests'][1].__setitem__('id', c['synthetic_tests'][0]['id'])))

def test_neg_duplicate_test_assertion():
    assert 'TEST_DUPLICATE' in codes(mut(lambda c: c['synthetic_tests'][1].__setitem__('assertion', c['synthetic_tests'][0]['assertion'].upper())))

def test_neg_unknown_card():
    assert 'CARD_UNKNOWN' in codes(mut(lambda c: c['recommendations'][0].__setitem__('card_id', 'kz-no-such-card')))

def test_neg_protocol_missing_from_local_db():
    assert 'COVERAGE_UNKNOWN_PROTOCOL' in codes(mut(lambda c: c['protocols_coverage']['audited_v4'].__setitem__(0, 'poroki-razvitiya-diafragmy-x')))

def test_neg_coverage_not_29():
    assert 'COVERAGE_COUNT' in codes(mut(lambda c: c['protocols_coverage']['audited_v4'].pop()))

def test_neg_protocols_modified_flag():
    assert 'SCHEMA' in codes(mut(lambda c: c.__setitem__('protocols_29_modified', True)))

def test_neg_bad_sha():
    assert 'SCHEMA' in codes(mut(lambda c: c.__setitem__('base_commit_sha', '04b0d80')))

def test_neg_source_without_doi_and_url():
    def f(c): s = c['recommendations'][0]['sources'][0]; s['doi'] = None; s['source_url'] = None
    assert 'SCHEMA' in codes(mut(f))

def test_neg_bad_doi():
    assert 'SCHEMA' in codes(mut(lambda c: c['recommendations'][0]['sources'][0].__setitem__('doi', 'not-a-doi')))

def test_neg_source_version_after_verified():
    assert 'SOURCE_DATE' in codes(mut(lambda c: c['recommendations'][0]['sources'][0].__setitem__('version_date', '2027-01-01')))

def test_neg_kz_source_in_non_national_rule():
    assert 'SOURCE_KIND' in codes(mut(lambda c: c['recommendations'][0]['sources'][0].__setitem__('jurisdiction', 'KZ')))

def test_neg_international_source_in_national_rule():
    assert 'SOURCE_KIND' in codes(mut(lambda c: c['recommendations'][1]['sources'][0].__setitem__('jurisdiction', 'International')))

def test_neg_per_kg_dose_without_weight():
    def f(c): c['recommendations'][0]['dose_guard']['required_inputs'] = ['ga_weeks']
    assert 'DOSE_NO_WEIGHT' in codes(mut(f))

def test_neg_per_kg_dose_without_weight_time():
    def f(c): ri = c['recommendations'][0]['dose_guard']['required_inputs']; ri.remove('weight_measured_at')
    assert 'DOSE_NO_WEIGHT_TIME' in codes(mut(f))

def test_neg_supersedes_without_redirect():
    def f(c): del c['recommendations'][1]['dose_guard']['redirect_to']
    assert 'SUPERSEDES_NO_REDIRECT' in codes(mut(f))

def test_neg_conflict_from_other_group():
    assert 'CONFLICT_GROUP' in codes(mut(lambda c: c['recommendations'][0]['conflicts'].append('G7-X-01')))

def test_neg_group_without_tests():
    def f(c): c['synthetic_tests'] = [t for t in c['synthetic_tests'] if t['group'] != 'G10']
    assert 'GROUP_NO_TEST' in codes(mut(f))

def test_neg_test_without_rule_group():
    def f(c): c['synthetic_tests'].append({'id': 'TEST-G99-01', 'group': 'G99', 'assertion': 'произвольная проверка без правила'})
    assert 'TEST_NO_RULE' in codes(mut(f))
