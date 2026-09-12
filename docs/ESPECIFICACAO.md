# Especificação da aplicação msg

**Domínio:** msg.oa12.org
**Repositório:** https://github.com/cnasajon/msg (privado)
**Projeto no Railway:** `msg` — id `656b5e1d-4133-4d5f-80a0-215a493a537e`
**Bot do Telegram:** @OAmsg_bot
**Versão do documento:** 1.5 — 12/09/2026

Mudanças em relação à 1.4: incorpora as decisões tomadas na aprovação da fase 0 e o que a fase 1 entregou. São elas: quarto estado do texto (`arquivado`), com exclusão mantida para casos excepcionais; exportação dos textos em cinco formatos; importação de histórico por coluna de data de publicação; telefone e usuário do Telegram no cadastro de pessoas; tela inicial de quatro blocos e tema escuro como padrão; framework decidido (Next.js com server actions); dias da semana por sigla; e os campos que o modelo de dados ganhou para sustentar tudo isso.

Histórico: 1.1 fechou banco, bot único, imagens na v1 e alertas por Telegram. 1.2 tornou o destino dos alertas híbrido. 1.3 acrescentou o roteiro de configuração completo. 1.4 unificou a nomenclatura em `msg` e registrou o estado da infraestrutura.

---

## 1. Objetivo

Aplicação web para publicação programada de textos em grupos de Telegram. Cada organização (OA Brasil, OA España, OA English e futuras) opera de forma independente, com suas próprias pastas de textos, seus grupos de Telegram e seus usuários. No dia e horário configurados para cada pasta, o sistema publica o próximo texto da fila daquela pasta no grupo correspondente e registra a data-hora da publicação.

---

## 2. Arquitetura no Railway

### 2.1 Estrutura do projeto

Um único projeto no Railway chamado `msg`, com três serviços e um repositório só — os dois serviços de aplicação apontam para o mesmo repo com comandos de start diferentes.

| Serviço | Função | Origem | Comando de start |
|---|---|---|---|
| `web` | Interface e API | repo `cnasajon/msg` | `npm run start:web` |
| `worker` | Dispatcher de publicações | repo `cnasajon/msg` | `npm run start:worker` |
| `postgres` | Banco de dados | plugin gerenciado do Railway | — |

Por que dois serviços e não um: se o agendador rodar dentro do processo web, cada deploy ou escalonamento horizontal cria uma segunda instância do agendador, e você passa a ter publicações duplicadas. Separando, o `worker` fica fixo em uma réplica e o `web` pode escalar livremente. A trava de idempotência no banco (seção 7.2) é a segunda camada de proteção.

**Banco: Postgres gerenciado do Railway.** Decidido — mantém tudo em um projeto, com acesso pela rede privada interna e uma única conta. As imagens são guardadas no próprio banco (seção 9), o que dispensa serviço de armazenamento externo e volume do Railway. Atenção a uma limitação relevante: volumes do Railway só podem ser montados em um serviço por vez, e tanto o `web` (upload) quanto o `worker` (publicação) precisam das imagens — guardar no banco resolve isso de forma limpa.

### 2.2 Variáveis de ambiente

No serviço `web`:

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

No serviço `worker`: as mesmas, mais

```
DISPATCH_INTERVAL_MINUTES=5
DISPATCH_GRACE_MINUTES=30
ALERTS_CHAT_ID=<pode começar vazio>
GOOGLE_CHAT_WEBHOOK=<opcional; se vazio, alerta só pelo Telegram>
```

Regras: `TZ=UTC` em todos os serviços — o fuso horário de agendamento e de exibição é sempre o da pasta, convertido na aplicação. `SESSION_SECRET` e `ENCRYPTION_KEY` gerados uma única vez e guardados no gerenciador de senhas; trocar a `ENCRYPTION_KEY` invalida os tokens de sobreposição cifrados no banco. Nenhum segredo no repositório: `.env` no `.gitignore`, valores cadastrados apenas no painel do Railway.

### 2.3 Custo estimado

Plano Hobby ou Pro do Railway: `web` e `worker` são serviços leves, o Postgres é pequeno. A ordem de grandeza esperada é de dezenas de reais por mês. Guardar imagens no banco aumenta o consumo de armazenamento — com o limite de 2 MB por imagem e algumas centenas de textos com foto, o impacto continua pequeno, mas vale acompanhar.

---

## 3. Roteiro de configuração

### 3.0 Estado atual (12/09/2026)

Concluído:

- Repositório `cnasajon/msg` criado, privado, com `docs/ESPECIFICACAO.md` na branch `main`.
- Claude Code na nuvem conectado ao repositório, trabalhando a partir da `main`.
- Bot `@OAmsg_bot` criado, com descrição trilíngue, avatar e modo de privacidade em Enabled. Token guardado no gerenciador de senhas.
- Envio testado com sucesso no grupo "Uma Visão Para Você".
- Projeto `msg` criado no Railway, serviço `postgres` Online.
- `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET` e `ENCRYPTION_KEY` cadastrados como variáveis compartilhadas do projeto. Ainda não distribuídas a nenhum serviço, porque `web` e `worker` só existem na fase 1.

