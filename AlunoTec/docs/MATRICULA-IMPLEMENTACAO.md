# Matrícula, polos e turmas

A base desta entrega é **P.Piloto-main(3).zip**. A página existente `matricula/matricula.html` foi ampliada; o menu, a topbar, a área Professores e as demais rotas foram mantidos.

## Uso

1. Inicie o projeto com `INICIAR.bat` ou com o servidor Python existente e entre em **Usar neste dispositivo**.
2. Abra **Matrícula**, cadastre o polo e abra seu cartão.
3. Clique em **Nova matrícula** para abrir o pop-up. Para alunos já existentes, use **Escolher aluno existente**. Homônimos são apresentados separadamente e não são fundidos pelo nome.
4. Preencha **Ficha de matrícula** e **Ficha de saúde**. As datas usam o calendário compartilhado e as respostas Sim/Não pertencem a grupos de seleção única. Listas como doenças e dificuldades permitem várias marcações, apresentadas como bolinhas.
5. Salve. Para corrigir, use **Editar** na lista do polo. A matrícula mantém o ID. **Imprimir** usa os dados salvos e preserva os dois espaços de assinatura do modelo de saúde.
6. Em **Turmas**, abra a turma e use **Adicionar aluno**. Escolha o polo, pesquise pelo nome, selecione e confirme. Nome e telefone são carregados do cadastro original.

**Cadastrar aluno**, **Importar** e **Exportar** mantêm os rótulos e o comportamento do projeto original em Turmas. Para reutilizar uma pessoa já matriculada, use **Adicionar aluno**; esse caminho impede repetir o mesmo ID na turma. A criação rápida e o CSV continuam sendo cadastros novos, como antes, e não fazem conciliação automática pelo nome. Uma segunda turma da Base Comum no mesmo ano usa a transferência/remanejamento existente.

## Correção de escopo e aparência

O CSS original da Matrícula foi preservado integralmente como base. O banner, os indicadores, os filtros, as tabelas, os botões e os pop-ups voltaram ao padrão existente. Somente os complementos de polos e das duas fichas foram acrescentados, com estilos exclusivos da página. Os cartões de polos seguem as dimensões e cores dos cartões de turmas.

O formulário completo abre em uma janela modal, com as partes Matrícula e Saúde. Salvar retorna à lista do polo; editar reutiliza a mesma matrícula. Fechar pelo botão, cancelar ou Escape verifica se há alterações não salvas. A tabela do polo mantém as informações de turma atual, origem, eletiva, realidade e situação, consultadas nas funções de vínculos já existentes.

Professores, seus seletores, o seletor de eletivas, o ícone, a posição no menu e todas as suas dependências compartilhadas são idênticos aos do projeto original recebido. `shared/access.js` também foi restaurado. O pacote contém somente uma pasta atual `AlunoTec`, sem o arquivo RAR antigo que vinha junto no envio original.

## Dados

A chave nova `alunotec_matriculas_v1` contém:

- `polos`: ID, nome, situação de arquivamento e datas.
- `students`: ID único e `personal`, com os dados pessoais e do responsável.
- `enrollments`: ID da matrícula, `studentId`, `poloId`, ano, ficha escolar (`registration`), ficha de saúde (`health`), versão do modelo e histórico de transferências entre polos.
- `version` e `revision`: versão do formato e controle das alterações.

Cada aluno pode ter uma matrícula por ano letivo. Sua identidade permanece nos anos seguintes. A matrícula não depende de já existir uma turma. Os alunos existentes nas turmas são reutilizados por seleção explícita e por ID; não há migração por nome nem fusão automática de homônimos.

`alunotec_turmas_v2` continua sendo o cadastro canônico das turmas. Seus integrantes guardam `studentId`, `enrollmentId` e `poloId`. Nome e telefone nessas listas são projeções de compatibilidade atualizadas a partir da pessoa central, não outro formulário de cadastro. Remover um vínculo da turma não apaga o aluno ou a matrícula. Chamadas antigas e seus nomes de referência não são reescritos.

A gravação local usa uma fila, Web Locks quando disponíveis e um registro de recuperação (`alunotec_matriculas_transaction_v1`). Falhas restauram as chaves anteriores; uma interrupção durante uma gravação pode exigir aguardar dez segundos e reabrir para recuperar. JSON inválido não é substituído por uma lista vazia.

Polos vazios podem ser excluídos mediante confirmação. Polos com registros exigem destino: as matrículas são transferidas, o polo original é arquivado e os movimentos ficam no histórico. O cadastro pessoal e os IDs permanecem.

## Fidelidade às fichas

`matricula/fields.js` centraliza **89 campos/grupos**, incluindo as **15 perguntas** da saúde, complementos, alternativas, CID-10/CID-11, observações, duas datas e anos dos espaços de assinatura. `CAMPOS-MATRICULA.csv` lista cada campo. Nacionalidade, sexo e CEP foram mantidos como complementos expressamente solicitados no comando; não estão visíveis nos dois modelos fotografados.

Não foram copiados nome, documentos, respostas médicas ou assinaturas preenchidas nas fotografias. Não há respostas de saúde negativas presumidas. As assinaturas são realizadas no documento impresso. Cabeçalhos e faixas azuis foram recriados em HTML; a impressão não é uma imagem da ficha preenchida nem uma reprodução dos logotipos originais.

A ficha usa A4 em retrato, sem navegação e botões. Os anos da tabela escolar acompanham o ano selecionado e o seguinte. Textos longos podem continuar em outras páginas, sem serem cortados. Para retirar a data/URL acrescentadas pelo próprio navegador, desmarque Cabeçalhos e rodapés na janela de impressão.

## Cópias e permissões

O backup existente inclui o novo cadastro, com validação de referências. Cópias antigas sem a chave de matrículas preservam o cadastro de matrículas já existente neste dispositivo. Desfazer a restauração mantém o mecanismo anterior. A fila de sincronização é atualizada após uma restauração.

A gestão das fichas locais exige a entrada local explícita de edição. Esse modo não é uma conta autenticada nem garante isolamento entre usuários do mesmo navegador. O acesso individual de professores continua preparado e desativado como antes. As fichas de saúde não são copiadas para as turmas nem enviadas pelo sincronizador antigo de turmas.

## Banco compartilhado

A configuração em `shared/enrollment-service-config.js` vem **desativada**. Há um adaptador HTTP testável e uma proposta de tabelas, mas nenhum Supabase ou servidor foi criado nesta entrega. A sincronização real depende da implementação do contrato `MATRICULA-API.md`, autenticação, autorização, migração e configuração do serviço da escola.

Não basta informar uma URL ou trocar `enabled` para `true`. Os endpoints precisam existir e confirmar as operações. A versão atual informa falhas e preserva os dados locais; não simula sucesso. O adaptador usa revisão otimista, CSRF e cookies da mesma origem. Não coloca dados pessoais ou de saúde em URLs.

## Conferência

Execute `node tests/enrollment.cjs`, `python3 tests/verify-files.py` e `python3 tests/scope.py`. A relação de testes executados e os limites da revisão estão em `MATRICULA-TESTES.md`.
