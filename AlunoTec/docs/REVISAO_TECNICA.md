# Revisão técnica do AlunoTec

## Correções aplicadas

- Removidas declarações duplicadas de `localDateKey` e `todayKey` em `aluno/aluno.js`.
- O dashboard administrativo agora lê turmas e chamadas das chaves locais compartilhadas, sem exibir os dados fictícios de demonstração.
- Os filtros de turma do dashboard são gerados com as turmas do ano selecionado.
- Os relatórios agora resumem os registros locais de frequência, permitem filtrar por ano/mês e exportar CSV.
- As páginas de Instituição e Configurações foram implementadas; os caminhos no menu de turmas foram ajustados.
- A configuração de ano letivo preserva anos futuros ou anteriores selecionados e é compartilhada com frequência e dashboard.
- Removido o registro de um service worker inexistente.
- Os nomes das turmas são inseridos no dashboard como texto seguro.

## Limites que ainda dependem de serviços externos

- `login/login.js` depende de `window.AlunoTecAuth`. O pacote não inclui autenticação de servidor. Não foi criado login local, pois isso não protegeria dados nem permissões.
- As credenciais Supabase seguem vazias em `turmas/script.js`; sincronização remota requer projeto configurado e políticas RLS apropriadas.
- Os dados desta versão são armazenados no navegador. Eles não são compartilhados entre dispositivos sem sincronização configurada.
- A cópia de segurança exporta os valores locais sem tokens de sessão. Ela não importa nem restaura dados automaticamente.

## Dados locais

As chaves existentes documentadas em `CONTRATOS_DE_DADOS.md` foram mantidas. A página Instituição adiciona `alunotec_institution_v1` para os dados de identificação salvos localmente.

## Escopo da revisão

Foi feita análise estática do pacote HTML, CSS e JavaScript e das referências locais. Esta revisão não representa validação de autenticação, implantação, integração Supabase ou execução em navegador.
