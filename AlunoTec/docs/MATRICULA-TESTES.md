# Validação da entrega

Base: `P.Piloto-main(3).zip`, com as fotografias das fichas de matrícula e saúde fornecidas em 27/11/2026. Não foram utilizados dados pessoais reais nos testes.

## Testes novos

`node tests/enrollment.cjs`: **19 cenários aprovados**, cobrindo:

- Criar, editar, distinguir nomes de polos e excluir um polo vazio.
- Salvar e recarregar os 89 campos/grupos das duas fichas; conservar dados pessoais, escolares e de saúde.
- Recusar CPF inválido, aluno duplicado e segunda matrícula do mesmo aluno/ano.
- Adicionar a Base Comum e Eletiva com nome e telefone do cadastro original; rejeitar nova inclusão no mesmo destino.
- Editar com o mesmo ID; propagar contato e preservar chamadas históricas.
- Recusar uma edição desatualizada; remover vínculo sem apagar matrícula ou pessoa.
- Bloquear exclusão de polo vinculado e transferir/arquivar com histórico e IDs preservados.
- Conservar fichas de anos anteriores com a mesma pessoa.
- Reutilizar IDs antigos e distinguir alunos homônimos.
- Restaurar as chaves originais quando uma gravação falha e recuperar uma transação interrompida.
- Rejeitar falta de permissão e JSON inválido sem apagar cadastros.
- Pesquisar pelo nome parcial com diferenças de caixa/acentos e restringir os resultados ao polo e ano escolhidos.
- Validar a inclusão das matrículas no backup.
- Gerar impressão com as quinze perguntas, CID-10/CID-11, datas, assinaturas e escape de texto.
- Confirmar que a API desativada não envia dados; testar envio, recebimento e erros de sessão/conflito com HTTP simulado.

`python3 tests/verify-files.py`: **12 páginas sem IDs repetidos ou referências ausentes; 32 arquivos JavaScript e o teste sem erros de sintaxe**. Foram conferidas as associações explícitas dos labels aos controles, os nomes separados de cada grupo Sim/Não e a reutilização do calendário compartilhado.

## Correção de aparência e escopo

As verificações foram repetidas no pacote corrigido. Os 19 cenários de matrícula e a verificação dos arquivos passaram novamente.

`python3 tests/scope.py`: **quatro verificações aprovadas**. O manifesto compara SHA-256 de **68 arquivos originais preservados**, incluindo todos os arquivos carregados por Professores. Confere também o CSS original da Matrícula como base íntegra, o trecho original de importação CSV e a presença das duas fichas dentro do pop-up.

As nove alterações em arquivos anteriores estão relacionadas a Matrícula, sua integração com Turmas, backup e documentação. A lista está em `MATRICULA-ARQUIVOS.md`. O ZIP foi preparado com uma única pasta atual do aplicativo; o RAR antigo do envio não foi redistribuído.

## Compatibilidade

Foram executadas, contra esta entrega, 15 suítes anteriores. **14 passaram integralmente**: calendários, séries, frequência de eletivas, backup, professores, adaptador de professores, anos letivos e oito verificações de relatórios/navegação/gráficos/origem de alunos.

Uma expectativa visual antiga em `student-links.cjs` diverge porque procura a ausência literal do prefixo `Eletiva:` na tabela de Frequência. A mesma expectativa também falha no ZIP original recebido, antes destas alterações. O arquivo de Frequência foi mantido sem edição nesta entrega. As verificações de identidade, origem e transferências desse teste que antecedem a expectativa visual passaram. Isso não foi apresentado como regressão corrigida ou teste aprovado.

## Impressão e responsividade

A impressão foi renderizada separadamente em um mecanismo de documentos, com dados fictícios e papel A4. O caso comum resultou em duas páginas, uma para cada ficha. Um caso com observações extensas ocupou três páginas e manteve a continuação do texto, as assinaturas e o rodapé. As páginas foram revisadas como imagens.

O ambiente bloqueou a prévia do navegador durante a tentativa de abertura. Portanto, o clique real de ponta a ponta, a janela nativa de impressão e a aparência em computador/tablet/celular **não foram verificados nesse navegador**. A responsividade foi conferida no código, com grades de uma coluna em telas menores, campos sem largura mínima fixa e rolagem nas tabelas. O mecanismo de documentos não substitui a conferência final no navegador de uso da escola.

## Banco remoto

A configuração permanece desativada. Não houve teste com Supabase real, criação de banco, aplicação do SQL ou publicação. O contrato e os testes simulados comprovam o comportamento do adaptador; autenticação, políticas e migração reais dependem da implantação descrita em `MATRICULA-API.md`.
