# Contratos de dados compartilhados

As chaves abaixo são interfaces internas entre páginas. Não reutilize uma chave para guardar outro formato. Ao alterar um formato, mantenha leitura compatível ou implemente migração explícita.

| Chave | Uso | Módulos |
|---|---|---|
| `alunotec_turmas_v2` | Turmas base/eletivas e listas de alunos | Turmas, Aluno, Frequência, Admin |
| `alunotec_turmas_activity_v1` | Histórico e notificações de atividades | Turmas, Aluno, Frequência, Admin |
| `alunotec_alunos_remanejamentos_v1` | Histórico de transferências | Turmas, Aluno, Frequência |
| `alunotecSchoolYear` | Ano letivo selecionado | Admin, Frequência, Configurações, Relatórios |
| `alunotec_supabase_session_v1` | Sessão de sincronização Supabase | Turmas, Aluno |
| `alunotecSession` (`sessionStorage`) | Estado local de sessão | Login/áreas autenticadas |
| `alunotec.profile.v1` | Nome e foto do perfil | Shared Profile |
| `alunotec_frequencia_v1` | Chamadas e situação de frequência | Frequência, Admin, Relatórios |
| `alunotec_frequencia_alertas_v1` | Alertas calculados de frequência | Frequência |
| `alunotec_frequencia_alertas_ocultos_v1` | Alertas dispensados | Frequência |
| `alunotec_institution_v1` | Identificação local da instituição | Instituição, Cópia de segurança |

`localStorage` é compartilhado entre páginas da mesma origem; alterações podem afetar outras áreas que usam a mesma chave. `sessionStorage` tem ciclo de vida diferente e não deve ser trocado sem revisar login e logout. Dados no navegador não substituem validação de autorização no servidor.
