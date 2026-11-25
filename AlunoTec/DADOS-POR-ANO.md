# AlunoTec — anos letivos e histórico

Esta versão foi preparada a partir de `P.Piloto-main(2).zip` e inclui os ajustes de Frequência com Base Comum/Eletivas e da coluna Turma de origem em Turmas.

## Como os anos funcionam

- O ano atual vem da data do aparelho. O sistema não fica preso em 2026.
- O seletor oferece o ano anterior, o atual e os cinco seguintes. Essa janela avança a cada ano.
- Anos que possuem turmas ou chamadas salvas continuam disponíveis, mesmo fora dessa janela.
- É possível selecionar um ano futuro antes de cadastrar suas turmas.
- Na primeira abertura após a virada do calendário, uma seleção antiga avança para o ano atual. Uma seleção futura é mantida.
- Uma consulta histórica escolhida manualmente permanece selecionada nas próximas aberturas durante o mesmo ano do calendário.

## Começando um novo ano

Escolha o ano na barra superior ou em Configurações. Depois, cadastre as turmas e as matrículas correspondentes ao novo período. Os formulários de novas turmas já sugerem o ano selecionado.

A troca do ano não promove alunos, não copia matrículas e não apaga os anos anteriores. Para consultar um período antigo, selecione seu ano novamente.

A data real de criação de uma turma pode ser diferente de seu ano letivo: uma turma de 2027 pode ser preparada em 2026.

## Chamadas, calendários e relatórios

As chamadas exigem uma data válida do ano letivo selecionado. O calendário impede escolher dias de outro ano, e o salvamento verifica essa regra novamente.

No ano atual, a data inicial da chamada é hoje. Em outro ano, o sistema usa a última data de chamada disponível nesse ano ou, se não houver registros, 1º de janeiro. É possível escolher outro dia no calendário.

Relatórios e indicadores consideram o ano salvo em cada chamada. Registros antigos sem esse campo usam o ano de sua própria data. Isso evita misturar o histórico com uma turma de outro período.

Turmas antigas sem ano explícito recebem um ano uma única vez, a partir da data cadastrada ou da seleção anterior. Seus alunos e suas datas são preservados.

## Dados e atualização

Os dados desta versão permanecem no navegador e dispositivo em que foram cadastrados. A atualização do ano não implementa compartilhamento entre dispositivos.

Para atualizar os arquivos, substitua a pasta AlunoTec pela versão deste pacote e recarregue a página com Ctrl+F5. Continue usando o mesmo endereço e navegador para acessar os registros locais. Em Configurações, é possível exportar uma cópia de segurança antes da substituição.

## Verificação desta versão

Passaram 97 verificações automatizadas, além da conferência de integridade dos arquivos. Foram simuladas a virada de 2026 para 2027, datas bissextas e a consulta de anos antigos. Na interface, foram conferidos o ano futuro sem turmas, o cadastro com 2027 sugerido, o calendário limitado a esse ano e o retorno aos registros de 2026.
