# Cartões de resumo — 27/11/2026

Os cartões de Turmas, mostrados na imagem 1, foram usados como referência para os indicadores de Alunos, Frequência, Início, Matrícula e Professores.

- Fundo branco, bordas arredondadas, sombra discreta e faixa verde lateral.
- Blocos verdes claros com ícones verdes, preservando cada símbolo original.
- Rótulo acima do número, com a mesma tipografia e espaçamento da referência.
- Os cartões de Professores mantêm o quadro, o capelo e os demais símbolos.
- No resumo do Início, os cartões de presentes, ausentes e frequência geral foram retirados, inclusive suas porcentagens e formas decorativas. Permanece Total de alunos. Os registros de frequência e os gráficos existentes foram preservados.

## Arquivos desta alteração

Criado: `shared/summary-cards.css`, carregado apenas nas cinco telas indicadas.

Modificados: `aluno/aluno.html`, `frequencia/frequencia.html`, `admin/dashboard.html`, `matricula/matricula.html` e `config/config.html`.

Também foram atualizados `tests/scope.py` e `tests/preserved-files.json` para registrar as alterações visuais autorizadas e continuar protegendo os demais arquivos.

Os scripts, os símbolos, os cadastros e as integrações não foram alterados nesta revisão. As alterações anteriores de Matrícula permanecem no pacote. Os arquivos listados em `MATRICULA-ARQUIVOS.md` descrevem aquela etapa; esta nota registra a atualização visual posterior.

## Conferência

A revisão compara o pacote anterior com esta entrega: os símbolos das cinco telas foram preservados, assim como os scripts, as informações dos cartões restantes e os elementos fora do resumo do Início. As referências de arquivos e os IDs são verificados com `python3 tests/verify-files.py`; o escopo com `python3 tests/scope.py`.

A prévia no navegador não foi executada nesta revisão. As grades responsivas existentes foram mantidas e os blocos recebem dimensões menores em telas de celular.
