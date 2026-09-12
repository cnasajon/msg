# Fase 0 — modelo de dados, permissões, mockup e escolha do framework

Referência: `docs/ESPECIFICACAO.md` v1.3. Cada item abaixo aguarda aprovação
antes de qualquer código de aplicação.

---

## (a) Modelo de dados

Arquivo: [`prisma/schema.prisma`](../prisma/schema.prisma).

### Restrições únicas

| Tabela | Restrição | Por quê |
| :-- | :-- | :-- |
| `publications` | **`(folder_id, data_prevista, hora_prevista)`** | **Idempotência.** A linha é inserida com status `reivindicada` antes da chamada ao Telegram, dentro de uma transação. Violação = outro processo já pegou o slot; este desiste em silêncio. |
| `texts` | `(folder_id, hash_conteudo)` | Detecção de duplicata na importação. O hash considera só o texto, não a imagem. |
| `users` | `(email)` | Identificador de login. |
| `folders` | `(organization_id, nome)` | Evita duas pastas homônimas na mesma organização. |
| `schedules` | `(folder_id, hora_local)` | Evita dois agendamentos no mesmo horário da mesma pasta gerando o mesmo slot. |
| `sessions` | `(token_hash)` | Lookup da sessão. |

### Índices

| Tabela | Índice | Uso |
| :-- | :-- | :-- |
| `texts` | `(folder_id, status, ordem)` | Seleção do próximo texto da fila: menor `ordem` entre os `pendente`. |
| `texts` | `(import_id)` | Desfazer importação. |
| `publications` | `(folder_id, data_prevista)` | Cálculo de slots vencidos no ciclo do dispatcher. |
| `publications` | `(status)` | Varredura de slots `reivindicada` a reprocessar e `perdida` a alertar. |
| `folders` | `(organization_id, ativa)` | Listagem por organização e varredura do dispatcher. |
| `users` | `(organization_id, perfil)` | Listagem de usuários da organização. |
| `user_folders` | `(folder_id)` | Quem tem acesso à pasta. |
| `audit_log` | `(organization_id, criado_em)`, `(entidade, entidade_id)` | Consulta do log. |
| `sessions` | `(user_id)`, `(expira_em)` | Revogação e limpeza. |

### Acréscimos ao que está na seção 5 da especificação

Cinco campos e uma tabela não listados explicitamente na seção 5, todos
derivados de requisitos do próprio documento:

1. **`sessions`** (tabela nova) — a seção 11 exige sessão com expiração e
   renovação, e a 6 exige que o superadmin opere com uma organização ativa
   registrada na auditoria. A sessão persistida guarda `organization_ativa_id` e
   permite revogação imediata ao desativar um usuário. O cookie carrega apenas o
   hash do token.
2. **`users.idioma`** — a seção 10 diz que o idioma "pode ser trocado por
   usuário". Nulo = herda o idioma da organização.
3. **`publications.conteudo_publicado` e `publications.tinha_imagem`** — cópia do
   texto no momento do envio. Com ela, excluir um texto não deixa buraco no
   histórico: `text_id` vira nulo, mas a linha continua mostrando o que foi
   publicado. É o que sustenta a decisão 1 abaixo.
4. **`publications.reivindicada_em`** — sem ele não dá para medir há quanto
   tempo um slot está preso em `reivindicada` (processo morto no meio do envio).
5. **`imports.desfeito_em`** — a seção 9 prevê desfazer a importação enquanto
   nenhum texto do lote tiver sido publicado.

`publications.data_prevista` é `date` e `hora_prevista` é `time`, ambos **no fuso
da pasta** — é essa a chave natural do slot. O instante real do envio fica em
`enviada_em`, em `timestamptz`.

---

## (b) Matriz de permissões

Confirma a seção 6 da especificação, com a coluna "aplicação" dizendo onde a
regra é imposta. Toda linha é verificada na camada de dados: o identificador da
URL só é usado depois de resolvido contra a organização do usuário autenticado.