Também concluído, na fase 1:

- Fases 0 e 1 entregues e mescladas na `main`: modelo de dados, matriz de permissões, mockup, autenticação, organizações, usuários e o isolamento entre organizações coberto por testes.
- `package.json` com os scripts `start:web` e `start:worker`, o que destrava os passos 5 a 9 de 3.3.

Pendente: passos 5 a 9 de 3.3, o DNS de 3.4 e o levantamento dos `chat_id` restantes de 3.2.

### 3.1 Claude Code

**Decisão: trabalhar com o Claude Code na nuvem** (`claude.ai/code` ou aba Code no app), para não ocupar a máquina local e poder acompanhar sessões longas pelo celular.

A autorização do GitHub é feita uma vez, pelo fluxo de conexão no navegador (autorizando o Claude GitHub App) ou por `/web-setup` no terminal, que sincroniza o token do `gh` com a conta Claude. Depois basta selecionar o repositório e a branch nos chips abaixo do campo de mensagem. Escopo a ter em mente: com qualquer um dos dois métodos, a sessão na nuvem alcança qualquer repositório que a conta conectada consiga ver.

**Como visualizar o mockup da fase 0 trabalhando na nuvem.** O GitHub não renderiza HTML de dentro do repositório — mostra o código-fonte. Três saídas, em ordem de simplicidade:

1. Colar a URL do arquivo na branch em `htmlpreview.github.io`.
2. A partir da fase 1, usar um ambiente de preview do Railway apontado para a branch.
3. Dar `git pull` da branch na máquina e abrir o arquivo no navegador — sem precisar rodar o Claude Code localmente.

### 3.2 Telegram

Concluído conforme 3.0. Pendente, e sem urgência, porque o `chat_id` de cada pasta e o destino dos alertas são configuráveis pela interface:

1. Criar o grupo de alertas, só com os superadmins.
2. Adicionar `@OAmsg_bot` a cada grupo de destino e ao grupo de alertas.
3. Promover a supergroup os grupos que ainda forem grupo comum, **antes** de anotar o `chat_id`: tornar público e voltar a privado força a promoção. Grupo comum tem `chat_id` que muda ao ser promovido, e a publicação passa a falhar com `chat not found`.
4. Enviar `/start@OAmsg_bot` em cada grupo e levantar os `chat_id` com o comando do anexo.
5. Testar o envio em cada um com `sendMessage` antes de cadastrar.

### 3.3 Railway

**Passos 1 a 4 já concluídos. Os demais exigem `package.json` com os scripts `start:web` e `start:worker`, senão o build falha.**

1. **Criar o projeto.** New Project → Empty Project, renomeado para `msg`. Começar vazio, em vez de partir do repositório, para controlar a ordem de criação dos serviços.
2. **Adicionar o Postgres.** No canvas, + Create → Database → Add PostgreSQL. O serviço precisa se chamar `postgres` — é esse nome que a referência `${{postgres.DATABASE_URL}}` usa.
3. **Gerar as chaves.** `openssl rand -base64 32` duas vezes, uma para `SESSION_SECRET` e outra para `ENCRYPTION_KEY`, guardadas no gerenciador de senhas.
4. **Cadastrar as variáveis compartilhadas.** Project Settings → Shared Variables, ambiente `production`, com `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET` e `ENCRYPTION_KEY`. Ficam definidas uma vez para todos os serviços que precisarem, o que evita colar o mesmo valor em vários lugares e um deles sair de sincronia. Nesta etapa elas ainda não estão em nenhum serviço — o botão "Share" de cada variável é usado no passo 8.
5. **Criar o serviço `web`.** No canvas, + Create → GitHub Repo → `cnasajon/msg`. Renomear para `web` (o Railway sorteia um nome aleatório na criação). Em Settings → Deploy, definir o start command `npm run start:web` e o health check path `/health`.
6. **Criar o serviço `worker`.** Clicar com o botão direito no serviço `web` e duplicar — adicionar o mesmo repositório duas vezes pelo canvas costuma não funcionar. No serviço novo: renomear para `worker`, trocar o start command para `npm run start:worker`, **remover o health check** (não tem porta HTTP) e **fixar as réplicas em 1**. Esta última parte não é opcional: duas réplicas do worker é exatamente o cenário que a idempotência existe para conter, e não convém depender só dela.
7. **Configurar watch paths** nos dois serviços, se o código ficar separado em pastas. São padrões no estilo gitignore que disparam deploy conforme os caminhos alterados — assim uma mudança só na interface não reinicia o dispatcher no meio de uma publicação.
8. **Distribuir as variáveis.** Compartilhar as três variáveis do projeto com `web` e `worker`, e acrescentar em cada serviço as específicas da seção 2.2. Usar sempre referência (`${{postgres.DATABASE_URL}}`), nunca a string copiada — se o Railway rotacionar a credencial do banco, os serviços acompanham sozinhos.
9. **Migrações.** Rodar no build/release, não no start, para não competirem entre réplicas.

