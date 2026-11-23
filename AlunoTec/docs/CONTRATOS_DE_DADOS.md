# Contratos de dados compartilhados

As chaves abaixo são interfaces internas entre páginas. Não reutilize uma chave para guardar outro formato. Ao alterar um formato, mantenha leitura compatível ou implemente migração explícita.

| Chave                                    | Uso                                     | Módulos                                      |
| ---------------------------------------- | --------------------------------------- | -------------------------------------------- |
| `alunotec_turmas_v2`                     | Turmas base/eletivas e listas de alunos | Turmas, Aluno, Frequência, Admin             |
| `alunotec_turmas_activity_v1`            | Histórico e notificações de atividades  | Turmas, Aluno, Frequência, Admin             |
| `alunotec_alunos_remanejamentos_v1`      | Histórico de transferências             | Turmas, Aluno, Frequência                    |
| `alunotecSchoolYear`                     | Ano letivo selecionado                  | Admin, Frequência, Configurações, Relatórios |
| `alunotec_supabase_session_v1`           | Sessão de sincronização Supabase        | Turmas, Aluno                                |
| `alunotecSession` (`sessionStorage`)     | Estado local de sessão                  | Entrada e visualização local                     |
| `alunotec.profile.v1`                    | Nome e foto do perfil                   | Shared Profile                               |
| `alunotec_frequencia_v1`                 | Chamadas e situação de frequência       | Frequência, Admin, Relatórios                |
| `alunotec_frequencia_alertas_v1`         | Alertas calculados de frequência        | Frequência                                   |
| `alunotec_frequencia_alertas_ocultos_v1` | Alertas dispensados                     | Frequência                                   |
| `alunotec_institution_v1`                | Identificação local da instituição      | Instituição, Cópia de segurança              |

`localStorage` é compartilhado entre páginas da mesma origem; alterações podem afetar outras áreas que usam a mesma chave. `sessionStorage` tem ciclo de vida diferente e não deve ser trocado sem revisar login e logout. Dados no navegador não substituem validação de autorização no servidor.

## Identidade e movimentação de alunos

- Cada aluno é identificado por ID; nomes iguais não devem ser fundidos.
- `originStudentId` relaciona a cópia de uma eletiva ao cadastro de origem. Cadastros antigos só são relacionados por nome quando existe um único aluno possível no ano.
- `originBaseClassId/Name` e `originClassId/Name` preservam a turma de origem. `transferHistory` conserva os destinos e as datas de transferências físicas.
- Chamadas guardam `originClassId/Name` e `currentClassId/Name` como estavam na data. Não se deve recalcular esses campos retroativamente a partir da matrícula atual.
- `shared/utils.js` descreve os vínculos atuais e os vínculos numa data consultada.

## Backup

O JSON tem `application: "AlunoTec"`, `formatVersion: 2`, `exportedAt`, `localStorage` com strings das chaves reconhecidas, e `attachments` com ID, nome, MIME e base64. A versão 1 continua aceita sem anexos.

Os anexos locais estão no IndexedDB `alunotec-anexos-frequencia`, store `atestados`. O estado anterior à última restauração fica no IndexedDB `alunotec-backup-recovery`, store `copies`. Apenas uma versão anterior é mantida; desfazer troca a versão atual e a anterior. As sessões não entram no backup.

A restauração atualiza a fila `alunotec_turmas_pending_sync_v1` para não reenviar uma versão antiga das turmas. A integração remota existente está desconfigurada e cobre somente turmas; não é a sincronização completa do aplicativo.