| Ação | Superadmin | Admin | Usuário | Onde a regra é imposta |
| :-- | :-: | :-: | :-: | :-- |
| Criar, editar, desativar organizações | sim | não | não | perfil |
| Transitar entre organizações | sim | não | não | perfil + registro na auditoria |
| Criar e gerenciar admins | sim | não | não | perfil |
| Criar e gerenciar usuários da sua organização | sim | sim | não | `users.organization_id` = org do autenticado |
| Redefinir senha de usuário | sim | da sua organização | não | idem |
| Atribuir pastas a usuários | sim | sim | não | pasta e usuário na mesma organização |
| Criar, editar, excluir pastas | sim | sim | não | `folders.organization_id` |
| Configurar `chat_id` da pasta | sim | sim | não | `folders.organization_id` |
| Configurar token de sobreposição da pasta | sim | **não** | não | perfil + `folders.organization_id` |
| Configurar destino dos alertas | sim | não | não | perfil (tabela `settings`, linha única) |
| Configurar agendamentos | sim | sim | não | `schedules.folder → organization_id` |
| Criar, editar, excluir textos e imagens | sim | sim | nas pastas atribuídas | `texts.folder → organization_id` (+ `user_folders` para `usuario`) |
| Importar CSV/XLSX | sim | sim | nas pastas atribuídas | idem |
| Reordenar a fila | sim | sim | nas pastas atribuídas | idem |
| Publicar agora, pular, reenviar | sim | sim | nas pastas atribuídas | idem |
| **Ver/baixar imagem de um texto** | sim | toda a organização | pastas atribuídas | `texts.folder → organization_id` (+ `user_folders`) na própria rota |
| Ver painel e histórico | todas as organizações | toda a organização | pastas atribuídas | escopo da consulta |
| Ver log de auditoria | sim | da sua organização | não | `audit_log.organization_id` |

A linha da imagem não está na tabela da seção 6, mas está na seção 11 e é um
ponto não negociável do prompt — por isso aparece aqui explicitamente.

### Regras de isolamento

1. Nenhuma consulta parte de identificador vindo da URL sem verificar a
   organização do usuário autenticado. Na prática: toda leitura passa por um
   escopo (`escopoDoUsuario`) que devolve o `where` já com
   `organization_id` — e, para o perfil `usuario`, com `folder_id IN
   (pastas atribuídas)`.
2. Recurso de outra organização responde **404**, não 403: 403 confirmaria a
   existência do identificador.
3. O superadmin opera com uma organização ativa selecionada, visível no topo da
   tela; toda troca fica na auditoria.
4. Não existe cadastro público. Usuário é criado por quem está acima na
   hierarquia, com senha provisória e troca obrigatória no primeiro acesso.

### Testes de isolamento previstos na fase 1

Cenário base: organizações A e B, cada uma com admin, usuário, pasta e texto.

| # | Teste | Esperado |
| :-- | :-- | :-- |
| 1 | Admin de A faz `GET /orgs/B/...` | 404 |
| 2 | Admin de A abre pasta de B pelo `id` na URL | 404 |
| 3 | Admin de A edita/exclui texto de B pelo `id` | 404, nada alterado |
| 4 | Admin de A baixa **imagem** de texto de B pela rota autenticada | 404, zero bytes |
| 5 | Requisição sem sessão à rota de imagem | 401 |
| 6 | Usuário de A acessa pasta de A **não atribuída** a ele | 404 |
| 7 | Admin de A atribui pasta de B a usuário de A | rejeitado |
| 8 | Admin de A tenta gravar token de sobreposição na própria pasta | rejeitado (só superadmin) |
| 9 | Superadmin com organização ativa A lista textos | só os de A; a troca aparece na auditoria |

---

## (c) Mockup

Arquivos estáticos em [`docs/mockup/`](mockup/), sem build e sem CDN — basta
abrir `docs/mockup/index.html` no navegador. O tema escuro é o padrão. Na mesma
linha do cabeçalho, sem faixa própria, ficam:

- **seletor de perfil** (superadmin / admin / usuário), que muda a navegação e
  os controles visíveis — é artifício do mockup, não existe na aplicação;
