"""Verifica referências, IDs e sintaxe sem exigir bibliotecas adicionais."""
from pathlib import Path
from html.parser import HTMLParser
from collections import Counter
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.files = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if 'id' in values:
            self.ids.append(values['id'])
        attribute = {'script': 'src', 'link': 'href', 'img': 'src'}.get(tag)
        if attribute and values.get(attribute):
            self.files.append(values[attribute])

    handle_startendtag = handle_starttag

for path in ROOT.rglob('*.html'):
    page = Page()
    page.feed(path.read_text(encoding='utf-8'))
    for name, count in Counter(page.ids).items():
        if count > 1:
            errors.append(f'{path.relative_to(ROOT)}: ID repetido {name}')
    for value in page.files:
        if value.startswith(('http:', 'https:', 'data:', '#')):
            continue
        destination = path.parent / value.split('?')[0].split('#')[0]
        if not destination.is_file():
            errors.append(f'{path.relative_to(ROOT)}: arquivo ausente {value}')
    if path.name == 'matricula.html':
        source = path.with_suffix('.js').read_text(encoding='utf-8')
        used = set(re.findall(r'\$\("([A-Za-z][A-Za-z0-9-]+)"\)', source))
        for name in sorted(used - set(page.ids)):
            errors.append(f'Matrícula usa um ID estático ausente: {name}')

for path in ROOT.rglob('*.css'):
    for value in re.findall(r'url\([\'\"]?([^\)\'\"]+)', path.read_text(encoding='utf-8')):
        if value.startswith(('data:', 'http:', 'https:', '#')):
            continue
        if not (path.parent / value.split('?')[0]).exists():
            errors.append(f'{path.relative_to(ROOT)}: recurso CSS ausente {value}')

node = shutil.which('node')
if node:
    for path in [*ROOT.rglob('*.js'), *ROOT.rglob('*.cjs')]:
        result = subprocess.run([node, '--check', str(path)], capture_output=True, text=True)
        if result.returncode:
            errors.append(result.stderr)
else:
    print('Node.js indisponível: a verificação de sintaxe JavaScript foi pulada.')

if errors:
    print('\n'.join(errors))
    sys.exit(1)
print(f'PASS {len(list(ROOT.rglob("*.html")))} páginas sem IDs repetidos ou referências ausentes.')
if node:
    print(f'PASS {len(list(ROOT.rglob("*.js")))} arquivos JavaScript e testes sem erros de sintaxe.')
