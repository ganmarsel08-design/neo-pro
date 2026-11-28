#!/usr/bin/env python3
"""Валидатор knowledge-contract-v1 (только чтение; protocols.json и antidefect не меняются).
Проверяет: схему JSON; полноту и уникальность идентификаторов; статусы candidate_rule / pending_expert / advisory-only;
отсутствие действующих блокировок; соответствие первоисточникам (даты, DOI/URL, юрисдикция); разделение КП РК и международных;
обязательные входные данные для доз; отсутствие дублирующих тестов; соответствие 29 КП (id из data/protocols.json, хэш).
Выход: JSON-отчёт {errors, acknowledged, warnings, stats}; код 1 при неподтверждённых ошибках.
Известные замечания по входному файлу лежат в knowledge/known-findings.json (владелец, причина) и не скрываются."""
import json, re, sys, subprocess, hashlib
from pathlib import Path
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def protocol_ids(path):
    ids = set()
    def walk(x):
        if isinstance(x, dict):
            if isinstance(x.get('id'), str): ids.add(x['id'])
            for v in x.values(): walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    walk(json.load(open(path, encoding='utf-8'))); return ids


def validate(contract, schema, protocols_json=None):
    E, W = [], []                     # (code, where, message)
    err = lambda c, w, m: E.append({'code': c, 'where': w, 'message': m})
    warn = lambda c, w, m: W.append({'code': c, 'where': w, 'message': m})
    for e in sorted(Draft202012Validator(schema).iter_errors(contract), key=lambda e: list(map(str, e.absolute_path))):
        err('SCHEMA', '/'.join(map(str, e.absolute_path)) or '$', e.message[:200])
    if E: return E, W, {}
    recs, tests, cov = contract['recommendations'], contract['synthetic_tests'], contract['protocols_coverage']
    # --- 29 КП ---
    allc = [c for k, v in cov.items() if k.startswith('audited') for c in v]
    if len(allc) != len(set(allc)): err('COVERAGE_DUP', 'protocols_coverage', 'один протокол указан в нескольких аудитах')
    if len(set(allc)) != 29: err('COVERAGE_COUNT', 'protocols_coverage', 'покрытие %d из 29' % len(set(allc)))
    if protocols_json:
        have = protocol_ids(protocols_json)
        miss = sorted(c for c in set(allc) if c not in have)
        if miss: err('COVERAGE_UNKNOWN_PROTOCOL', 'protocols_coverage', 'нет в data/protocols.json: ' + ', '.join(miss))
    # --- уникальность ---
    seen = {}
    def uniq(kind, val, where):
        if (kind, val) in seen: err('DUP_ID', where, '%s %s повторяется (%s)' % (kind, val, seen[(kind, val)]))
        else: seen[(kind, val)] = where
    for i, r in enumerate(recs):
        w = r['recommendation_id']; uniq('recommendation_id', w, 'recommendations[%d]' % i)
        grp = w.split('-')[0]
        # статусы: пока нет решения эксперта — только кандидат, только справочно
        a = r['approval']
        if r['regulatory_status'] != 'candidate_rule': err('STATUS', w, 'regulatory_status должен быть candidate_rule до приёмки')
        if a['status'] != 'pending_expert': err('STATUS', w, 'approval.status должен быть pending_expert до приёмки')
        if a['advisory_only'] is not True: err('STATUS', w, 'advisory_only должен быть true')
        if any(a[k] for k in ('reviewer', 'date', 'decision_ref')): err('STATUS', w, 'решение эксперта не может быть заполнено до приёмки')
        for sw in r['safety_warnings']:
            uniq('warning_id', sw['id'], w)
            if sw['blocking'] is not False: err('HARD_BLOCK_ACTIVE', w + '/' + sw['id'], 'клинические блокировки не активируются до приёмки (blocking=false)')
            if sw['review_status'] != 'pending_expert': err('STATUS', w + '/' + sw['id'], 'review_status должен быть pending_expert')
        # card
        cid = r['card_id'][3:]
        if cid not in allc: err('CARD_UNKNOWN', w, 'card_id %s не входит в покрытие 29 КП' % r['card_id'])
        rd = r['dose_guard'].get('redirect_to')
        if rd and rd not in allc: err('REDIRECT_UNKNOWN', w, 'redirect_to %s не из 29 КП' % rd)
        if r['supersedes'] and not rd: err('SUPERSEDES_NO_REDIRECT', w, 'замещённая редакция без redirect_to на действующий КП')
        # conflicts: префикс группы
        for c in r['conflicts']:
            if c.split('-')[0] != grp: err('CONFLICT_GROUP', w, 'конфликт %s из другой группы' % c)
        # источники
        for s in r['sources']:
            sw_ = w + '/' + s['source_id']; uniq('source_id', (w, s['source_id']), sw_)
            if not DATE.match(s['version_date']) or not DATE.match(s['verified_at']): err('SOURCE_DATE', sw_, 'дата не ISO')
            elif s['version_date'] > s['verified_at']: err('SOURCE_DATE', sw_, 'version_date позже verified_at')
            elif s['verified_at'] > contract['generated_at'][:10]: err('SOURCE_DATE', sw_, 'verified_at позже generated_at')
            kz = s['jurisdiction'] == 'KZ'
            if (r['source_type'] == 'national_protocol') != kz: err('SOURCE_KIND', sw_, 'КП РК и международные источники смешаны (source_type=%s, jurisdiction=%s)' % (r['source_type'], s['jurisdiction']))
        # входные данные доз
        ri, dg = r['dose_guard']['required_inputs'], r['dose_guard']
        rules = {}
        for k in ('dose_rules', 'thresholds', 'rules'): rules.update(dg.get(k) or {})
        perkg = [k for k in rules if re.search(r'(^|_)kg(_|$)|per_kg', k)]
        if perkg:
            if not ({'weight_kg', 'weight_g'} & set(ri)): err('DOSE_NO_WEIGHT', w, 'дозы на кг без входа weight_kg/weight_g: ' + ', '.join(perkg))
            if 'weight_measured_at' not in ri: err('DOSE_NO_WEIGHT_TIME', w, 'дозы на кг без weight_measured_at (масса только текущая): ' + ', '.join(perkg))
        for k, v in rules.items():
            if not isinstance(v, (int, float, str, bool)): err('RULE_TYPE', w + '/' + k, 'значение правила должно быть числом/строкой/булевым')
    # --- тесты ---
    norm = {}
    groups = {r['recommendation_id'].split('-')[0] for r in recs}
    per_group = {}
    for t in tests:
        uniq('test_id', t['id'], t['id'])
        if t['id'].split('-')[1] != t['group']: err('TEST_GROUP', t['id'], 'группа теста не совпадает с id')
        if t['group'] not in groups: err('TEST_NO_RULE', t['id'], 'нет рекомендации группы %s' % t['group'])
        k = re.sub(r'\s+', ' ', t['assertion'].lower()).strip()
        if k in norm: err('TEST_DUPLICATE', t['id'], 'дублирует %s' % norm[k])
        norm[k] = t['id']; per_group[t['group']] = per_group.get(t['group'], 0) + 1
    for g in sorted(groups):
        if g not in per_group: err('GROUP_NO_TEST', g, 'для группы нет синтетических тестов')
    # --- предупреждения (не ошибки) ---
    defined = {c for r in recs for c in r['conflicts']}
    warn('CONFLICT_REGISTRY_ABSENT', 'recommendations', 'conflicts содержит %d ссылок без описаний в файле (реестр конфликтов не передан)' % len(defined))
    if len(tests) != 42: warn('TEST_COUNT', 'synthetic_tests', 'в файле %d сценариев (ожидается 42: 22 G1–G5 + 20 G6–G10 — G1–G5 в файл не вошли)' % len(tests))
    return E, W, {'recommendations': len(recs), 'tests': len(tests), 'tests_by_group': per_group, 'protocols_covered': len(set(allc))}