- **alternador de tema**, em ícone;
- **seletor de organização**, visível apenas para o superadmin.

Perfil e tema ficam no `localStorage` e acompanham a navegação entre as telas.

| Arquivo | Tela |
| :-- | :-- |
| `index.html` | Guia do mockup, com o roteiro de navegação |
| `login.html` | Entrada |
| `primeiro-acesso.html` | Troca obrigatória de senha provisória |
| `painel.html` | Painel inicial por pasta (varia por perfil) |
| `organizacoes.html` | Organizações (superadmin) |
| `usuarios.html` | Usuários, atribuição de pastas, redefinição de senha |
| `pastas.html` | Lista de pastas |
| `pasta-config.html` | Pasta: `chat_id`, fuso, ao esgotar, agendamentos, token de sobreposição, testar conexão |
| `textos.html` | Lista de textos com miniatura, busca, filtro e reordenação |
| `home.html` | **Tela inicial** com os quatro blocos |
| `texto-editor.html` | Editor com contador dinâmico (4096/1024), upload de imagem e pré-visualização |
| `importacao.html` | Importação CSV/XLSX com mapeamento de colunas, pré-visualização e resultado |
| `historico.html` | Histórico de publicações |
| `alertas.html` | Painel de alertas |
| `configuracoes.html` | Configurações globais (superadmin): destino dos alertas com teste por canal |
| `auditoria.html` | Log de auditoria |

Como abrir trabalhando na nuvem, conforme a seção 3.1: `git pull` da branch e
abrir o arquivo, ou colar a URL do arquivo em `htmlpreview.github.io`.

---

## (d) Escolha do framework

**Next.js (App Router) com server actions.**

1. Uma única aplicação cobre interface, server actions e as rotas que precisam
   ser servidas pelo Node — a de imagem autenticada em especial, que lê `bytea`
   e responde com o binário sob a mesma verificação de organização da interface;
   com Fastify + React seriam dois builds, dois deploys e uma fronteira de
   autenticação a mais para manter em sincronia, sem ganho aqui.
2. O trecho que realmente importa — dispatcher, idempotência, Telegram, cifra do
   token — vive no serviço `worker`, fora do framework, compartilhando com o
   `web` apenas o Prisma e os módulos de domínio; a escolha do framework não
   afeta nenhum dos pontos não negociáveis.
3. Sessão em cookie `httpOnly`, CSRF nas server actions, `next-intl` para pt/es/en
   e Tailwind são caminho batido no Next, e o serviço `web` no Railway fica com
   um `npm run start:web` e um health check — exatamente o que a seção 3.3 pede.

---

## Decisões aprovadas

Os cinco pontos que estavam em aberto foram respondidos e já estão aplicados ao
schema e ao mockup.

1. **Quatro estados, com arquivamento e exclusão.** O `status` do texto é
   `pendente | publicado | erro | arquivado`, e `texts.arquivado_em` guarda a
   data do arquivamento. **Arquivar** é a ação normal para tirar um texto da
   lista preservando o registro; **excluir** continua existindo para o admin,
   para casos excepcionais. As ações da lista passam a ser editar, arquivar e
   excluir. Mesmo na exclusão o histórico sobrevive: `publications` guarda
   `conteudo_publicado` e `tinha_imagem` — o que foi ao ar fica registrado na
   publicação, não no texto. A imagem não é copiada; some junto com o texto, e o
   histórico indica que havia uma.
2. **Duplicata depois de publicada — aprovado.** O índice único
   `(folder_id, hash_conteudo)` fica como a especificação pede. A importação
   lista as duplicatas ignoradas com o motivo.
3. **Agendamentos — aprovado.** Índice único `(folder_id, hora_local)` bloqueia
   dois agendamentos no mesmo horário da mesma pasta, com mensagem clara.
4. **Dias da semana — aprovado com ajuste de interface.** O armazenamento é
   ISO-8601 (1 = segunda … 7 = domingo). A interface exibe e marca por sigla,
   começando no domingo: **Dom Seg Ter Qua Qui Sex Sáb**. As siglas são
   traduzidas junto com o resto da interface (pt/es/en).

