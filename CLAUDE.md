# CLAUDE.md — msg

Guia de trabalho para qualquer sessão do Claude Code neste repositório.
A fonte da verdade funcional é `docs/ESPECIFICACAO.md` (v1.5). Este arquivo
consolida as regras de trabalho e os pontos não negociáveis.

## Contexto em uma frase

Aplicação web multi-organização para publicar textos e imagens programados em
grupos de Telegram, hospedada em `msg.oa12.org` sobre Railway.

**Nome da aplicação: `msg`.** Genérico de propósito, para servir a outros usos
além da OA. O projeto no Railway também se chama `msg`, e o repositório foi renomeado para
`cnasajon/msg`. O bot (`@OAmsg_bot`) mantém o nome atual.

**Interface: tema escuro é o padrão**, com alternador para o claro na mesma
linha do cabeçalho. A entrada é uma tela de quatro blocos — Painel de controle,
Textos, Configuração (admin e superadmin) e Sistema (só superadmin) —, e o menu
lateral segue a mesma divisão.

## Regras de trabalho

- **Responder sempre em português.**
- **Mostrar alterações de código em forma de diff**, nunca arquivos inteiros.
- **Nenhum segredo no código ou no repositório.** Tudo em variável de ambiente,
  cadastrada manualmente no painel do Railway. `.env` no `.gitignore` desde o
  commit inicial. Nunca pedir ao usuário o valor de um segredo e nunca tentar
  automatizar o cadastro de segredos.
- **Perguntar quando a especificação estiver ambígua**, em vez de decidir
  sozinho. Decisões tomadas por falta de resposta ficam registradas como
  suposição explícita.
- **Trabalhar em branch e abrir PR.** As sessões rodam na nuvem
  (`claude.ai/code`).
- **Não pular etapas da sequência de entrega.** Cada fase depende de aprovação
  explícita do usuário antes da implementação.
- Ao final de cada fase, **atualizar o `README.md`** com o passo a passo de
  instalação e deploy, espelhando a seção 3 da especificação.
- Nenhum identificador de modelo de IA em commits, PRs, comentários de código
  ou qualquer artefato do repositório.

## Pontos não negociáveis

1. **Isolamento entre organizações na camada de dados**, não na interface.
   Nenhuma consulta parte de um identificador vindo da URL sem verificar a
   organização do usuário autenticado. Existem testes que provam que um admin
   de uma organização não alcança dados de outra por manipulação de
   identificador na URL — **inclusive imagens**.
2. **Idempotência das publicações** garantida pelo índice único em
   `publications (folder_id, data_prevista, hora_prevista)`. A reivindicação do
   slot é gravada **antes** da chamada ao Telegram, dentro de uma transação.
   Trava em memória do processo não serve.
3. **Dispatcher no serviço `worker`**, separado do serviço `web`, fixo em uma
   réplica.
4. **Fuso horário:** `TZ=UTC` em todos os serviços; agendamento e exibição
   sempre no fuso da pasta, indicado explicitamente na interface.
5. **Bot único do Telegram** (`@OAmsg_bot`) na variável compartilhada
   `TELEGRAM_BOT_TOKEN`. O campo de token da pasta é sobreposição opcional,
   nulo por padrão, cifrado com AES-256-GCM, editável só pelo superadmin e
   nunca reexibido por inteiro.
6. **Quatro situações do texto:** `pendente | publicado | erro | arquivado`.
   Arquivar é a ação normal para tirar um texto da lista; excluir existe para o
   admin, em casos excepcionais. O histórico sobrevive à exclusão porque
   `publications` guarda `conteudo_publicado` e `tinha_imagem`.
7. **Dois limites de tamanho:** 4096 caracteres para texto sem imagem, 1024
   para texto com imagem (limite de legenda do Telegram). A validação muda ao
   anexar ou remover a imagem, na digitação e na importação.
8. **Imagens no Postgres como `bytea`**, servidas em rota autenticada e lidas
   pelo worker direto do banco. Sem serviço de armazenamento externo e sem
   volume do Railway.
9. **Fila esgotada:** comportamento configurável por pasta
   (`parar_notificar` ou `reiniciar`).
10. **Destino dos alertas com a precedência da seção 7.4:** `settings`, depois
   variável de ambiente, depois só log e painel. O worker precisa conseguir
   alertar mesmo com o banco inacessível. As duas configurações podem estar
   vazias sem quebrar o deploy.
11. **`chat_id` de cada pasta e destino dos alertas configuráveis pela
    interface.** Nada de `chat_id` fixo no código.
12. **Importação traz histórico:** coluna opcional de data de publicação; essas
    linhas entram como `publicado` e, em `publications`, com
    `origem = importacao` e `hora_prevista` nula. O dispatcher nunca as reenvia.
13. **Exportação dos textos** em PDF, XLSX, CSV, JSON e XML, respeitando o filtro
    e o escopo do usuário.

## Stack

Node.js 22 + TypeScript · Next.js (App Router, server actions) · PostgreSQL 16
gerenciado pelo Railway · Prisma · `node-cron` no worker · `xlsx` (SheetJS) ·
`sharp` · Telegram Bot API via `fetch` · Tailwind CSS · `next-intl` (pt, es, en)
· argon2id · Vitest.

## Estrutura de serviços no Railway

| Serviço | Start | Observação |
| :-- | :-- | :-- |
| `web` | `npm run start:web` | health check `/health` |
| `worker` | `npm run start:worker` | sem health check, réplicas fixas em 1 |
| `postgres` | — | plugin gerenciado |

Migrações rodam no build/release, nunca no start.

## Testes obrigatórios

- Isolamento entre organizações, inclusive a rota de imagem.
- Idempotência do dispatcher (dois processos concorrendo pelo mesmo slot).
- Limites de 4096/1024 caracteres com e sem imagem.
- Precedência do destino dos alertas (settings → env → log/painel).
- Integridade das traduções: mesmas chaves em pt/es/en, nenhuma chave usada no
  código sem tradução e nenhum grupo de cliente fora do que vai ao navegador.

## Fases

| Fase | Conteúdo | Situação |
| :-- | :-- | :-- |
| 0 | Modelo de dados, matriz de permissões, mockup estático, escolha do framework | entregue |
| 1 | Railway conforme 3.3, autenticação, organizações, usuários, permissões, isolamento testado | entregue |
| 2 | Pastas, textos, imagens, importação CSV/XLSX, exportação, reordenação | entregue |
| 3 | Agendamentos, dispatcher, Telegram, idempotência testada, alertas e configurações globais | entregue |
| 4 | Painel, i18n, auditoria, polimento visual | entregue |
