# Contratos de dados compartilhados

As chaves abaixo são usadas por mais de uma área ou conectam fluxos de páginas diferentes. Trate-as como interfaces internas do sistema.

| Chave | Uso observado | Módulos |
|---|---|---|
| `alunotec_turmas_v2` | Dados de turmas base/eletivas e listas de alunos | Turmas, Aluno, Frequência, Admin |
| `alunotec_turmas_activity_v1` | Histórico/notificações de atividades | Turmas, Aluno, Frequência, Admin |
| `alunotec_alunos_remanejamentos_v1` | Histórico de transferências/remanejamentos | Turmas, Aluno, Frequência |
| `alunotecSchoolYear` | Ano letivo selecionado | Admin, Frequência |
| `alunotec_supabase_session_v1` | Sessão de sincronização Supabase | Turmas, Aluno |
| `alunotecSession` (sessionStorage) | Estado de sessão local usado ao sair | Login/áreas autenticadas |
| `alunotec.profile.v1` | Nome e foto do perfil local | Shared Profile |
| `alunotec_frequencia_v1` | Chamadas e situação de frequência | Frequência |
| `alunotec_frequencia_alertas_v1` | Alertas calculados de frequência | Frequência |
| `alunotec_frequencia_alertas_ocultos_v1` | Alertas dispensados | Frequência |

## Cuidados

- Não reutilize uma chave existente para guardar outro formato de objeto.
- Ao alterar um formato, implemente leitura compatível com o formato antigo e migração explícita.
- `localStorage` é compartilhado entre páginas da mesma origem. Por isso, alterações em uma área podem afetar outra área que lê a mesma chave.
- `sessionStorage` tem ciclo de vida diferente de `localStorage`; não troque um pelo outro sem revisar login e logout.
- Dados no navegador não substituem validação de autorização no servidor.
