"""Confere os limites da alteração contra o projeto original enviado.

Os hashes representam arquivos recebidos, sem incluir dados de alunos.
Esta verificação protege as abas existentes e as dependências de Professores.
"""
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'tests/preserved-files.json').read_text())


def digest(content):
    return sha256(content).hexdigest()


for name, expected in manifest['files'].items():
    assert digest((ROOT / name).read_bytes()) == expected, f'Arquivo alterado fora do escopo: {name}'
print(f"PASS {len(manifest['files'])} arquivos originais preservados, incluindo os scripts de Professores.")

# A padronização visual posterior foi solicitada expressamente pelo usuário.
# Mantém o hash anterior como registro e verifica o conteúdo revisado da entrega.
visual_updates = manifest.get('visualCardChanges', {})
for name, update in visual_updates.items():
    assert digest((ROOT / name).read_bytes()) == update['sha256'], f'Alteração visual não revisada: {name}'
if visual_updates:
    print(f'PASS {len(visual_updates)} páginas com a padronização visual autorizada conferidas.')

css = (ROOT / 'matricula/matricula.css').read_bytes()
base = manifest['enrollmentCSS']
assert digest(css[:base['bytes']]) == base['sha256'], 'O CSS original da Matrícula foi substituído.'
print('PASS O CSS original da Matrícula continua íntegro como base.')

source = (ROOT / 'turmas/script.js').read_text()
section = source[source.index(manifest['csv']['start']):]
section = section[:section.index(manifest['csv']['end'])]
assert digest(section.encode()) == manifest['csv']['sha256'], 'A importação CSV foi modificada.'
print('PASS A importação CSV mantém o comportamento original.')


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parents = []
        self.form_in_dialog = False
        self.close_button = False
        self.fields = set()

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if values.get('id') == 'enrollmentForm':
            self.form_in_dialog = ('dialog', 'enrollmentDialog') in self.parents
        if values.get('id') == 'closeEnrollmentDialog':
            self.close_button = values.get('type') == 'button'
        if values.get('id'):
            self.fields.add(values['id'])
        if tag not in {'input', 'img', 'meta', 'link', 'br', 'hr', 'use', 'path'}:
            self.parents.append((tag, values.get('id')))

    def handle_endtag(self, tag):
        for index in range(len(self.parents) - 1, -1, -1):
            if self.parents[index][0] == tag:
                del self.parents[index:]
                return


page = Page()
page.feed((ROOT / 'matricula/matricula.html').read_text())
assert page.form_in_dialog and page.close_button, 'O formulário deve estar no pop-up da Matrícula.'
assert {'registrationPanel', 'healthPanel', 'enrollmentClassFilter', 'enrollmentStatusFilter'} <= page.fields
print('PASS As duas fichas permanecem no pop-up, com os filtros da lista preservados.')
