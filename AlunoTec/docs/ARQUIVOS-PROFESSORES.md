# Arquivos da atualização Professores

Comparação com a versão AlunoTec-Calendarios-e-Realidades.

## Arquivos modificados

- `config/backup.js`
- `config/config.html`
- `config/config.js`
- `docs/CONTRATOS_DE_DADOS.md`
- `index.html`
- `shared/access.js`
- `shared/app-extra.css`
- `shared/app-shell.js`
- `shared/banner.js`

## Arquivos criados

- `config/backup.html`
- `config/teachers.css`
- `config/teachers.js`
- `docs/ARQUITETURA-PROFESSORES.md`
- `docs/ARQUIVOS-PROFESSORES.md`
- `docs/AUTENTICACAO-PROFESSORES.md`
- `login/teacher-login.css`
- `login/teacher-login.js`
- `professores/area.css`
- `professores/area.html`
- `professores/area.js`
- `shared/teacher-service-config.js`
- `shared/teacher-service.js`
- `shared/teachers-store.js`

O menu e o topbar continuam sendo montados por `shared/app-shell.js`. As funcionalidades anteriores de ano letivo e cópia foram preservadas em `config/backup.html`.

O cadastro local está funcional. O login real permanece desativado, conforme a escolha do usuário, e depende do serviço descrito em `docs/AUTENTICACAO-PROFESSORES.md`. Não houve atualização de arquivos no GitHub.