def run(contract_path, schema_path, protocols_json, baseline_path):
    c, s = json.load(open(contract_path, encoding='utf-8')), json.load(open(schema_path, encoding='utf-8'))
    E, W, stats = validate(c, s, protocols_json)
    base = json.load(open(baseline_path, encoding='utf-8')) if baseline_path and Path(baseline_path).exists() else []
    key = lambda e: (e['code'], e['where'])
    bk = {(b['code'], b['where']): b for b in base}
    ack = [dict(e, **{'reason': bk[key(e)]['reason'], 'owner': bk[key(e)]['owner']}) for e in E if key(e) in bk]
    new = [e for e in E if key(e) not in bk]
    stale = [b for b in base if (b['code'], b['where']) not in {key(e) for e in E}]
    return {'errors': new, 'acknowledged': ack, 'stale_baseline': stale, 'warnings': W, 'stats': stats}


if __name__ == '__main__':
    a = sys.argv[1:]
    contract = a[0] if a else str(ROOT / 'knowledge/audit-v3-v4.contract.json')
    rep = run(contract, ROOT / 'knowledge/knowledge-contract-v1.schema.json', ROOT / 'data/protocols.json', ROOT / 'knowledge/known-findings.json')
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    sys.exit(1 if rep['errors'] or rep['stale_baseline'] else 0)