Observações operacionais: alterar variável dispara redeploy automático do serviço — evitar fazê-lo perto de um horário de publicação. A opção **sealed variable** deixa o valor invisível no painel após salvo, boa prática para o token, mas só marcar com a cópia já no gerenciador de senhas, porque não há leitura de volta. Em caso de suspeita de vazamento do token, `/revoke` no @BotFather emite outro e invalida o antigo; basta atualizar a variável compartilhada.

Se um serviço vazio for criado por engano no canvas (o Railway sugere um nome aleatório antes de conectar a origem), descartar a alteração pendente pelo menu de três pontos ao lado do botão Deploy, em vez de fazer o deploy de um serviço sem repositório.

### 3.4 DNS na HostGator

1. No serviço `web` do Railway, Settings → Networking → Custom Domain, informar `msg.oa12.org`. O Railway devolve um destino CNAME.
2. No cPanel da HostGator, Zone Editor do domínio `oa12.org`, adicionar registro CNAME com nome `msg` e valor o destino fornecido.
3. A propagação leva de minutos a algumas horas. O certificado TLS é emitido automaticamente quando o DNS resolve.

### 3.5 Verificação final

- `https://msg.oa12.org/health` responde.
- O log do `worker` mostra o ciclo de 5 minutos acontecendo.
- O `postgres` tem as tabelas criadas pela migração.
- O botão "testar conexão" de uma pasta publica no grupo correto.
- Um alerta de teste chega ao grupo de alertas (quando o `chat_id` estiver cadastrado).

---

## 4. Stack

- **Runtime:** Node.js 22 + TypeScript
- **Framework web:** **Next.js (App Router) com server actions** — decidido na fase 0. Uma aplicação só cobre interface, ações e as rotas servidas pelo Node, com destaque para a rota de imagem autenticada, que lê `bytea` e responde o binário sob a mesma verificação de organização da interface. O dispatcher vive fora do framework, no serviço `worker`.
- **Banco:** PostgreSQL 16 gerenciado pelo Railway
- **ORM e migrações:** Prisma
- **Agendamento:** `node-cron` dentro do serviço `worker`, com trava de idempotência no banco
- **Planilhas:** `xlsx` (SheetJS) para importação de CSV e XLSX
- **Imagens:** `sharp` para validação e redimensionamento no upload
- **Telegram:** Bot API via `fetch`, sem biblioteca intermediária
- **Alertas operacionais:** mensagens ao grupo de administradores no Telegram, pela mesma integração, e opcionalmente um webhook do Google Chat. Sem provedor de e-mail e sem credencial adicional.
- **Estilo:** Tailwind CSS
- **i18n:** `next-intl` ou equivalente, com PT, ES e EN
- **Senhas:** argon2id
- **Testes:** Vitest, com cobertura obrigatória do isolamento entre organizações e da idempotência do dispatcher

---

## 5. Modelo de dados

### organizations
`id`, `nome`, `idioma_padrao` (pt | es | en), `timezone_padrao`, `ativa`, `criada_em`

### users
`id`, `organization_id` (nulo para superadmin), `nome`, `email` (único), `telefone` (nulo), `telegram_username` (nulo), `senha_hash`, `perfil` (superadmin | admin | usuario), `idioma` (nulo — sobrepõe o idioma da organização), `ativo`, `senha_provisoria` (booleano), `ultimo_login_em`, `criado_em`

O e-mail é a credencial de entrada e continua obrigatório. Telefone e usuário do Telegram são opcionais e puramente cadastrais: servem para localizar a pessoa, o que na OA costuma valer mais que o e-mail. Entrar pelo Telegram fica como evolutiva.

### sessions
`id`, `user_id`, `token_hash`, `organization_ativa_id` (nulo), `ip`, `user_agent`, `expira_em`, `criada_em`

O cookie leva um token aleatório e o banco guarda apenas o HMAC dele, de modo que o dump do banco não devolve sessão utilizável. A validade é do registro, não do cookie, o que permite renovar a sessão a cada uso e revogá-la na hora quando o usuário é desativado ou tem a senha redefinida. É aqui também que fica a organização ativa do superadmin.

### user_folders
Relação muitos-para-muitos usada apenas pelo perfil `usuario`: `user_id`, `folder_id`

### folders
`id`, `organization_id`, `nome`, `descricao`, `timezone`, `telegram_chat_id`, `telegram_bot_token_cifrado` (**nulo por padrão** — sobreposição opcional; quando nulo, usa o bot global da variável de ambiente), `ao_esgotar` (parar_notificar | reiniciar), `ativa`, `criada_em`

### texts
`id`, `folder_id`, `conteudo`, `ordem`, `imagem` (bytea, nulo), `imagem_mime`, `imagem_bytes`, `imagem_nome_original`, `status` (pendente | publicado | erro | arquivado), `publicado_em`, `arquivado_em`, `erro_mensagem`, `import_id`, `hash_conteudo`, `criado_por`, `criado_em`

