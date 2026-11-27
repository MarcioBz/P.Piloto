# Contrato do serviço de matrículas

O adaptador está preparado, com `enabled: false`. Este documento não representa um servidor implementado. A proposta PostgreSQL/Supabase está em `database/enrollment-schema.sql` e deve ser revisada com o modelo definitivo da instituição antes de executar.

## Endpoints

A API deve estar na mesma origem, normalmente em `/api/alunotec`, sob HTTPS ou localhost durante desenvolvimento.

| Método e rota | Comportamento |
| --- | --- |
| `GET /session` | Confirma `{authenticated, role, csrfToken}` por uma sessão real. Só Administrador, Secretaria e Administrativo podem consultar ou alterar as fichas. |
| `GET /enrollment` | Retorna `{remoteRevision, document, classes}`. Documento no formato validado por `enrollment-store.js`; `classes` usa o catálogo canônico existente. Sem cadastro no servidor, retorna `remoteRevision: null`. |
| `PUT /enrollment` | Recebe `{expectedRemoteRevision, document, classes}`. Verifica instituição, sessão, CSRF, campos e todos os vínculos. Grava em transação e devolve `{remoteRevision}` inteiro. Uma divergência de revisão retorna `409`, preservando o conteúdo do servidor. |

`401` indica ausência de sessão; `403`, falta de permissão; `409`, conflito. As respostas devem usar JSON e `Cache-Control: no-store`. O servidor deriva a instituição e o usuário da sessão, nunca de um papel ou ID arbitrário enviado pelo navegador.

## Persistência e integridade

- Reutilizar o catálogo atual de turmas; não criar outra lista. A tabela proposta de vínculos aponta para o ID já existente. Enquanto as turmas forem JSON, a API verifica ID, tipo e ano em transação.
- Guardar o aluno uma vez em `alunotec_students`, a matrícula por aluno/ano em `alunotec_enrollments`, e os polos e vínculos separadamente.
- Validar CPF, datas, campos/grupos das duas fichas, exclusividade das respostas e identidade do aluno. Não confiar apenas na validação do formulário.
- Normalizar nomes de polos no servidor para a mesma comparação sem acentos do cliente. Preservar IDs, matrículas históricas, documentos e movimentos do polo.
- Uma revisão deve ser bloqueada e incrementada atomicamente para evitar atualizações perdidas. Rejeitar o PUT inteiro se houver qualquer erro, inclusive em turmas.
- As tabelas propostas têm RLS ativado sem políticas de acesso público. Criar as políticas e o serviço apropriados ao projeto real; nunca expor `service_role` ou outra chave administrativa no front-end.
- Confirmar antes da ativação que professores e visitantes não consultam fichas de saúde, documentos, códigos de professores ou cadastros administrativos.

## Compatibilidade e ativação

O sincronizador antigo de `turmas/script.js` cobre apenas o JSON de turmas. Ele não envia a nova chave de matrículas e não deve ser usado como se fosse a sincronização completa. Ao adotar a nova API para o catálogo, desative a gravação concorrente do sincronizador antigo ou implemente uma ponte transacional no servidor.

A primeira associação de um navegador que já tem dados a um servidor também preenchido exige conciliação. O adaptador recusa sobrescrever silenciosamente os dois conjuntos. Não migre por nomes; use IDs, CPF e revisão administrativa de possíveis duplicidades.

Os relatórios, chamadas, remanejamentos e anexos atuais precisam manter seus respectivos contratos durante a implantação do backend definitivo. Esta proposta acrescenta os dados de matrícula e os vínculos; não migra automaticamente as demais chaves do aplicativo.

## Validação de implantação ainda necessária

Criar o projeto/servidor, aplicar e revisar as tabelas, implementar endpoints e políticas, mapear as turmas existentes e importar os dados após resolver conflitos. Testar com duas contas e duas instituições, dados concorrentes, revogação de permissões, indisponibilidade, recuperação e cópias. Os testes HTTP incluídos usam respostas controladas; não substituem esse teste com um banco real.
