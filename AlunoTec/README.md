# AlunoTec — versão local revisada

Sistema escolar em HTML, CSS e JavaScript. Esta versão funciona neste dispositivo, com dados salvos pelo navegador. As contas online e o compartilhamento entre computadores aguardam a criação e integração do Supabase.

## Como abrir

1. Faça uma cópia da sua pasta atual e exporte os dados em **Configurações → Cópia de segurança**.
2. Copie os arquivos da pasta `AlunoTec` deste pacote para a sua pasta `AlunoTec`, mantendo as subpastas.
3. No VS Code, abra `index.html` com o Live Server. Continue usando o mesmo endereço e a mesma porta do projeto anterior.
4. Na entrada, clique em **Usar neste dispositivo**. **Visualizar neste dispositivo** abre os cadastros com os comandos de alteração desabilitados.

Se você já tem Python 3, também pode executar `INICIAR.bat` no Windows ou `python3 servidor-local.py` no terminal. Depois abra **http://127.0.0.1:5500/index.html**. Não há instalação de pacotes nem etapa de build.

O navegador separa dados por endereço e porta. `file://`, `localhost:5500` e `127.0.0.1:5500` usam armazenamentos diferentes. Se trocar o endereço, exporte os dados no anterior e restaure o JSON no novo. Copiar os códigos pelo GitHub não transfere os cadastros escolares.

## Fluxo de uso

1. Cadastre a Base Comum e as Eletivas em **Turmas**.
2. Abra uma turma e cadastre ou importe seus alunos. O CSV aceita nome, WhatsApp e status; cria novos cadastros. Para preservar IDs, vínculos e histórico entre dispositivos, use a cópia JSON.
3. Use **Eletiva** na linha do aluno para vinculá-lo a uma eletiva. **Transferir** muda a turma, preservando a origem. **Alunos** também permite consultar os remanejamentos de frequência.
4. Em **Frequência**, escolha a turma da Base Comum, data e turno, marque os alunos e salve. Para corrigir uma linha salva, clique em **Editar**, altere e clique em **Salvar** nessa linha.
5. Consulte os filtros e relatórios em **Relatórios**. Os arquivos PDF e Excel são gerados localmente, com os filtros aplicados. A impressão usa a janela do navegador.
6. Em **Configurações**, exporte uma cópia JSON completa. A restauração valida o arquivo, pede confirmação e guarda a versão anterior em **Desfazer última restauração**. Os anexos de justificativa entram na cópia.

Os anos do seletor global vêm das turmas cadastradas. Os relatórios mantêm as informações salvas na chamada; uma transferência atual não reescreve o histórico. As listas usam ordenação alfabética em português. Homônimos conservam seus identificadores próprios.

A página Eletivas consulta vínculos e leva ao cadastro correspondente em Turmas. As chamadas desta versão são das turmas da Base Comum; cadastrar uma eletiva não gera presença ou falta automaticamente.

## O que o modo local oferece

Cadastro e consulta de turmas/alunos, eletivas, remanejamentos, chamada, anexos, painel, relatórios PDF/XLSX, identificação da escola, perfil local, notificações e backup/restauração.

A visualização local é uma conveniência da interface. Não é uma barreira de segurança: os arquivos e dados deste navegador continuam acessíveis a quem usa o computador. Não há autenticação real, autorização no servidor ou sincronização entre dispositivos nesta entrega.

Para uso compartilhado será necessário integrar autenticação, tabelas relacionais, regras por escola/perfil e armazenamento de anexos no Supabase. Preencher apenas a URL e a chave pública no código antigo de Turmas não conecta todas as abas nem cria essas regras.

## Arquivos e validação

- `shared/`: navegação, perfil, entrada local, vínculos e estilos comuns.
- `admin/`, `aluno/`, `turmas/`, `frequencia/`, `eletivas/`, `relat/`, `inst/`, `config/`: páginas e suas funções.
- `docs/REVISAO_TECNICA.md`: correções, verificações e limites da revisão.
- `docs/CONTRATOS_DE_DADOS.md`: campos e chaves compartilhados.

Os cadastros usados nos testes são fictícios e ficaram apenas no navegador de teste. O pacote não carrega alunos ou chamadas de demonstração.


## Matrícula e polos

A página Matrícula foi ampliada com polos, cadastro único do aluno, ficha escolar e as quinze perguntas da ficha de saúde. Em Turmas, Adicionar aluno reutiliza uma matrícula por polo, com pesquisa e preenchimento do nome e telefone.

Esta revisão recupera o padrão visual original da Matrícula, com cartões de polos e formulário em pop-up. Professores e suas dependências foram preservados conforme o projeto enviado. A pasta `AlunoTec` é a única versão do sistema neste pacote.

A documentação de uso, dados e impressão está em [docs/MATRICULA-IMPLEMENTACAO.md](docs/MATRICULA-IMPLEMENTACAO.md). Os arquivos e os resultados de validação estão em [docs/MATRICULA-ARQUIVOS.md](docs/MATRICULA-ARQUIVOS.md) e [docs/MATRICULA-TESTES.md](docs/MATRICULA-TESTES.md).

O armazenamento local funciona sem banco remoto. A proposta SQL e o adaptador de sincronização vêm preparados e desativados; a ativação depende do servidor autenticado descrito em [docs/MATRICULA-API.md](docs/MATRICULA-API.md).
