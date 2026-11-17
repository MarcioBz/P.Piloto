# Guia de organização e edição — AlunoTec

## Como localizar o que precisa ser alterado

Cada HTML, CSS e JavaScript começa com um `MAPA DE EDIÇÃO` em português. Nos arquivos extensos, os divisores de seção já existentes continuam indicando os blocos; use a busca do editor (Ctrl+F) pelo nome da área, classe, ID ou função citados no mapa.

| Tipo       | Onde editar                                               | Cuidados ao salvar                                                                                              |
| ---------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| HTML       | Estrutura visual e conteúdo da página (`*.html`)          | IDs usados pelo JavaScript e classes usadas pelo CSS precisam continuar alinhados.                              |
| CSS        | Apresentação da página (`*.css`)                          | Procure a regra existente antes de criar outra; regras posteriores podem complementar ou substituir anteriores. |
| JavaScript | Ações, filtros, cálculos, persistência e eventos (`*.js`) | Preserve os IDs do HTML e as chaves de armazenamento compartilhadas entre as páginas.                           |

## Arquivos compartilhados

- `shared/management.css`: cabeçalho, navegação e formulários de Configurações, Instituição e Relatórios.
- `shared/profile.css` e `shared/profile.js`: apresentação e comportamento do perfil em páginas que carregam esse recurso.
- `shared/responsive-shell.css`: navegação e elementos responsivos das páginas que o importam.
- `shared/turmas-menu.js`: menu móvel da área de Turmas.

## Dados usados por mais de uma tela

As chaves `alunotec_*` no armazenamento local conectam áreas como Turmas, Alunos, Frequência e Painel. O ano letivo também é compartilhado. Ao alterar uma chave, confira todos os módulos que a leem e gravam; alterar só um arquivo pode fazer uma tela deixar de encontrar dados existentes.

## Convenção para novas seções

Use divisores claros no idioma da interface. Explique o propósito do bloco e, quando houver acoplamento, cite os IDs/classes ou arquivo relacionado. Comentários devem orientar edição sem repetir literalmente o código nem alterar o comportamento.

Nos arquivos HTML, cada comentário de seção segue o padrão visual do Dashboard: linhas separadoras, um título curto e uma frase dizendo o que fica naquele bloco ou qual arquivo o controla.

## Nota sobre Eletivas

`eletivas/eletivas.html` é uma página provisória e ainda não tem módulo CSS/JavaScript próprio.
