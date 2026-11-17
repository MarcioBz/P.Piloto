# AlunoTec

Sistema web escolar em HTML, CSS e JavaScript sem etapa de build. As páginas são servidas diretamente pelo navegador; por isso, os caminhos relativos e a ordem dos scripts fazem parte da arquitetura.

## Estrutura

```text
AlunoTec/
├── index.html                 # Entrada/login
├── login/                     # Estilos e lógica do login
├── admin/                     # Painel administrativo
├── turmas/                    # Cadastro e gestão de turmas/alunos
├── aluno/                     # Consulta e gestão da área do aluno
├── frequencia/                # Registro e consulta de frequência
├── shared/                    # Recursos compartilhados entre páginas
├── assets/                    # Imagens e ícones
├── eletivas/                  # Página informativa de eletivas
├── config/                    # Espaço reservado (arquivos vazios)
├── inst/                      # Espaço reservado (arquivos vazios)
├── relat/                     # Espaço reservado (arquivos vazios)
└── docs/                      # Auditoria e contratos internos
```

## Regras de integração

- Cada página carrega seu próprio JavaScript de página. Funções com nomes iguais em `admin`, `aluno`, `turmas` e `frequencia` são implementações locais, não declarações globais compartilhadas.
- `shared/profile.js` e `shared/profile.css` são carregados nas páginas que possuem o menu de perfil. Mantenha esses arquivos depois dos estilos locais e preserve a ordem dos scripts `defer` no HTML.
- As chaves de `localStorage` listadas em `docs/CONTRATOS_DE_DADOS.md` são contratos entre módulos. Não renomeie nem altere seu formato sem migração compatível.
- O projeto não possui bundler, gerenciador de dependências ou etapa de compilação. Testes de sintaxe JavaScript podem ser feitos com `node --check`.

## Antes de publicar

1. Configure a autenticação real e confirme as regras de autorização no servidor.
2. Configure o Supabase em `turmas/script.js` e valide a tabela/políticas RLS.
3. Implemente ou remova os destinos de navegação que ainda não existem.
4. Crie o `turmas/service-worker.js` ou retire o registro do service worker.
5. Teste login, persistência, sincronização, frequência, remanejamentos e permissões em ambiente de homologação.

Consulte `docs/REVISAO_TECNICA.md` para os achados da auditoria e `docs/CONTRATOS_DE_DADOS.md` para as chaves compartilhadas.