Índice único em (`folder_id`, `hash_conteudo`) para detectar duplicatas na importação. O `hash_conteudo` considera apenas o texto, não a imagem.

**Quatro situações, e duas formas de sair da lista.** `arquivar` é a ação normal: tira o texto da fila e da lista de trabalho, preserva o registro e guarda a data em `arquivado_em`. `excluir` continua existindo para o admin, para casos excepcionais, e apaga a linha. O histórico sobrevive à exclusão porque a publicação guarda o que foi ao ar (ver `publications`).

A `ordem` é o que sustenta a fila e a reordenação por arrastar. Na importação não há coluna de ordem para mapear: vale a ordem das linhas do arquivo.

### schedules
`id`, `folder_id`, `hora_local` (HH:MM), `dias_semana` (conjunto de 1 a 7), `ativo`

Uma pasta pode ter vários agendamentos — por exemplo, 07:00 de segunda a sexta e 09:00 nos fins de semana.

Os dias são gravados em ISO-8601 (1 = segunda … 7 = domingo), que é o padrão de qualquer biblioteca de data, e exibidos por sigla começando no domingo: **Dom Seg Ter Qua Qui Sex Sáb**. As siglas são traduzidas junto com o resto da interface.

Índice único em (`folder_id`, `hora_local`): dois agendamentos no mesmo horário da mesma pasta gerariam um slot só, então o cadastro é bloqueado com mensagem clara.

### publications
`id`, `folder_id`, `text_id` (nulo quando a fila está vazia ou quando o texto foi excluído), `origem` (dispatcher | manual | importacao), `data_prevista` (date), `hora_prevista` (time, nula apenas no histórico importado), `status` (reivindicada | enviada | erro | perdida), `conteudo_publicado`, `tinha_imagem`, `tentativas`, `telegram_message_id`, `erro_mensagem`, `reivindicada_em`, `enviada_em`

**Índice único em (`folder_id`, `data_prevista`, `hora_prevista`).** É esta restrição que garante a idempotência.

`conteudo_publicado` e `tinha_imagem` são a cópia do que foi enviado. Sem eles, excluir um texto deixaria o histórico com uma linha vazia: `text_id` vira nulo e ninguém mais sabe o que foi publicado naquele dia. A imagem não é copiada — some junto com o texto, e o histórico apenas indica que havia uma.

`origem` separa o slot calculado pelo dispatcher da ação "publicar agora" e do histórico trazido de outro aplicativo. Só o histórico importado tem `hora_prevista` nula: o Postgres trata nulos como distintos na restrição única, então duas mensagens importadas na mesma data não colidem, enquanto todo slot do dispatcher continua tendo hora — que é exatamente o caso que a restrição protege. O dispatcher nunca reenvia uma linha importada.

`reivindicada_em` é o que permite identificar um slot preso em `reivindicada` porque o processo morreu no meio do envio.

### settings
Linha única, global ao sistema: `id`, `alerts_chat_id` (nulo), `google_chat_webhook` (nulo), `atualizado_por`, `atualizado_em`

Editável apenas pelo superadmin. Ver a ordem de precedência em 7.4.

### imports
`id`, `folder_id`, `arquivo_nome`, `total_linhas`, `importadas`, `importadas_como_historico`, `duplicadas_ignoradas`, `desfeito_em`, `criado_por`, `criado_em`

### audit_log
`id`, `organization_id`, `user_id`, `acao`, `entidade`, `entidade_id`, `detalhes` (jsonb), `ip`, `criado_em`

---

## 6. Perfis e permissões

| Ação | Superadmin | Admin | Usuário |
|---|:--:|:--:|:--:|
| Criar, editar, desativar organizações | sim | não | não |
| Transitar entre organizações | sim | não | não |
| Criar e gerenciar admins | sim | não | não |
| Criar e gerenciar usuários da sua organização | sim | sim | não |
| Redefinir senha de usuário | sim | da sua organização | não |
| Atribuir pastas a usuários | sim | sim | não |
| Criar, editar, excluir pastas | sim | sim | não |
| Configurar chat_id da pasta | sim | sim | não |
| Configurar token de sobreposição da pasta | sim | não | não |
| Configurar destino dos alertas | sim | não | não |
| Configurar agendamentos | sim | sim | não |
| Criar, editar, excluir textos e imagens | sim | sim | nas pastas atribuídas |
| Importar CSV/XLSX | sim | sim | nas pastas atribuídas |
| Reordenar a fila | sim | sim | nas pastas atribuídas |
| Publicar agora, pular, reenviar | sim | sim | nas pastas atribuídas |
| Arquivar texto | sim | sim | nas pastas atribuídas |
| Exportar textos | sim | sim | nas pastas atribuídas |
| Ver ou baixar a imagem de um texto | sim | toda a organização | pastas atribuídas |
| Ver painel e histórico | todas as organizações | toda a organização | pastas atribuídas |
| Ver log de auditoria | sim | da sua organização | não |

Regras de isolamento:

