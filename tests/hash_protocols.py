"""Хэш базы протоколов из любой сборки index.html или data/protocols.json: python3 tests/hash_protocols.py файл"""
import sys, re, json, hashlib
s = open(sys.argv[1], encoding='utf-8').read()
if sys.argv[1].endswith('.html'):
    s = re.search(r'<script type="application/json" id="proto-src">(.*?)</script>', s, re.S).group(1)
p = json.loads(s)
print(len(p['items']), hashlib.sha256(json.dumps(p, ensure_ascii=False, sort_keys=True).encode()).hexdigest())
