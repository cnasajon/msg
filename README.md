# msg

Aplicação web multi-organização para publicação programada de textos e imagens
em grupos de Telegram. Domínio: `msg.oa12.org`. Bot: `@OAmsg_bot`.

O nome da aplicação é **msg** — genérico de propósito, para servir a outros usos
além da OA. O repositório é `cnasajon/msg`; o bot continua `@OAmsg_bot`, porque
o username de um bot não se troca sem criar outro no BotFather.

Especificação completa: [`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md) (v1.5).
Regras de trabalho para sessões do Claude Code: [`CLAUDE.md`](CLAUDE.md).

> **Situação: fase 1 entregue.** Autenticação, organizações, usuários,
> permissões e o isolamento entre organizações testado. As telas das fases 2 a 4
> existem e avisam em que fase chegam.

## O que já existe

| Caminho | Conteúdo |
| :-- | :-- |
| `docs/ESPECIFICACAO.md` | Especificação funcional e técnica |
| `docs/FASE0.md` | Entrega da fase 0 e as decisões aprovadas |
| `prisma/schema.prisma` | Modelo de dados com índices e restrições únicas |
| `src/lib/escopo.ts` | **Isolamento entre organizações** — o filtro por onde passa toda consulta |
| `src/lib/autorizacao.ts` | Matriz de permissões da seção 6 |
| `src/app/` | Interface e server actions (Next.js App Router) |
| `src/worker/` | Serviço `worker`; o dispatcher entra na fase 3 |
| `tests/` | Isolamento, permissões, autenticação e rotas HTTP |
| `docs/mockup/` | Mockup navegável em HTML estático, sem build |
| `docs/mockup/assets/logo.svg` | Logomarca (símbolo + wordmark) e `mark.svg`, só o símbolo |
| `CLAUDE.md` | Regras de trabalho e pontos não negociáveis |

### Abrir o mockup

Sem build e sem dependência: abra `docs/mockup/index.html` no navegador depois
de um `git pull` da branch. Trabalhando pela nuvem, também dá para colar a URL
do arquivo no GitHub em `htmlpreview.github.io` — o GitHub não renderiza HTML do
repositório, mostra o código-fonte.

A entrada é `home.html`, com quatro blocos: Painel de controle, Textos,
Configuração (admin e superadmin) e Sistema (só superadmin). O seletor **Ver
como** e o botão de tema ficam na mesma linha do cabeçalho e valem para todas as
telas. O **tema escuro é o padrão**.

## Arquitetura

Um projeto no Railway chamado `msg`, com três serviços e um repositório só:

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

Precisa de Node.js 22 e um PostgreSQL 16.

```bash
git clone git@github.com:cnasajon/msg.git
cd msg
npm install
cp .env.example .env      # preencher com valores locais; .env nunca é versionado
npx prisma migrate dev    # cria o banco e gera o cliente
npm run dev               # interface em http://localhost:3000
npm run dev:worker        # serviço worker, em outro terminal
```

### Primeiro superadmin

Não há cadastro público, e o primeiro superadmin é o único usuário que não é
criado por outro. A senha provisória é gerada pelo comando e aparece **uma única
vez** — não é lida de variável de ambiente nem de argumento, para não ficar no
histórico do shell:

```bash
npm run criar-superadmin -- "Seu Nome" voce@exemplo.org
```

Entre com ela; a troca é obrigatória no primeiro acesso. A partir daí: crie a
organização em **Sistema → Organizações**, escolha-a no seletor do topo e crie
os usuários dela em **Configuração → Usuários**.

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

1. **Criar o projeto.** New Project → Empty Project, renomear para `msg`.
2. **Adicionar o Postgres.** + Create → Database → Add PostgreSQL, renomear o
   serviço para `postgres` — é esse nome que `${{postgres.DATABASE_URL}}` usa.
3. **Gerar as chaves** (comandos acima) e guardar no gerenciador de senhas.
4. **Cadastrar as variáveis compartilhadas.** Project Settings → Shared
   Variables: `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET`, `ENCRYPTION_KEY`.
5. **Criar o serviço `web`.** + Create → GitHub Repo → `msg`, renomear para
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

```bash
npm test                                   # unidade; integração se houver banco
TEST_DATABASE_URL=postgresql://… npm test  # inclui os testes com banco real
TEST_DATABASE_URL=postgresql://… npm run test:http   # isolamento nas rotas HTTP
npm run typecheck
```

Sem `TEST_DATABASE_URL` os testes de integração se pulam sozinhos, e só os de
unidade rodam. Use um banco separado: eles truncam as tabelas.

### Sobre os avisos do `npm audit`

Sobram três avisos, todos na CLI do Prisma (`prisma` → `@prisma/config` →
`deepmerge-ts`), que é dependência de desenvolvimento e não vai para o runtime —
`@prisma/client`, esse sim usado em produção, não está afetado. Não há versão
estável corrigida: a correção está na linha 8.x do Prisma, ainda em release
candidate. Rever quando o Prisma 8 sair como estável.

Se o `npm install` avisar que há scripts de instalação não aprovados
(`npm warn install-scripts`), aprove-os antes de seguir — o Prisma depende do
`postinstall` para preparar seus binários:

```bash
npm install-scripts approve prisma @prisma/client @prisma/engines esbuild fsevents
npm install
```

O que já está coberto: **isolamento entre organizações** na camada de dados e
nas rotas HTTP (inclusive a leitura de imagem), a matriz de permissões linha a
linha, senha com argon2id e o limite de tentativas de login. Falta cobrir, nas
fases seguintes: idempotência do dispatcher, limites de 4096/1024 caracteres e
precedência do destino dos alertas.

## Fases

| Fase | Conteúdo | Situação |
| :-- | :-- | :-- |
| 0 | Modelo de dados, permissões, mockup, escolha do framework | **aprovada** |
| 1 | Railway, autenticação, organizações, usuários, permissões, isolamento testado | **entregue** |
| 2 | Pastas, textos, imagens, importação CSV/XLSX, reordenação | — |
| 3 | Agendamentos, dispatcher, Telegram, idempotência testada, alertas e configurações globais | — |
| 4 | Painel, i18n, auditoria, polimento visual | — |

## Decisões de segurança que valem registro

- **O isolamento vive em `src/lib/escopo.ts`.** Toda consulta parte do escopo da
  sessão; identificador vindo da URL só é usado depois de resolvido contra ele.
  Recurso de outra organização responde **404, nunca 403** — 403 confirmaria que
  aquele identificador existe.
- **Sair é POST com CSRF, não link GET.** Um GET que encerra sessão é derrubado
  pelo próprio navegador: o Next busca os links antes do clique, e a sessão
  morria sozinha no prefetch.
- **O cookie de sessão é `Secure` conforme o esquema de `APP_URL`**, não conforme
  o `NODE_ENV`. Marcar `Secure` em `http://localhost` faz o navegador tratar o
  envio como exceção e nem sempre devolver o cookie.
- **A validade da sessão é do banco**, não do cookie: renová-la a cada uso não
  pode depender de reescrever cookie, porque só server action e route handler
  podem fazer isso.
- **Senha provisória aparece uma vez só**, na tela de quem a criou. Só o hash
  argon2id é guardado.
- **Nenhum segredo em log, mensagem de erro ou auditoria** — a auditoria
  registra que um valor mudou, nunca o valor.
