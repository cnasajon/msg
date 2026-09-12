# oa12-msg

Aplicação web multi-organização para publicação programada de textos e imagens
em grupos de Telegram. Domínio: `msg.oa12.org`. Bot: `@OAmsg_bot`.

Especificação completa: [`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md) (v1.3).
Regras de trabalho para sessões do Claude Code: [`CLAUDE.md`](CLAUDE.md).

> **Situação: fase 0 aprovada.** Ainda não há código de aplicação. Esta fase
> entrega modelo de dados, matriz de permissões, mockup e a escolha do framework
> — ver [`docs/FASE0.md`](docs/FASE0.md). O próximo passo é o plano de
> implementação das fases 1 a 4, também sujeito a aprovação.

## O que já existe

| Caminho | Conteúdo |
| :-- | :-- |
| `docs/ESPECIFICACAO.md` | Especificação funcional e técnica |
| `docs/FASE0.md` | Entrega da fase 0 e perguntas em aberto |
| `prisma/schema.prisma` | Modelo de dados com índices e restrições únicas |
| `docs/mockup/` | Mockup navegável em HTML estático, sem build |
| `CLAUDE.md` | Regras de trabalho e pontos não negociáveis |

### Abrir o mockup

Sem build e sem dependência: abra `docs/mockup/index.html` no navegador depois
de um `git pull` da branch. Trabalhando pela nuvem, também dá para colar a URL
do arquivo no GitHub em `htmlpreview.github.io` — o GitHub não renderiza HTML do
repositório, mostra o código-fonte.

O seletor **Ver como** (superadmin / admin / usuário) e o botão de tema, na
faixa do topo, valem para todas as telas.

## Arquitetura

Um projeto no Railway chamado `oa12-msg`, com três serviços e um repositório só:

| Serviço | Função | Start | Observação |
| :-- | :-- | :-- | :-- |
| `web` | Interface e API | `npm run start:web` | health check `/health` |
| `worker` | Dispatcher de publicações | `npm run start:worker` | sem health check, **réplicas fixas em 1** |
| `postgres` | Banco | — | plugin gerenciado |

O dispatcher fica fora do serviço web de propósito: agendador dentro do `web`
significaria um agendador por instância, ou seja, publicação duplicada a cada
deploy ou escalonamento. A restrição única em
`publications (folder_id, data_prevista, hora_prevista)` é a segunda camada.

**Stack:** Node.js 22 + TypeScript · Next.js (App Router, server actions) ·
PostgreSQL 16 · Prisma · `node-cron` · `xlsx` · `sharp` · Telegram Bot API via
`fetch` · Tailwind · `next-intl` (pt/es/en) · argon2id · Vitest.

## Instalação local

> Disponível a partir da fase 1, quando existir `package.json`.

```bash
git clone git@github.com:cnasajon/oamsg.git
cd oamsg
npm install
cp .env.example .env      # preencher com valores locais; .env nunca é versionado
npx prisma migrate dev
npm run dev               # interface
npm run dev:worker        # dispatcher, em outro terminal
```

## Variáveis de ambiente

Nenhum segredo no repositório. Todos os valores são cadastrados no painel do
Railway; `.env` está no `.gitignore` desde o commit inicial.

Serviço `web`:

```
DATABASE_URL=${{postgres.DATABASE_URL}}
APP_URL=https://msg.oa12.org
SESSION_SECRET=${{shared.SESSION_SECRET}}
ENCRYPTION_KEY=${{shared.ENCRYPTION_KEY}}
TELEGRAM_BOT_TOKEN=${{shared.TELEGRAM_BOT_TOKEN}}
MAX_IMAGE_MB=2
NODE_ENV=production
TZ=UTC
```

Serviço `worker`: as mesmas, mais

```
DISPATCH_INTERVAL_MINUTES=5
DISPATCH_GRACE_MINUTES=30
ALERTS_CHAT_ID=          # pode começar vazio
GOOGLE_CHAT_WEBHOOK=     # opcional; se vazio, alerta só pelo Telegram
```

`TZ=UTC` em todos os serviços — o fuso de agendamento e exibição é sempre o da
pasta, convertido na aplicação. `ALERTS_CHAT_ID` e `GOOGLE_CHAT_WEBHOOK` podem
ficar vazios sem quebrar o deploy: nesse caso o sistema alerta apenas no log e
no painel.

### Gerar as chaves

Rode no seu terminal e guarde as duas no gerenciador de senhas **antes de fechar
o terminal** — não há leitura de volta depois de marcadas como *sealed* no
Railway:

```bash
openssl rand -base64 32   # SESSION_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY
```

Trocar a `ENCRYPTION_KEY` invalida os tokens de sobreposição já cifrados no
banco.

## Deploy no Railway

Espelha a seção 3.3 da especificação. Os passos 1 a 4 podem ser feitos antes de
existir código; os demais exigem `package.json` com `start:web` e
`start:worker`, senão o build falha.

1. **Criar o projeto.** New Project → Empty Project, renomear para `oa12-msg`.
2. **Adicionar o Postgres.** + Create → Database → Add PostgreSQL, renomear o
   serviço para `postgres` — é esse nome que `${{postgres.DATABASE_URL}}` usa.
3. **Gerar as chaves** (comandos acima) e guardar no gerenciador de senhas.
4. **Cadastrar as variáveis compartilhadas.** Project Settings → Shared
   Variables: `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET`, `ENCRYPTION_KEY`.
5. **Criar o serviço `web`.** + Create → GitHub Repo → `oamsg`, renomear para
   `web`, start command `npm run start:web`, health check path `/health`.
6. **Criar o serviço `worker`.** Duplicar o serviço `web` pelo botão direito —
   adicionar o mesmo repositório duas vezes pelo canvas costuma não funcionar.
   Renomear para `worker`, start command `npm run start:worker`, **remover o
   health check** e **fixar as réplicas em 1**.
7. **Watch paths** nos dois serviços, se o código ficar separado em pastas —
   assim uma mudança só na interface não reinicia o dispatcher no meio de uma
   publicação.
8. **Distribuir as variáveis.** Em cada serviço, inserir as compartilhadas pelo
   botão de variável compartilhada e acrescentar as específicas. Usar sempre
   referência (`${{postgres.DATABASE_URL}}`), nunca a string copiada.
9. **Migrações** no build/release, nunca no start, para não competirem entre
   réplicas.

Alterar variável dispara redeploy — evite fazê-lo perto de um horário de
publicação.

### DNS na HostGator

1. No serviço `web`: Settings → Networking → Custom Domain → `msg.oa12.org`. O
   Railway devolve um destino CNAME.
2. No cPanel, Zone Editor de `oa12.org`: registro CNAME com nome `msg` e o valor
   fornecido.
3. A propagação leva de minutos a algumas horas; o certificado TLS é emitido
   quando o DNS resolve.

### Verificação final

- `https://msg.oa12.org/health` responde.
- O log do `worker` mostra o ciclo de 5 minutos acontecendo.
- O `postgres` tem as tabelas criadas pela migração.
- O botão "testar conexão" de uma pasta publica no grupo correto.
- Um alerta de teste chega ao grupo de alertas (quando o `chat_id` estiver
  cadastrado).

## Telegram

O bot `@OAmsg_bot` precisa ser membro de cada grupo de destino e do grupo de
alertas. Promova os grupos comuns a **supergroup antes** de anotar o `chat_id`:
o número muda na promoção e a publicação passa a falhar com `chat not found`. O
`chat_id` de cada pasta e o destino dos alertas são configurados pela interface
— nada fica fixo no código. O procedimento de levantamento dos `chat_id` está no
anexo da especificação.

## Testes

> A partir da fase 1.

```bash
npm test
```

Cobertura obrigatória: isolamento entre organizações (inclusive a rota de
imagem), idempotência do dispatcher, limites de 4096/1024 caracteres e
precedência do destino dos alertas.

## Fases

| Fase | Conteúdo | Situação |
| :-- | :-- | :-- |
| 0 | Modelo de dados, permissões, mockup, escolha do framework | **aprovada** |
| 1 | Railway, autenticação, organizações, usuários, permissões, isolamento testado | — |
| 2 | Pastas, textos, imagens, importação CSV/XLSX, reordenação | — |
| 3 | Agendamentos, dispatcher, Telegram, idempotência testada, alertas e configurações globais | — |
| 4 | Painel, i18n, auditoria, polimento visual | — |
