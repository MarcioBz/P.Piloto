# Guia de organização e edição — AlunoTec

## Como localizar o que precisa ser alterado

Cada HTML, CSS e JavaScript começa com um `MAPA DE EDIÇÃO` em português. Nos arquivos extensos, os divisores de seção já existentes continuam indicando os blocos; use a busca do editor (Ctrl+F) pelo nome da área, classe, ID ou função citados no mapa.

| Tipo       | Onde editar                                               | Cuidados ao salvar                                                                                              |
| ---------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| HTML       | Estrutura visual e conteúdo da página (`*.html`)          | IDs usados pelo JavaScript e classes usadas pelo CSS precisam continuar alinhados.                              |
| CSS        | Apresentação da página (`*.css`)                          | Procure a regra existente antes de criar outra; regras posteriores podem complementar ou substituir anteriores. |
| JavaScript | Ações, filtros, cálculos, persistência e eventos (`*.js`) | Preserve os IDs do HTML e as chaves de armazenamento compartilhadas entre as páginas.                           |

## Arquivos compartilhados

- `shared/app-shell.js`: cria o menu lateral e o topbar iguais nas páginas internas, registra a biblioteca `at-icon-*` e controla menu móvel, ano letivo, perfil e conexão.
- `shared/responsive-shell.css`: estilos únicos do menu e topbar, traço e alinhamento dos ícones compartilhados, responsividade e regras base para dimensionamento, links, campos e tabelas.
- `shared/profile.css` e `shared/profile.js`: edição do nome e da foto de perfil, compartilhada pelas páginas internas.
- `shared/utils.js`: proteção de texto, importação CSV, ordenação e identificação dos vínculos dos alunos.
- `shared/access.js` e `shared/app-extra.css`: entrada/visualização local, ajuda, avisos e correções comuns.
- `shared/student-links.css`: etiquetas de eletiva, origem e turma atual junto ao nome dos alunos.
- `shared/management.css`: cartões, formulários, indicadores e tabelas comuns a Configurações, Instituição e Relatórios.

As páginas internas carregam os arquivos compartilhados no próprio HTML. Para mudar o menu, o topbar ou seu comportamento, edite os arquivos `shared` em vez de recriar a estrutura numa página. A tela inicial de login continua separada porque aparece antes da navegação interna. A entrada local não autentica uma conta no servidor.

## Dados usados por mais de uma tela

As chaves `alunotec_*` no armazenamento local conectam áreas como Turmas, Alunos, Frequência e Painel. O ano letivo também é compartilhado. Ao alterar uma chave, confira todos os módulos que a leem e gravam; alterar só um arquivo pode fazer uma tela deixar de encontrar dados existentes.

## Convenção para novas seções

Use divisores claros no idioma da interface. Explique o propósito do bloco e, quando houver acoplamento, cite os IDs/classes ou arquivo relacionado. Comentários devem orientar edição sem repetir literalmente o código nem alterar o comportamento.

Nos arquivos HTML, cada comentário de seção segue o padrão visual do Dashboard: linhas separadoras, um título curto e uma frase dizendo o que fica naquele bloco ou qual arquivo o controla.

## Nota sobre Eletivas

`eletivas/eletivas.html`, `eletivas.css` e `eletivas.js` exibem os cadastros do ano selecionado, pesquisam turmas/alunos e abrem os vínculos. O cadastro e a edição usam a tela Turmas por links com parâmetros.

## Cópias de segurança

`config/backup.js` valida e exporta os dados com anexos, e restaura guardando uma versão anterior. `config/config-local.js` controla a seleção, confirmação e desfazer da interface. Não inclua sessões ou tokens na lista de chaves exportadas.
