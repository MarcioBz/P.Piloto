# Relatórios com timbre AlunoTec

Atualização aplicada sobre a versão com anos letivos dinâmicos. As demais áreas do projeto foram preservadas.

## Baixar PDF

- Formato A4 vertical, com o timbre em todas as páginas.
- Título do cabeçalho correspondente ao relatório aberto, incluindo Realidade de sala, Realidade do sistema, Relatório individual e as demais opções.
- Colunas ajustadas à largura da folha, nomes completos com quebra de linha e cabeçalhos repetidos.
- Paginação, escola, período, indicadores e observações mantidos.
- Geração local, sem depender de serviços externos ou conexão com a internet.

## Imprimir relatório

O documento usa o mesmo timbre e título da consulta aberta. A barra superior, o menu lateral, o banner, o botão de voltar, mensagens de exportação e os botões de exportar ficam fora da impressão.

Os dados, indicadores e gráficos visíveis do relatório são preservados. Os campos usados para escolher datas e alunos ficam apenas na tela; o documento informa a consulta aplicada.

O timbre é incluído como imagem, para aparecer mesmo com a opção de imprimir planos de fundo desmarcada. Se o navegador acrescentar seu próprio endereço, data ou título nas bordas da folha, desmarque “Cabeçalhos e rodapés” na janela de impressão.

A folha usa a imagem inteira dentro da página A4. O espaço do cabeçalho e do rodapé é reservado no próprio documento e repetido nas páginas seguintes, evitando o recorte das bordas do timbre.

## Atualizar a pasta

Substitua a pasta AlunoTec pelo conteúdo atualizado e recarregue com Ctrl+F5. Continue acessando pelo mesmo endereço e navegador para consultar seus dados locais.

## Conferência

Foram validados os títulos das 11 opções de relatório, a orientação A4, a presença do timbre em todas as páginas e a preservação de nomes completos em um relatório com 90 linhas. Um registro muito extenso também foi testado atravessando várias páginas.

Na interface, os downloads de Realidade de sala e Acompanhamento das eletivas foram gerados e conferidos visualmente. O documento de impressão foi verificado com os mesmos dados e sem os botões de ação. A prévia nativa de impressão estava desativada no navegador do ambiente de teste.

A correção do recorte foi conferida renderizando os estilos de impressão em documentos de uma e sete páginas. Foram verificados o timbre completo em cada folha, o título, o gráfico, a preservação dos 90 registros e o espaço entre os dados e as áreas de cabeçalho e rodapé. A montagem do documento também foi conferida na interface de Realidade do sistema.

Arquivos envolvidos: `relat/relat.html`, `relat/relat.css`, `relat/relat.js` e `relat/timbre.js`.