6. **Nome e identidade — `msg`.** A aplicação passa a se chamar `msg`, nome
   genérico de propósito. Vale para a interface, a documentação e o projeto no
   Railway. O repositório foi renomeado para `cnasajon/msg`. Fica como está, por
   ser externo ao código, o bot `@OAmsg_bot` — trocar o username de um bot exige
   criar outro no BotFather e gerar novo token, e como o token vem de variável de
   ambiente isso pode ser feito depois sem tocar em código. A logomarca está em `docs/mockup/assets/logo.svg`, com o símbolo
   isolado em `mark.svg`.

7. **Exportação dos textos** em PDF, XLSX, CSV, JSON e XML, respeitando o filtro
   ativo da lista e o escopo do usuário. Entra na fase 2, junto com a lista de
   textos.

8. **Importação de histórico.** A importação ganha o mapeamento opcional de uma
   **coluna de data de publicação**, para trazer mensagens já publicadas em outro
   aplicativo: a linha entra com `status = publicado` e a data informada. Em
   `publications` essas linhas ficam com `origem = importacao` e `hora_prevista`
   nula — o Postgres trata nulos como distintos na restrição única, então duas
   mensagens importadas na mesma data não colidem, e todo slot do dispatcher
   continua tendo hora, que é exatamente o caso que a restrição protege. O
   dispatcher nunca reenvia uma linha importada.

9. **Ordem da fila na importação.** Não há coluna de ordem para mapear: vale a
   ordem das linhas do arquivo. A coluna `texts.ordem` continua no banco — é ela
   que sustenta a fila e a reordenação por arrastar —, apenas deixa de ser
   alimentada pela planilha.

10. **Usuários ganham `telefone` e `telegram_username`**, ambos opcionais e
    apenas cadastrais: servem para localizar a pessoa, o que na OA costuma valer
    mais que o e-mail. O **e-mail continua obrigatório**, porque é a credencial de
    entrada — ver a pergunta ao final.

11. **Tela inicial nova.** A entrada deixa de ser o painel e passa a ser uma tela
    de quatro blocos com ilustração, título e explicação: *Painel de controle*,
    *Textos* (com importação e histórico dentro), *Configuração* (pastas,
    usuários e auditoria; admin e superadmin) e *Sistema* (só superadmin). O menu
    lateral das telas internas segue a mesma divisão.

12. **Tema escuro é o padrão**, com alternador para o claro na mesma linha do
   cabeçalho — sem faixa própria, para não gastar altura útil.
5. **Fuso padrão das organizações — aprovado.** `America/Sao_Paulo` como valor
   inicial de `timezone_padrao`, editável por organização e sobreposto por pasta.

Registro de uma escolha adjacente: `folders.telegram_chat_id` é texto, não
número — `-1001492357816` cabe em `bigint`, mas guardar como texto evita
qualquer surpresa de precisão em JavaScript e aceita o formato `-100...` como
digitado. A validação de formato fica na aplicação.

---

## Uma pergunta que ficou

**O e-mail pode mesmo ser opcional?** Você escreveu que todos os campos novos de
usuário são opcionais, e que na OA o Telegram vale mais que o e-mail. Telefone e
Telegram entraram como opcionais. O e-mail, não: hoje ele é a credencial de
entrada, e sem ele a pessoa não teria como se identificar no login.

Duas saídas, se você quiser o e-mail opcional de verdade:

1. **Login por e-mail *ou* usuário do Telegram**, o que for preenchido — exige
   que pelo menos um dos dois exista e seja único no sistema. É a mudança menor,
   mas mexe na tela de login e na autenticação, que são da fase 1.
2. **Login por Telegram de verdade** (o bot autentica a pessoa) — muda bastante
   coisa e vale como evolutiva, não agora.

Segui com o e-mail obrigatório para não travar a fase 1. Se preferir a saída 1,
é um ajuste pequeno enquanto a autenticação ainda está sendo escrita.
