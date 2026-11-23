# Revisão do AlunoTec — 23/11/2026

## Arquivo de origem

A versão final usa o conteúdo de **P.Piloto-main (2)(1).zip**, enviado mais recentemente nesta conversa. A revisão começou na cópia anterior; depois da confirmação do arquivo, as correções foram reaplicadas sobre este ZIP. Os estilos e ajustes já presentes nele foram preservados. A união dos arquivos não deixou conflitos de código.

## Correções e implementações

- Entrada explícita de edição e visualização local, já que o projeto ainda não tem provedor de autenticação. Os controles de contas online informam essa condição.
- Página Eletivas com contadores, busca, ano, cartões, consulta dos alunos e links para cadastrar/gerenciar em Turmas.
- Correção dos seletores personalizados: as opções voltam a abrir, inclusive nas janelas. O seletor nativo oculto sai da navegação por teclado.
- As janelas fechadas de cadastro em Turmas deixam de manter campos acessíveis ao foco.
- Links para abrir uma turma ou criar uma eletiva passam a respeitar o tipo solicitado na URL.
- Vínculo de eletiva atualiza a lista imediatamente. IDs em atributos dinâmicos recebem escape.
- Listas continuam em ordem alfabética, com eletivas, origem e remanejamentos junto ao nome. Homônimos mantêm identidades distintas.
- O seletor individual do relatório reúne a matrícula na eletiva com o aluno correspondente, sem duplicar a pessoa; homônimos recebem identificação complementar.
- Relatórios recuperam a origem preservada para chamadas antigas sem esse campo. O fechamento mensal usa o mês dos dados ao sair da evolução anual.
- Frequência mantém os cadastros necessários para reconstruir uma lista histórica, mas não oferece turmas inativas para uma nova seleção. Antes da data da transferência, a linha não recebe a etiqueta de remanejamento atual.
- Atestados de vários dias preservam a origem do aluno. Eletivas inativas deixam de ser contadas como ativas no relatório.
- Backup JSON completo, incluindo anexos do IndexedDB, validação antes de restaurar, confirmação, recuperação da versão anterior e atualização da fila local de turmas.
- Importação CSV passa a interpretar separadores dentro de aspas, aspas escapadas, BOM, cabeçalhos em outra ordem e status inativo.
- Perfil, ajuda, notificações, controles de visualização e mensagens locais foram conferidos e documentados.

## Verificações automatizadas

Passaram **44 testes de comportamento** em Node: 15 de vínculos/ordenação/histórico, 18 de Alunos e 11 de relatórios/validação de backup/CSV.

A verificação estrutural conferiu as 9 páginas HTML, ausência de IDs e scripts duplicados, caminhos locais de HTML/CSS, sintaxe dos 16 arquivos JavaScript e sintaxe do servidor Python opcional.

Os testes estão na pasta `Testes` do pacote. Requerem Node para os arquivos `.cjs` e Python 3 para `integrity.py`; o aplicativo em si não exige Node.

## Verificações no navegador

Foram usados apenas cadastros fictícios no navegador de teste. Foram executados cadastro de duas turmas, cadastro de alunos, vínculo em eletiva, transferência física, consulta em Alunos/Eletivas, chamada, correção, justificativa com PDF, recarregamento e abertura do anexo.

Os totais do painel e do relatório coincidiram: quatro alunos nas chamadas, três presenças, uma justificativa e frequência de 75%. O relatório individual preservou a origem e mostrou a turma de destino. PDF e XLSX foram baixados e abertos por leitores de arquivo para conferir conteúdo e estrutura.

O backup exportado continha o anexo PDF idêntico ao original. Um JSON inválido foi rejeitado; uma cópia válida foi restaurada e a opção Desfazer recuperou o cadastro anterior. A visualização local desabilitou os comandos de cadastro, transferência, chamada e edição institucional.

A tentativa posterior de enviar um CSV ao navegador foi recusada pela permissão de upload. Por isso, o novo leitor CSV foi validado por testes de código; a importação completa pela interface não foi concluída nesta rodada.

Os ajustes finais sobre o ZIP mais recente foram submetidos novamente aos testes automatizados e à conferência visual no navegador.

## Limites desta entrega

- Não há projeto Supabase criado. Login real, autorização por escola/perfil e sincronização entre dispositivos continuam pendentes. A integração antiga de Turmas, desconfigurada, não cobre todos os dados do sistema.
- A visualização local é um bloqueio de comandos da interface, não uma proteção de servidor.
- Chamadas são de turmas da Base Comum. O relatório de Eletivas mostra os vínculos; matrícula não cria uma chamada automaticamente.
- O backup guarda uma versão anterior para desfazer; não é um histórico ilimitado. O limite de importação é 40 MB, e o navegador precisa ter espaço disponível.
- Não foram validados todos os navegadores, dispositivos móveis ou a impressão em uma impressora física. O comando de impressão prepara o relatório para a janela do navegador.