- Todo acesso a dados é filtrado por `organization_id` na camada de dados, não na interface. Nenhuma consulta parte de um identificador vindo da URL sem verificar a organização do usuário autenticado.
- O superadmin opera com uma organização ativa selecionada, visível no topo da tela, e toda troca fica registrada na auditoria.
- Não existe cadastro público. Usuários são criados por quem está acima deles na hierarquia, com senha provisória e troca obrigatória no primeiro acesso.
- Recurso de outra organização responde **404, nunca 403**: um 403 confirmaria que aquele identificador existe.
- A linha da imagem vale tanto para a miniatura na lista quanto para a rota que serve o binário — a rota não tem atalho próprio, passa pela mesma verificação das demais consultas.

---

## 7. Agendamento e publicação

### 7.1 Fluxo

1. O `worker` acorda a cada 5 minutos.
2. Para cada pasta ativa, calcula os slots (`data_prevista`, `hora_prevista`) vencidos dentro da janela de tolerância de 30 minutos e ainda não registrados, usando o fuso horário da pasta.
3. Para cada slot, insere a linha em `publications` com status `reivindicada`. Se a inserção falhar por violação da restrição única, outro processo já pegou o slot e este desiste em silêncio.
4. Seleciona o texto `pendente` de menor `ordem` na pasta. Com imagem, publica com `sendPhoto` (imagem em multipart, texto como legenda); sem imagem, com `sendMessage`.
5. Em caso de sucesso: marca a publicação como `enviada`, grava o `telegram_message_id`, e marca o texto como `publicado` com a data-hora.
6. Em caso de falha: até 3 tentativas com backoff exponencial. Esgotadas, marca publicação e texto como `erro`, envia alerta e **não avança a fila**.
7. Slots vencidos há mais de 30 minutos são marcados como `perdidos` e alertados, nunca publicados com atraso.

### 7.2 Idempotência

A reivindicação do slot acontece **antes** da chamada ao Telegram, dentro de uma transação. Nenhuma trava em memória do processo é aceitável: dois deploys sobrepostos, um restart ou uma segunda réplica acidental não podem gerar publicação dupla.

### 7.3 Fila esgotada

Comportamento configurado por pasta:

- **parar_notificar:** registra a publicação sem texto, alerta os administradores e não publica nada.
- **reiniciar:** devolve todos os textos da pasta ao status `pendente`, preservando a ordem, e publica o primeiro. O evento fica registrado na auditoria.

O painel avisa quando uma pasta tem menos de cinco textos pendentes.

### 7.4 Alertas operacionais

Eventos que geram alerta: falha definitiva de publicação, slot perdido, fila esgotada em pasta configurada como `parar_notificar`, fila com menos de cinco textos pendentes e falha de autenticação do bot.

**Destino do alerta, nesta ordem de precedência:**

1. `settings.alerts_chat_id`, se preenchido pela interface;
2. senão a variável de ambiente `ALERTS_CHAT_ID`;
3. senão apenas o log da aplicação e o painel de alertas na interface.

O mesmo vale para o webhook do Google Chat (`settings.google_chat_webhook`, depois `GOOGLE_CHAT_WEBHOOK`).

A razão do arranjo: a variável de ambiente é o destino garantido, que continua funcionando quando o próprio banco está inacessível — justamente quando o alerta é mais necessário. O campo na interface existe para trocar o grupo de alertas sem redeploy. Um sistema que só soubesse o destino pelo banco ficaria mudo na falha mais grave possível.

Ambas as configurações podem começar vazias: no início o sistema alerta apenas no log e na interface, e passa a alertar no Telegram quando o `chat_id` for cadastrado. Isso evita bloquear o deploy da fase 1 pelo levantamento de um `chat_id` que ainda não existe.

A falha de um canal de alerta nunca interrompe a publicação nem gera novo alerta — apenas registro no log.

---

## 8. Integração com o Telegram

- **Um único bot para todas as organizações:** `@OAmsg_bot`, com o token na variável compartilhada `TELEGRAM_BOT_TOKEN`.
- O campo de token na pasta existe como sobreposição opcional, nulo por padrão, editável apenas pelo superadmin. Serve para isolar uma organização no futuro sem mexer no código. Quando preenchido, é cifrado com AES-256-GCM e nunca reexibido na interface — apenas os últimos caracteres.
- O bot precisa estar em todos os grupos de destino. Em canais, precisa ser administrador. Modo de privacidade mantido em Enabled: o bot não lê as conversas dos grupos.
- O destino é o `chat_id` numérico (supergrupos vêm com o prefixo `-100`), não um link ou nome de usuário. Mesmo quando o grupo tem username público, usar o número: o username pode ser alterado por um administrador e quebraria a publicação.
- **Grupo comum versus supergroup:** o `chat_id` de um grupo comum muda quando ele é promovido, e a publicação passa a falhar com `chat not found`. Promover antes do cadastro, e manter o campo editável na interface como conserto rápido.
- `parse_mode: HTML` — mais tolerante que MarkdownV2. A interface avisa quais tags são aceitas.
- **Limites de tamanho, validados na digitação e na importação:** 4096 caracteres para texto sem imagem, **1024 caracteres para texto com imagem** (limite de legenda do Telegram). Anexar imagem a um texto acima de 1024 caracteres é bloqueado com mensagem explícita.
- Respeitar os limites de taxa da Bot API. Com bot único, todas as publicações compartilham a mesma cota — o dispatcher serializa os envios quando várias pastas coincidem no mesmo slot.
- O botão "testar conexão" envia uma mensagem de teste e exibe o erro exato devolvido pela API. Tratar com mensagem clara: `chat not found`, `bot was kicked from the group chat`, `not enough rights to send text messages`, `unauthorized` (token inválido).

