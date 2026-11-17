# AlunoTec

Sistema web escolar em HTML, CSS e JavaScript, sem etapa de build. Abra `index.html` para entrar. As páginas usam caminhos relativos e armazenam dados no `localStorage` do navegador.

## Áreas

- `admin/`: painel administrativo com dados locais de turmas e frequência.
- `turmas/`: cadastro e gestão de turmas, alunos e eletivas.
- `aluno/`: consulta de alunos e remanejamentos.
- `frequencia/`: registro e consulta de chamadas.
- `relat/`: resumo filtrado de frequência e exportação CSV.
- `inst/`: identificação local da instituição.
- `config/`: ano letivo e exportação de cópia JSON.
- `shared/`: recursos compartilhados.
- `assets/`: imagens e ícones.

## Persistência e integrações

As chaves de armazenamento são contratos entre páginas. Consulte `docs/CONTRATOS_DE_DADOS.md` antes de alterá-las. A autenticação real requer um serviço de servidor que exponha `window.AlunoTecAuth`; ele não está incluído neste pacote. A sincronização Supabase também exige URL, chave pública e políticas RLS configuradas. Sem esses serviços, os dados ficam neste navegador.

O service worker foi removido porque não havia arquivo correspondente. Consulte `docs/REVISAO_TECNICA.md` para o resumo das correções e dos limites desta cópia.
