# Contrato para ativar o acesso real de professores

## Situação entregue

`shared/teacher-service-config.js` contém `enabled: false`. O cadastro local funciona, mas seus códigos **não permitem login**. O arquivo público não deve conter senhas, chaves administrativas ou `service_role`.

A ativação exige um serviço autenticado e um banco compartilhado. Pode ser um backend próprio ou uma camada de servidor sobre Supabase, depois que houver um projeto e as políticas de acesso forem definidas. O adaptador usa uma API da mesma origem, por exemplo `/api/alunotec`; um proxy de servidor pode encaminhar a implementação ao provedor escolhido.

Não basta trocar `enabled` para `true`. Antes, implemente e teste os endpoints, a autorização no servidor, a migração/importação dos dados e a proteção das rotas administrativas. Os HTMLs antigos são páginas locais e não constituem uma aplicação remota isolada por usuário.

## Endpoints esperados pelo adaptador

Todos retornam JSON, usam `Cache-Control: no-store` e não incluem códigos ou dados escolares em URLs.

| Método / caminho relativo | Permissão e resposta |
| --- | --- |
| `GET /session` | Sessão real: `{authenticated, role, profile: {id, name, subject}, csrfToken}`. Uma sessão de professor usa `role: "PROFESSOR"`. A função de sessão não confia em papéis enviados pelo navegador. |
| `POST /teacher/login` | Corpo `{code: "00001"}`. Valida no banco, limita tentativas, cria cookie de sessão e retorna JSON. O cliente confirma a sessão com `GET /session` antes de abrir a área do professor. |
| `POST /logout` | Invalida a sessão no servidor e o cookie. |
| `GET /teachers` | Somente Administrador/Secretaria/Administrativo. Retorna `{document, classes}`: `document` no formato validado por `teachers-store.js`; `classes` vem do cadastro canônico de turmas. Os códigos só podem aparecer nesta resposta administrativa. |
| `POST /teachers` | Somente gestão. Cria o professor e gera/reserva seu código atomicamente no servidor. O corpo inclui `name`, `subject`, `status`, `year` e `terms`. O servidor ignora qualquer código/role enviado pelo cliente. |
| `PATCH /teachers/:id` | Somente gestão. Valida `expectedUpdatedAt`, altera os campos e somente as atribuições enviadas em `terms`, preservando código, demais semestres e anos. |
| `PATCH /teachers/:id/status` | Somente gestão. Corpo `{status: "active" ou "inactive"}`. A inativação revoga sessões existentes imediatamente. A reativação conserva o código. |
| `DELETE /teachers/:id` | Somente gestão. Revoga o código e todas as sessões em transação, preserva as chamadas e mantém o código reservado contra reutilização. |
| `GET /teacher/classes?year=2026&semester=1` | Professor ativo. Retorna somente `{classes: [{id, name, studentCount}]}` que pertençam ao professor autenticado naquele ano/semestre. |
| `GET /teacher/classes/:id?year=2026&semester=1` | Revalida o vínculo no servidor; retorna `{class: {id, name}, students: [{id, name}]}`. Não retorna responsáveis, outros professores nem cadastros alheios. |

Respostas de erro usam `401` para ausência/expiração de sessão, `403` para falta de permissão, `409` para conflito de edição/código e `429` para excesso de tentativas, com `{message: "mensagem segura"}`. Não informar se um código específico existe, está inativo ou foi excluído na resposta de login.

## Banco e vínculos

- Reutilizar a tabela canônica de eletivas do backend existente. Atribuições apontam para seu ID; não criar outro cadastro de turmas.
- Modelar professor e atribuições separadamente, com restrição única para professor/ano/semestre/turma.
- Garantir código único por instituição com uma restrição/transação no banco. Reservar também códigos inativos e revogados, mantendo recuperação administrativa sem trocá-los entre períodos.
- Não importar cadastros locais de vários dispositivos silenciosamente: apresentar conflitos de IDs/códigos para resolução antes da ativação.
- Manter o código cifrado para a recuperação administrativa e um identificador protegido/derivação com segredo do servidor para busca e validação. As chaves ficam no gerenciador de segredos do backend, nunca nos arquivos públicos. Aplicar criptografia e controle de acesso também às cópias do banco.
- A geração do servidor deve usar fonte criptográfica e rejeitar colisões sob concorrência; a geração local não substitui essa restrição.

## Sessões, autorização e segurança

O código de cinco dígitos tem um espaço de busca pequeno e não deve ser tratado como uma senha forte. Exigir limitação de tentativas por instituição/conta/origem, monitoramento de abuso, expiração e, para uso público, avaliar um fator adicional. Não registrar códigos em logs.

Usar HTTPS e cookies de sessão `HttpOnly`, `Secure` e `SameSite`, com identificador de alta entropia independente do código de cinco dígitos. Validar origem e CSRF nas mutações; `GET /session` entrega o token CSRF, mantido pelo adaptador somente em memória. O cookie deve ser invalidado no logout, na desativação e na exclusão, e o servidor deve verificar professor ativo e atribuições em toda requisição, não apenas no login.

Toda leitura ou escrita deve derivar a identidade da sessão. Um professor não pode fornecer um `teacherId` para operar outro cadastro, nem obter acesso a uma turma apenas por conhecer seu ID. Alterações de semestre e ano não concedem vínculo automaticamente.

Proteger também as rotas de gestão, backup, códigos e demais APIs administrativas. Não carregar o conjunto escolar completo em um navegador de professor para depois apenas escondê-lo com JavaScript. Os fluxos antigos de frequência usam o armazenamento local inteiro e precisam de endpoints autorizados antes de serem disponibilizados a professores; esta entrega não concede acesso a essas páginas antigas.

As permissões atribuídas a Administrador/Secretaria/Administrativo devem ser concedidas pelo backend; os campos `role`/`mode` no navegador não autorizam operações remotas. Nunca publicar um endpoint de criação de administradores por autoatribuição de perfil.

Referências oficiais para a implementação do servidor: [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) e [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Conferência antes de ativar

Validar em integração real: dois professores não conseguem consultar turmas um do outro; um professor não consulta códigos/backup/gestão; desativar ou excluir invalida inclusive sessões já abertas; os dois semestres mantêm vínculos independentes; concorrência não duplica códigos; restauração/importação não reativa contas revogadas; erros e indisponibilidade não liberam acesso local de professor.