---

## 9. Textos, imagens e importação

- Digitação manual com contador de caracteres, limite dinâmico conforme a presença de imagem e pré-visualização do HTML.
- **Uma imagem opcional por texto**, enviada pela interface. Formatos aceitos: JPEG, PNG e WebP. Limite de 2 MB após processamento; no upload, a imagem é redimensionada para no máximo 1600 px no lado maior e recomprimida. Metadados EXIF removidos.
- A imagem é guardada no Postgres como `bytea`, servida pelo `web` em rota autenticada e lida pelo `worker` diretamente do banco na hora de publicar.
- Importação de CSV e XLSX é **somente texto**. Imagens entram apenas pela edição manual — importação de imagens em lote fica para evolutiva.
- A importação mostra pré-visualização com mapeamento de colunas antes de confirmar. Duplicatas (mesmo texto na mesma pasta) são sinalizadas e ignoradas, com o total exibido no resultado.
- **A importação pode trazer histórico.** Uma coluna de data de publicação, opcional, permite subir mensagens já publicadas em outro aplicativo de mensageria: a linha entra com status `publicado` e a data informada, e aparece no histórico marcada como importada. O dispatcher nunca a reenvia. Sem essa coluna, a linha entra como `pendente` no fim da fila.
- Não há coluna de ordem para mapear: a ordem da fila é a ordem das linhas do arquivo.
- Cada importação fica registrada, com possibilidade de desfazer enquanto nenhum texto daquele lote tiver sido publicado.
- A lista de textos mostra miniatura da imagem, conteúdo, ordem, status e data-hora da publicação, com busca por conteúdo, filtro por status e reordenação manual por arrastar.
- Textos publicados não voltam para a fila nem são reordenados. **Arquivar** é a ação normal para tirá-los da lista preservando o registro; **excluir** existe para o admin, em casos excepcionais, e mesmo assim o histórico sobrevive, porque a publicação guarda o conteúdo que foi ao ar.
- **Exportação dos textos em PDF, XLSX, CSV, JSON e XML**, respeitando o filtro ativo da lista e o escopo do usuário — quem só enxerga duas pastas exporta apenas o que enxerga.

---

## 10. Interface

- Clean, elegante e moderna. **O tema escuro é o padrão**, com alternador para o claro na mesma linha do cabeçalho, sem faixa própria, para não gastar altura útil.
- **A entrada é uma tela de quatro blocos**, cada um com ilustração, título e explicação: *Painel de controle*, *Textos* (com importação e histórico dentro), *Configuração* (pastas, usuários e auditoria; admin e superadmin) e *Sistema* (só superadmin). O menu lateral das telas internas segue a mesma divisão, e cada bloco aparece conforme o perfil.
- Identidade visual própria: a marca é `msg`, um balão de fala com três pontos em quadrado arredondado, com o wordmark em minúsculas.
- Interface traduzida em português, espanhol e inglês. O idioma padrão vem da organização e pode ser trocado por usuário.
- Painel inicial, por pasta: últimos textos publicados com data-hora e miniatura, próximo texto da fila, próxima publicação programada, total de textos pendentes e alertas de erro ou fila curta.
- Painel de alertas na própria interface, com os erros e as filas curtas das pastas visíveis ao usuário. O Telegram é o aviso imediato; a interface é o registro consultável.
- Tela de configurações globais, visível só ao superadmin: destino dos alertas (`chat_id` do Telegram e webhook do Google Chat), com botão de teste para cada canal.
- Todas as datas e horas exibidas no fuso horário da pasta, com o fuso indicado explicitamente.
- Ações manuais: publicar agora, pular texto, reenviar texto com erro.

---

## 11. Segurança

- Sessão em cookie `httpOnly`, `Secure`, `SameSite=Lax`, com expiração e renovação.
- Rate limit no login por IP e por conta.
- Proteção CSRF em toda ação que altera dados.
- Rota de imagem autenticada e verificada contra a organização do usuário — imagem de uma organização não é acessível por outra, nem por URL direta.
- Validação do conteúdo real do arquivo de imagem, não apenas da extensão ou do MIME declarado.
- Nenhum segredo no código ou no repositório; apenas variáveis de ambiente do Railway. Nenhum token em log nem em mensagem de erro exibida na interface.
- Log de auditoria de toda criação, edição, exclusão e publicação.
- LGPD: os dados pessoais tratados são apenas nome e e-mail dos usuários administrativos, e o e-mail serve exclusivamente como identificador de login — o sistema não envia e-mail algum. Sem dados de terceiros e sem rastreamento de leitores.
- Backup do banco configurado no Railway, com teste de restauração antes de entrar em produção. Com imagens no banco, conferir o tamanho do dump periodicamente.

