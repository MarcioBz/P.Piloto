# Implementação da aba Professores

## Base analisada

A implementação parte da última versão completa editada nesta conversa, `AlunoTec-Calendarios-e-Realidades.zip`. A leitura de `https://github.com/MarcioBz/P.Piloto` não estava disponível no ambiente, e a conexão GitHub não estava habilitada. Portanto, não foi feita comparação com a revisão remota nem commit/push no repositório.

Foram reutilizados:

- `shared/app-shell.js`: um único menu lateral, topbar, perfil e seletor de ano para todas as páginas. A entrada Configurações foi substituída por Professores. A aba Professores fica no grupo ADMINISTRAÇÃO, abaixo de Instituição.
- `shared/banner.js` e estilos compartilhados: mesma marca, foto e estrutura do banner.
- `shared/utils.js`: escape de conteúdo exibido, sem reimplementar o cadastro de turmas.
- `alunotec_turmas_v2.electives`: fonte única das turmas disponíveis. Professores armazenam somente seus IDs, por ano e semestre.
- `shared/access.js` e `login/login.js`: entrada local existente e ponto `AlunoTecAuth`. O login online anterior já era um ponto de integração sem provedor ativo.
- `config/backup.js`, `config.js` e `config-local.js`: ferramentas existentes de ano/backup/restauração. Sua tela foi preservada em `config/backup.html`, acessível no menu do perfil em Dados e cópia de segurança.

## Cadastro local entregue

A aba mantém a rota anterior `config/config.html`, agora com `data-app-page="teachers"`. Não há uma segunda navegação.

Campos: nome, disciplina livre, código automático de cinco dígitos, status, semestre e eletivas do ano selecionado. É possível consultar, editar, copiar/consultar o código, ativar/desativar e excluir mediante confirmação. Busca, filtros, contadores e paginação usam dados reais, sem exemplos cadastrados automaticamente.

A chave nova `alunotec_professores_v1` guarda:

```json
{
  "version": 1,
  "revision": 1,
  "teachers": [{
    "id": "UUID",
    "name": "Nome completo",
    "subject": "Matéria digitada livremente",
    "code": "00001",
    "status": "active",
    "assignments": { "2026": { "1": ["id-da-eletiva"], "2": [] } },
    "createdAt": "data ISO",
    "updatedAt": "data ISO"
  }],
  "revokedCodes": []
}
```

O ano do exemplo é apenas ilustrativo. O cabeçalho define o ano utilizado. Os IDs apontam para as eletivas já existentes, sem copiar listas de alunos, nomes de turmas ou outros registros para o cadastro docente.

A edição aplica apenas os semestres alterados no formulário e preserva os demais períodos e anos. Alterações de semestre, disciplina ou status não regeneram o código. A reativação mantém o código. A exclusão reserva o código antigo e não exclui turmas, alunos ou chamadas.

A geração usa `crypto.getRandomValues`, conserva zeros à esquerda e rejeita colisões com professores ativos, inativos e códigos excluídos. A gravação local usa Web Locks para serializar alterações entre abas da mesma origem, mais controle de atualização para evitar sobrescrever uma edição antiga. Use `INICIAR.bat`/localhost/HTTPS em navegador atualizado. Não há garantia de unicidade entre navegadores independentes enquanto o serviço compartilhado não existir.

## Permissões e limite do modo local

O modo local é uma ferramenta administrativa no dispositivo e não equivale a uma conta autenticada. A nova aba não mostra o cadastro em modo visitante, em uma sessão declarada como professor ou sem a entrada local de edição. Isso é uma restrição da interface; não transforma armazenamento no navegador em controle de segurança.

Por escolha confirmada pelo usuário, o login dos professores fica **preparado e desativado** até existir um serviço real. Não há validação de login comparando o código com `localStorage`, nem criação de sessão de professor no `sessionStorage`.

Quando o serviço estiver habilitado, o gerenciamento verifica a sessão no servidor e aceita Administrador, Secretaria ou Administrativo. Erros de sessão/API não provocam retorno ao cadastro local. A área `professores/area.html` consulta exclusivamente endpoints autorizados e não carrega `shared/utils.js`, perfis locais nem o cadastro escolar de alunos do navegador.

O contrato completo está em [AUTENTICACAO-PROFESSORES.md](AUTENTICACAO-PROFESSORES.md). Somente preparar o front-end não implementa o servidor descrito nesse contrato.

## Compatibilidade e cópias

O backup existente inclui o cadastro docente e seus códigos locais; o arquivo deve ficar reservado à administração. Não inclui sessão online ou cookies. O validador rejeita códigos/atribuições inválidos ou duplicados. Cópias antigas sem a chave de professores continuam aceitas e preservam o cadastro docente já existente. A restauração reversível continua usando o mecanismo anterior.

As outras chaves escolares foram preservadas, sem migração automática de turmas/chamadas nem escrita em seus cadastros pela nova aba.

## Arquivos

| Arquivos | Responsabilidade |
| --- | --- |
| `config/config.html`, `config/teachers.css`, `config/teachers.js` | Tela e modais de gerenciamento |
| `shared/teachers-store.js` | Regras, códigos, atribuições, validação e gravação local |
| `shared/teacher-service-config.js`, `shared/teacher-service.js` | Configuração desativada e adaptador da API autenticada |
| `login/teacher-login.js`, `login/teacher-login.css`, `index.html` | Entrada do professor integrada ao login existente |
| `professores/area.html`, `professores/area.js`, `professores/area.css` | Consulta das turmas autorizadas por uma sessão real |
| `shared/app-shell.js`, `shared/banner.js`, `shared/app-extra.css`, `shared/access.js` | Entradas e textos no shell existente |
| `config/backup.html`, `config/backup.js`, `config/config.js` | Preservação da tela e das cópias existentes |
| `tests/teachers.cjs`, `tests/teacher-service.cjs` | Regressões de códigos, períodos, permissões e integração |
