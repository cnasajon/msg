# msg

Aplicação web multi-organização para publicação programada de textos e imagens
em grupos de Telegram. Domínio: `msg.oa12.org`. Bot: `@OAmsg_bot`.

O nome da aplicação é **msg** — genérico de propósito, para servir a outros usos
além da OA. O repositório é `cnasajon/msg`; o bot continua `@OAmsg_bot`, porque
o username de um bot não se troca sem criar outro no BotFather.

Especificação completa: [`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md) (v1.5).
Regras de trabalho para sessões do Claude Code: [`CLAUDE.md`](CLAUDE.md).

> **Situação: fase 4 entregue — o sistema está completo.** Painel inicial com a
> próxima publicação e as últimas que saíram, interface em português, espanhol e
> inglês, tela de auditoria com filtros e paginação. As fases anteriores
> continuam valendo: isolamento entre organizações, textos com imagem,
> importação e exportação, agendamentos e o dispatcher idempotente no serviço
> `worker`.

## O que já existe

| Caminho | Conteúdo |
| :-- | :-- |
| `docs/ESPECIFICACAO.md` | Especificação funcional e técnica |
| `docs/FASE0.md` | Entrega da fase 0 e as decisões aprovadas |
| `prisma/schema.prisma` | Modelo de dados com índices e restrições únicas |
| `src/lib/escopo.ts` | **Isolamento entre organizações** — o filtro por onde passa toda consulta |
| `src/lib/usuario.ts` | Regras do nome de usuário, a credencial de entrada |
| `src/lib/mover.ts` | Mover textos entre pastas, com o escopo dos dois lados |
| `src/lib/data-da-publicacao.ts` | O padrão `dia/mês/ano` das listas por data |
| `src/lib/proximo-texto.ts` | Qual texto sai em cada slot, por fila ou por data |
| `src/lib/autorizacao.ts` | Matriz de permissões da seção 6 |
| `src/app/` | Interface e server actions (Next.js App Router) |
| `src/lib/textos.ts` | Os dois limites (4096/1024), tags aceitas e hash de duplicata |
| `src/lib/imagem.ts` | Processamento das imagens com `sharp` antes de irem para o `bytea` |
| `src/lib/telegram.ts` | Bot API sem biblioteca intermediária, com os envios serializados |
| `src/lib/cifra.ts` | AES-256-GCM do token de sobreposição da pasta |
| `src/lib/agenda.ts` | Cálculo dos slots no fuso da pasta, com as viradas de horário de verão |
| `src/lib/dispatcher.ts` | **Reivindicação do slot antes do envio** — o que garante a idempotência |
| `src/lib/alertas.ts` | Alertas com a precedência `settings` → ambiente → log e painel |
| `src/lib/avisos.ts` | As validações devolvem **chave e valores**, não frase pronta |
| `src/lib/mensagens.ts` | Tradução fora do next-intl, para o `worker`, que não tem sessão |
| `src/i18n/` | Resolução do idioma da interface e as constantes de idioma |
| `messages/` | `pt.json`, `es.json`, `en.json` — todos os textos da interface |
| `src/worker/` | Serviço `worker`, onde o dispatcher roda |
| `tests/` | Isolamento, permissões, autenticação, rotas HTTP e integridade das traduções |
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
npm run criar-superadmin -- "Seu Nome" seuusuario
```

O terceiro argumento é o e-mail e é opcional — a entrada é pelo nome de usuário.
Entre com ele e com a senha; a troca é obrigatória no primeiro acesso. A partir daí: crie a
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
   réplicas. No Railway isso é o campo **Pre-Deploy Command** do serviço, com
   `npm run migrate:deploy`. Se o seu plano não tiver esse campo, rode a
   migração manualmente a cada deploy que mude o schema — não a coloque no start
   command.

   **Sem isso o sintoma engana:** o serviço sobe, e é só ao usar o sistema que
   ele quebra, porque o banco não tem as colunas que o código espera. O
   `/health` responde **503 com a lista de migrações pendentes**, e a tela de
   entrada diz que o banco está atrás da versão em vez de mostrar uma falha
   genérica — mas quem resolve continua sendo o `migrate:deploy`.

O `package.json` traz um script `start` apontando para `start:web`: o builder do
Railway (Railpack) exige esse script e falha no *prepare* sem ele, mesmo quando o
serviço define um Custom Start Command. Cada serviço continua subindo pelo seu
comando próprio — `npm run start:web` no `web`, `npm run start:worker` no
`worker`.

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

- `https://msg.oa12.org/health` responde **`{"ok":true, …, "migracoes":"em dia"}`**.
  Se vier `503` com `"migracoes":"pendentes"`, o banco está atrás do código: a
  resposta lista quais faltam e o comando (`npm run migrate:deploy`).
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
nas rotas HTTP — inclusive a rota de imagem, onde um admin pedindo a imagem de
outra organização recebe 404 e zero byte —, a matriz de permissões linha a
linha, senha com argon2id e limite de tentativas, **os dois limites de 4096 e
1024 caracteres**, as tags aceitas pelo Telegram, o hash de duplicata, as datas
da importação, a cifra do token de sobreposição, os cinco formatos de exportação,
**a idempotência do dispatcher** (dois e quatro ciclos em paralelo publicam uma
vez só) e **a precedência do destino dos alertas**, inclusive com o banco fora do
ar. O **mover entre pastas** tem teste nas duas direções — não deixar sair para
outra organização e não deixar entrar de outra — e no caso do conteúdo repetido
no destino. As **listas por data** têm teste do padrão (inclusive a data que
nunca aconteceria), do revezamento entre textos do mesmo dia, da repetição que a
fila não faria, e do dispatcher: sem texto para a data não é erro, e dois ciclos
no mesmo slot continuam publicando uma vez só.

O cálculo dos slots é testado nas duas viradas de horário de verão: a hora que
não existe resolve para depois da virada, e a que acontece duas vezes resolve
para a primeira ocorrência, sempre igual.

As traduções também têm teste: paridade de chaves entre os três idiomas, nenhuma
chave usada no código sem tradução correspondente e nenhum grupo de mensagens
usado no navegador fora da lista que vai para o cliente.

## Fases

| Fase | Conteúdo | Situação |
| :-- | :-- | :-- |
| 0 | Modelo de dados, permissões, mockup, escolha do framework | **aprovada** |
| 1 | Railway, autenticação, organizações, usuários, permissões, isolamento testado | **entregue** |
| 2 | Pastas, textos, imagens, importação CSV/XLSX, exportação, reordenação | **entregue** |
| 3 | Agendamentos, dispatcher, Telegram, idempotência testada, alertas e configurações globais | **entregue** |
| 4 | Painel, i18n, auditoria, polimento visual | **entregue** |

## Como a publicação acontece

1. O `worker` acorda a cada `DISPATCH_INTERVAL_MINUTES` (5 por padrão).
2. Para cada pasta ativa com `chat_id`, calcula os slots vencidos **no fuso da
   pasta**, dentro da tolerância de `DISPATCH_GRACE_MINUTES` (30).
3. Para cada slot, **grava a reivindicação em `publications` antes de falar com
   o Telegram**. Se outro processo já tiver gravado, a restrição única
   `(folder_id, data_prevista, hora_prevista)` rejeita, e este desiste em
   silêncio — é isso que impede publicação dupla em deploys sobrepostos,
   restart ou réplica a mais.
4. Escolhe o texto conforme o **tipo da lista** (abaixo). Com imagem vai por
   `sendPhoto` (texto como legenda); sem imagem, por `sendMessage`.
5. Sucesso: publicação marcada como enviada, com `telegram_message_id` e cópia do
   conteúdo; texto marcado como publicado.
6. Falha: até 3 tentativas com espera crescente. Esgotadas, publicação e texto
   ficam com erro, sai alerta e **a fila não avança** — o mesmo texto continua
   sendo o próximo.
7. Slot vencido além da tolerância vira `perdida` e **nunca é publicado com
   atraso**.

Ao esgotar a fila, vale o que estiver configurado na pasta: *parar e notificar*
registra a publicação sem texto e alerta; *reiniciar* devolve todos os textos a
pendente, preservando a ordem, e publica o primeiro, com o evento na auditoria.

O **aviso de fila curta** também é de cada pasta, e tem duas partes: uma chave
que liga e desliga, e o número — *Avisar com menos de* — que diz com quantos
textos pendentes o alerta sai para os administradores. Só a chave desliga, para
que o número sobreviva a um período de silêncio e volte como estava. Os dois
ficam na configuração da pasta e também na tela **Alertas**, onde cada pasta tem
sua chave e seu mínimo editáveis na própria linha. Só vale para lista baseada em
fila — em lista por data não há fila que acabe.

Desligar silencia **apenas o aviso de fila curta** daquela pasta. Falha de
publicação, slot perdido e fila esgotada continuam alertando.

## Tipo de lista: por fila ou por data

Cada pasta escolhe como seleciona o texto de cada slot. Nos dois casos o
agendamento manda no *quando*: **só há publicação nos dias da semana marcados**.
Sem nenhum dia marcado, não existe slot e nada sai.

**Baseada em fila** — o padrão, e como o sistema sempre funcionou. Sai o próximo
texto ainda não publicado, na ordem da fila. Publicar tira o texto do caminho, e
ao esgotar vale o comportamento configurado na pasta.

**Baseada em data** — cada texto carrega um `dia/mês/ano`, com `*` valendo para
"todos":

| Padrão | Quando sai |
| :-- | :-- |
| `25/12/*` | todo dia 25 de dezembro, em qualquer ano |
| `*/09/*` | em todos os dias de setembro que estiverem marcados |
| `01/01/2027` | uma vez só, em 1º de janeiro de 2027 |
| `*/*/*` | em qualquer data marcada |

Três diferenças que valem registro:

- **A situação do texto não tira ele do caminho**, tirando `arquivado`. Numa
  lista por data o mesmo texto sai sempre que a data casar — é o que "todos os
  dias de setembro" quer dizer —, então ficar `publicado` não pode escondê-lo,
  como esconde na fila.
- **Com mais de um texto para o mesmo dia, eles se revezam:** sai quem está há
  mais tempo sem sair, e quem nunca saiu vem antes de todos; a ordem desempata.
  Sem isso o primeiro deles ocuparia todos os slots e os outros nunca
  apareceriam.
- **Não haver texto para a data não é erro.** O slot fica registrado como
  `sem texto para a data`, para não ser tentado de novo nem virar "perdido", e
  ninguém é alertado: o slot existe porque o dia da semana está marcado, e
  simplesmente não havia nada agendado. Pelo mesmo motivo, o aviso de fila curta
  não vale para estas pastas.

Uma data que nunca aconteceria, como `31/02/*`, é recusada na hora de escrever —
o texto ficaria esperando para sempre. `29/02` continua valendo, porque ano
bissexto existe.

## Entrada e senha esquecida

A credencial de entrada é o **nome de usuário**, não o e-mail: minúsculas, de 3
a 32 caracteres, com números, ponto, hífen e sublinhado, começando e terminando
por letra ou número. Sem espaço e sem acento, porque `josé` e `jose` seriam duas
contas para o banco e a mesma pessoa para quem olha.

O e-mail deixou de ser o login justamente porque o sistema não envia e-mail
nenhum — ele não provava nada sobre quem entrava. Virou um campo cadastral como
o telefone e o Telegram: opcional, único quando preenchido, e serve para
localizar a pessoa.

**Quem esquece a senha** clica em *Esqueci a senha* na tela de entrada e informa
o usuário. O pedido não entrega nada a quem o fez: ele avisa os administradores
pelo grupo de alertas do Telegram e pelo painel, e um deles redefine em
**Configuração → Usuários** e repassa a provisória. A resposta da tela é sempre a
mesma, exista a conta ou não — um formulário público que responde "este usuário
não existe" é um descobridor de contas cadastradas. O limite de pedidos é
separado do limite de tentativas de login, senão bastaria pedir a senha de
alguém repetidamente para trancar essa pessoa do lado de fora.

## Mover textos entre pastas

Admin e superadmin escolhem um ou mais textos na lista e movem para outra pasta;
eles entram no fim da fila do destino, preservando a ordem relativa. O perfil
`usuario` não move: ele só enxerga as pastas atribuídas a ele, e mover dali seria
tirar o texto do próprio alcance.

Duas coisas passam pelo escopo, não uma: a pasta de destino e cada texto
escolhido. A lista de identificadores vem do navegador, e sem o segundo filtro
bastaria injetar o id de um texto de outra organização no formulário para
arrastá-lo para dentro da sua — há teste para as duas direções.

Como o par (pasta, conteúdo) é único no banco, um texto idêntico a algum que o
destino já tenha é **pulado**, e a faixa diz quantos foram — em vez de o lote
inteiro falhar por causa de um repetido.

## Idiomas

A interface fala **português, espanhol e inglês**, e o idioma vem de quem está
olhando, não do endereço: não há `/pt/` nem `/en/` na URL. A ordem é

1. a preferência gravada no usuário (**Configuração → Usuários**);
2. senão o idioma padrão da organização (**Sistema → Organizações**);
3. senão o cookie escolhido no seletor do cabeçalho — é ele que faz a tela de
   entrada aparecer no idioma certo antes de existir sessão;
4. senão português.

Assim um link enviado por um admin brasileiro abre em espanhol para quem é da OA
España, sem ninguém trocar nada.

Os textos ficam em `messages/pt.json`, `es.json` e `en.json`, um grupo por tela.
Três testes cuidam da integridade: as três línguas têm exatamente as mesmas
chaves, nenhuma chave usada no código está sem tradução, e nenhum grupo usado por
componente de navegador ficou de fora da lista que o layout entrega ao cliente —
o provedor do next-intl serializa na página tudo que recebe, então a tela inicial
de um usuário comum não carrega os rótulos das telas de sistema.

As mensagens de erro e de confirmação seguem o mesmo caminho: as funções de
validação devolvem chave e valores, e quem monta a frase é a ação de servidor,
que sabe o idioma de quem pediu. O `worker` não tem sessão nem requisição —
quando ele grava o erro de uma publicação ou o texto de um alerta, usa o idioma
padrão da organização daquela pasta, que é quem vai ler no histórico e no painel.

Datas e horas saem na ordem do idioma (14/09 em português e espanhol, 9/14 em
inglês), sempre no fuso da pasta e com a sigla do fuso ao lado.

**O que continua em português:** o conteúdo dos arquivos de exportação (os
cabeçalhos das colunas em PDF, XLSX, CSV, JSON e XML) e o texto dos comentários
do código. Os textos publicados são de quem os escreveu — o sistema não traduz
conteúdo.

## Alertas

Destino, nesta ordem: o campo em **Configurações globais**, senão a variável
`ALERTS_CHAT_ID`, senão apenas o log e o painel de alertas. A variável é o
destino garantido — continua funcionando quando o próprio banco está
inacessível, que é quando o alerta mais importa. Os dois podem ficar vazios sem
quebrar o deploy. A falha de um canal nunca interrompe a publicação nem gera
novo alerta.

## Política de senha

Mínimo de 8 caracteres, com pelo menos uma letra maiúscula, um número e um
caractere especial. A mensagem de recusa diz tudo que falta de uma vez — corrigir
senha aos pedaços é o caminho mais curto para a pessoa desistir e escolher algo
pior. As senhas provisórias geradas pelo sistema já nascem dentro da política.

## Bibliotecas de planilha

A especificação cita SheetJS para CSV e XLSX. A versão publicada no npm está
parada na 0.18.5, com vulnerabilidades conhecidas — as versões novas saíram do
registro público. O projeto usa **`exceljs`** (mantido no npm) para XLSX e
**`papaparse`** para CSV; a exportação em PDF usa **`pdfkit`**. O `npm audit`
acusa um aviso moderado em `uuid`, dependência do `exceljs`, referente a APIs de
UUID v3/v5/v6 que não são usadas aqui.

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
  registra que um valor mudou, nunca o valor. O token de sobreposição da pasta é
  cifrado com AES-256-GCM, conferido no Telegram antes de ser gravado e nunca
  reexibido.
- **O formato da imagem vem do conteúdo do arquivo**, não da extensão nem do
  MIME que o navegador declarou. Metadados EXIF são descartados no
  processamento.
- **A rota de imagem não tem atalho**: o identificador da URL passa pelo mesmo
  escopo das outras consultas, e imagem de outra organização responde 404 com
  zero byte — há teste para isso.
- **A exportação respeita o escopo**: quem enxerga duas pastas exporta duas
  pastas, qualquer que seja o identificador na URL.