---

## 12. Fases de entrega

| Fase | Conteúdo | Aprovação |
|---|---|---|
| 0 | Modelo de dados, matriz de permissões, mockup estático navegável, escolha do framework | obrigatória antes de qualquer código |
| 1 | Serviços `web` e `worker` no Railway conforme 3.3, autenticação, organizações, usuários, permissões, isolamento testado | **código concluído**; falta criar os serviços no painel |
| 2 | Pastas, textos, imagens, importação CSV/XLSX, reordenação | obrigatória |
| 3 | Agendamentos, dispatcher, integração Telegram, idempotência testada, alertas e configurações globais | obrigatória |
| 4 | Painel, i18n, auditoria, polimento visual | entrega final |

---

## 13. Prompt para o Claude Code

Este é o prompt que abriu o projeto, mantido como registro. As fases 0 e 1 já foram entregues; uma sessão nova continua de onde o `CLAUDE.md` e o `README.md` do repositório indicam, e não precisa recomeçar por aqui.

Cole na primeira sessão, com o repositório `cnasajon/msg` e a branch `main` selecionados:

```
Vamos construir uma aplicação nova neste repositório (cnasajon/msg). A
especificação completa está em docs/ESPECIFICACAO.md — leia o arquivo inteiro
antes de responder qualquer coisa.

Contexto em uma frase: aplicação web multi-organização para publicar textos e
imagens programados em grupos de Telegram, hospedada em msg.oa12.org sobre Railway.

REGRAS DE TRABALHO
- Responda sempre em português.
- Mostre alterações de código em forma de diff, não arquivos inteiros.
- Nenhum segredo no código: tudo em variáveis de ambiente.
- Pergunte quando a especificação estiver ambígua, em vez de decidir sozinho.
- Crie o CLAUDE.md do projeto na primeira tarefa, consolidando estas regras.

PONTOS NÃO NEGOCIÁVEIS DA ESPECIFICAÇÃO
1. Isolamento entre organizações aplicado na camada de dados, não na interface.
   Escreva testes que provem que um admin de uma organização não alcança dados
   de outra por manipulação de identificador na URL — inclusive imagens.
2. Idempotência das publicações garantida por índice único em
   (folder_id, data_prevista, hora_prevista), com a reivindicação do slot
   gravada antes da chamada ao Telegram. Trava em memória do processo não serve.
3. Dispatcher em um serviço worker separado do serviço web, fixo em uma réplica.
4. Fuso horário: TZ=UTC nos serviços; agendamento e exibição sempre no fuso da pasta.
5. Bot único do Telegram (@OAmsg_bot) na variável compartilhada TELEGRAM_BOT_TOKEN.
   O campo de token na pasta é sobreposição opcional, nulo por padrão, cifrado,
   editável só pelo superadmin.
6. Dois limites de tamanho distintos: 4096 caracteres para texto sem imagem e
   1024 para texto com imagem (limite de legenda do Telegram). A validação muda
   ao anexar ou remover a imagem.
7. Imagens guardadas no Postgres como bytea, servidas em rota autenticada e lidas
   pelo worker direto do banco. Sem serviço de armazenamento externo, sem volume.
8. Ao esgotar a fila de uma pasta, o comportamento é configurável por pasta
   (parar e alertar, ou reiniciar a fila).
8b. Quatro situações do texto: pendente, publicado, erro e arquivado. Arquivar é
   a ação normal para tirar um texto da lista; excluir fica para o admin, em
   casos excepcionais, e o histórico sobrevive porque a publicação guarda o
   conteúdo que foi ao ar.
9. Destino dos alertas com a precedência da seção 7.4: tabela settings, depois
   variável de ambiente, depois só log e painel. O worker precisa conseguir
   alertar mesmo com o banco inacessível. As duas configurações podem estar
   vazias sem quebrar o deploy.
10. O chat_id de cada pasta e o destino dos alertas são configuráveis pela
   interface. Nada de chat_id fixo no código.

ESTADO DA INFRAESTRUTURA
O projeto no Railway já existe (`msg`), com o serviço `postgres` Online e as
variáveis TELEGRAM_BOT_TOKEN, SESSION_SECRET e ENCRYPTION_KEY cadastradas como
variáveis compartilhadas do projeto. Os serviços `web` e `worker` ainda não
existem: serão criados na fase 1, conforme a seção 3.3 da especificação.
O package.json precisa expor os scripts start:web e start:worker.

SEQUÊNCIA DE ENTREGA — NÃO PULE ETAPAS
Fase 0, antes de escrever qualquer linha de código de aplicação, apresente:
  (a) o modelo de dados em Prisma schema, com os índices e as restrições únicas;
  (b) a matriz de permissões (perfil x ação), confirmando o que está na especificação;
  (c) um mockup estático navegável em HTML de todas as telas, cobrindo as visões
      de superadmin, admin e usuário, nos temas claro e escuro, incluindo o
      upload de imagem, a lista de textos com miniatura e a tela de configurações
      globais. Coloque o mockup em docs/mockup/ como arquivos HTML estáticos,
      sem dependência de build, para eu poder abrir direto do navegador;
  (d) a escolha entre Next.js com server actions e Fastify + React, com a
      justificativa em três linhas.
Pare e espere minha aprovação de cada item.

Depois da aprovação, apresente o plano de implementação das fases 1 a 4 da
especificação, com o que entra em cada commit. Espere minha aprovação novamente
antes de implementar.

Na fase 1, siga a seção 3.3 e me entregue os comandos que eu preciso executar.
Eu faço o cadastro no painel do Railway manualmente — não tente automatizar o
cadastro de segredos nem me pedir valores de segredo.

Ao final de cada fase, atualize o README.md espelhando a seção 3 da especificação.

Estou rodando você na nuvem (claude.ai/code), então trabalhe em branch e abra PR.

Comece lendo docs/ESPECIFICACAO.md e me apresentando a fase 0.
```

