# AlunoTec

Sistema de gestão da frequência escolar, desenvolvido para facilitar o acompanhamento dos alunos e a organização das informações da instituição.

O AlunoTec reúne cadastros, turmas, eletivas, chamadas e relatórios em uma interface simples e integrada.

> Projeto piloto em desenvolvimento.

## Funcionalidades

- **Painel inicial:** resumo da frequência, indicadores e atividades recentes.
- **Alunos:** pesquisa, consulta de dados, identificação da turma atual e histórico de remanejamentos.
- **Turmas:** organização das turmas, cadastro de alunos e importação e exportação de listas.
- **Eletivas:** acompanhamento dos alunos vinculados e visualização da turma em que cada um se encontra.
- **Frequência:** registro de presenças, faltas e justificativas, com possibilidade de anexar documentos.
- **Relatórios:** consultas por aluno, turma e período, com opções de exportação e impressão.
- **Notificações:** acompanhamento de alterações, cadastros e remanejamentos, com leitura individual e alertas de faltas recorrentes.
- **Configurações:** gerenciamento de preferências e ferramentas de backup e restauração.

## Tecnologias utilizadas

- HTML5
- CSS3
- JavaScript
- Armazenamento local no navegador

## Como executar

### 1. Clone o repositório

```bash
git clone https://github.com/MarcioBz/P.Piloto.git
```

### 2. Acesse a pasta do projeto

```bash
cd P.Piloto/AlunoTec
```

### 3. Inicie um servidor local

Com o Python 3 instalado, execute:

```bash
python -m http.server 8000
```

Depois, acesse:

```text
http://localhost:8000
```

Também é possível abrir o projeto no Visual Studio Code e executar o arquivo `index.html` com a extensão Live Server.

Na tela inicial, escolha **Usar neste dispositivo** para acessar o modo local.

## Armazenamento dos dados

A versão atual mantém os dados no navegador utilizado. A ferramenta de backup, disponível nas Configurações, permite salvar e restaurar uma cópia das informações.

O acesso com contas online e a sincronização entre dispositivos dependem da configuração da integração com o Supabase.

## Organização do projeto

O código está dividido por área do sistema:

| Pasta | Área |
|---|---|
| `admin` | Painel inicial |
| `aluno` | Consulta e acompanhamento dos alunos |
| `turmas` | Gerenciamento de turmas e cadastros |
| `eletivas` | Consulta das eletivas e seus alunos |
| `frequencia` | Registro e acompanhamento das chamadas |
| `relat` | Relatórios |
| `inst` | Informações da instituição |
| `config` | Configurações e backup |
| `shared` | Componentes, estilos e funções compartilhadas |

## Equipe

**Criador:** Márcio Bezerra

**Colaboradores:**
- Estevam Martins
- Mateus Ferreira

## Autoria e uso

O AlunoTec é um projeto desenvolvido por Márcio Bezerra,
Estevam Martins e Mateus Ferreira.

Este README apresenta o trabalho da equipe e não concede,
por si só, uma licença de reutilização do código.

Qualquer utilização deve respeitar a autoria, a licença
aplicável e os termos do GitHub.
