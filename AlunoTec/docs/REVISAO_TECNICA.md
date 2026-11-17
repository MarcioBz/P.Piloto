# Revisão técnica do AlunoTec

## Escopo analisado

Foram examinados os arquivos HTML, CSS e JavaScript presentes no pacote, as referências locais entre páginas e recursos, os identificadores HTML, os nomes de funções e os usos de armazenamento local. As imagens foram preservadas sem alteração.

## Alteração aplicada

### `frequencia/frequencia.js`

O arquivo continha declarações de funções repetidas dentro do mesmo escopo. Em JavaScript, a declaração posterior prevalecia, deixando cópias anteriores sem efeito e dificultando a manutenção. Foram removidas 14 declarações anteriores, mantendo a última implementação de cada função duplicada. O código resultante passou na verificação de sintaxe do Node.js.

Nenhuma chave de armazenamento, nome de elemento HTML, evento público ou caminho de arquivo foi renomeado nesta limpeza.

## Semelhanças que não devem ser fundidas automaticamente

Há funções com nomes semelhantes em `admin/dashboard.js`, `aluno/aluno.js` e `turmas/script.js`, como `checkInternetConnection`, `updateConnectionStatus`, `updateSummary` e `closeAllDropdowns`. Elas atuam sobre páginas diferentes, com elementos e estados diferentes. Cada arquivo mantém seu próprio escopo (IIFE ou callback de inicialização), portanto esses nomes não colidem globalmente no navegador. Fundi-las sem criar uma API compartilhada e testar cada página poderia introduzir regressões.

Também há funções como `render`, `showToast`, `readActivities` e `updateBell` em módulos distintos. A coincidência do nome não significa que uma substitui a outra.

## Problemas encontrados que exigem decisão/implementação

1. **Autenticação não incluída no pacote:** `login/login.js` depende de `window.AlunoTecAuth` e procura os métodos `login`, `institutionalLogin`, `guestLogin` e `forgotPassword`. Não há implementação de `AlunoTecAuth` nos arquivos entregues. Assim, o login depende de um script/backend externo não incluído.
2. **Sincronização Supabase sem configuração:** `turmas/script.js` declara `SUPABASE_URL` e `SUPABASE_ANON_KEY` vazios. A sincronização remota não ficará funcional até que sejam configurados os dados do projeto e as políticas de acesso.
3. **Service worker ausente:** `turmas/script.js` tenta registrar `./service-worker.js`, mas esse arquivo não está no pacote. O `catch` evita uma falha não tratada, mas o cache offline não é instalado.
4. **Links locais sem destino:** `turmas/index.html` contém links para `../escola/index.html` e `../configuracoes/index.html`, arquivos que não existem no pacote recebido.
5. **Módulos vazios:** `config/`, `inst/` e `relat/` contêm arquivos HTML/CSS/JS vazios. Foram mantidos para não apagar áreas aparentemente reservadas do projeto.
6. **CSS com seletores repetidos:** há blocos repetidos em várias folhas de estilo. Parte pode ser sobreposição responsiva intencional. Não foram mesclados automaticamente, pois isso pode alterar a cascata, estados hover/active e layouts em breakpoints.
7. **Autorização:** comentários do próprio login indicam que permissões e senhas devem ser validadas pelo backend. Não se deve tratar verificações no JavaScript do navegador como barreira de segurança.

## Verificações realizadas

- Todos os arquivos JavaScript não vazios passaram por `node --check` após a limpeza.
- Não foram encontrados IDs HTML duplicados nas páginas examinadas.
- Foram identificadas e registradas as referências locais sem arquivo correspondente.
- A verificação é estática: não substitui testes de navegador, testes de integração com Supabase nem validação de permissões no servidor.

## Organização preservada

A estrutura de diretórios e os nomes dos arquivos de página foram mantidos para não quebrar caminhos relativos já usados no HTML, CSS e JavaScript. A reorganização aplicada foi conservadora: remoção de código sombreado comprovadamente redundante e documentação dos limites entre módulos e contratos compartilhados.