---

## 14. Decisões registradas

1. **Banco:** Postgres gerenciado do Railway. Imagens no próprio banco, sem armazenamento externo.
2. **Bot do Telegram:** um único bot (`@OAmsg_bot`), com campo de sobreposição por pasta mantido como hedge.
3. **Imagens:** incluídas na v1, com escopo enxuto — uma por texto, 2 MB, só pela edição manual.
4. **Notificações:** alertas no Telegram, com Google Chat opcional. Sem provedor de e-mail.
5. **Senha esquecida:** redefinida por um admin, ou pelo superadmin no caso dos admins.
6. **Destino dos alertas:** configurável pela interface, com variável de ambiente como garantia.
7. **Claude Code:** sessões na nuvem, em branch com PR. Mockup em `docs/mockup/` como HTML estático.
8. **Nomenclatura:** repositório `cnasajon/msg`, projeto Railway `msg`, domínio `msg.oa12.org`, bot `@OAmsg_bot`.
9. **Framework:** Next.js (App Router) com server actions.
10. **Situações do texto:** quatro — `pendente`, `publicado`, `erro`, `arquivado`. Arquivar é o caminho normal; excluir fica para o admin, em casos excepcionais.
11. **Exportação:** PDF, XLSX, CSV, JSON e XML, respeitando filtro e escopo.
12. **Importação de histórico:** coluna opcional de data de publicação, com `origem = importacao` e `hora_prevista` nula na publicação.
13. **Cadastro de pessoas:** telefone e usuário do Telegram, opcionais; e-mail obrigatório, porque é a credencial de entrada.
14. **Dias da semana:** ISO-8601 no banco (1 = segunda … 7 = domingo), siglas na interface começando no domingo.
15. **Fuso padrão das organizações:** `America/Sao_Paulo` como valor inicial, editável por organização e sobreposto por pasta.
16. **Interface:** tema escuro por padrão; entrada em quatro blocos.

### Em aberto

- **Entrar pelo Telegram:** hoje o login é por e-mail e senha. Autenticar pelo usuário do Telegram, ou aceitar qualquer um dos dois, fica como evolutiva a decidir.
- **Levantamento dos `chat_id`** restantes: grupo de alertas e grupos das OAs em espanhol e inglês (ver anexo).

---

## Anexo — levantamento dos chat_id

Procedimento por grupo conforme 3.2. Com o token exportado numa variável `TG` da sessão do terminal:

```bash
curl -s "https://api.telegram.org/bot$TG/getUpdates" | python3 -c "
import json,sys
vistos=set()
for u in json.load(sys.stdin)['result']:
    c=u.get('message',{}).get('chat',{})
    if c and c['id'] not in vistos:
        vistos.add(c['id'])
        print(f\"{c['id']}  |  {c.get('title','(privado)')}  |  {c['type']}\")"
```

```bash
curl -s -X POST "https://api.telegram.org/bot$TG/sendMessage" \
  -d "chat_id=-100XXXXXXXXXX" -d "text=Teste" | python3 -c "
import json,sys
r=json.load(sys.stdin); print('OK' if r['ok'] else 'ERRO: '+r.get('description',''))"
```

Ao terminar, `unset TG` e limpar o histórico do shell.

| Grupo | chat_id | Tipo | Situação |
|---|---|---|---|
| Uma Visão Para Você (`cca_uvpv`) | `-1001492357816` | supergroup | definitivo, envio testado |
| 👫 Mesa de ajuda UVPV | `-371133828` | group | promover a supergroup antes de cadastrar |
| Grupo de alertas (a criar) | — | — | pendente |
| OA España (a levantar) | — | — | pendente |
| OA English (a levantar) | — | — | pendente |
