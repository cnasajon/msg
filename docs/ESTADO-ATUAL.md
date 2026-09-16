# Estado atual do `msg`

Contexto para abrir uma conversa nova sem reler o histórico. Diz **onde o
projeto está**, **o que já foi decidido** e **o que continua aberto** — não
repete a especificação (`docs/ESPECIFICACAO.md`, v1.5) nem as regras de trabalho
(`CLAUDE.md`), que seguem sendo a fonte da verdade de cada assunto.

**Última atualização:** 16/09/2026 · versão **1.6**

---

## 1. Em uma frase

Aplicação web multi-organização que publica textos e imagens programados em
grupos de Telegram. Em produção em `msg.oa12.org`, sobre Railway, publicando de
verdade.

## 2. Situação

**As quatro fases estão entregues.** O que vem agora são ajustes pedidos com o
sistema já em uso, não construção de fase.

| Fase | Conteúdo | Situação |
| :-- | :-- | :-- |
| 0 | Modelo de dados, matriz de permissões, mockup, escolha do framework | entregue |
| 1 | Railway, autenticação, organizações, usuários, permissões, isolamento testado | entregue |
| 2 | Pastas, textos, imagens, importação CSV/XLSX, exportação, reordenação | entregue |
| 3 | Agendamentos, dispatcher, Telegram, idempotência testada, alertas | entregue |
| 4 | Painel, i18n, auditoria, polimento visual | entregue |

**Está funcionando em produção:** as publicações saem nos horários agendados, o
favicon e a marca estão no lugar, os três serviços do Railway sobem, o `/health`
responde `{"ok":true,…,"migracoes":"em dia"}`.

## 3. Infraestrutura

| Serviço | Start | Observação |
| :-- | :-- | :-- |
| `web` | `npm run start:web` | health check `/health`, porta 8080 |
| `worker` | `npm run start:worker` | sem health check, réplicas **fixas em 1** |
| `postgres` | — | plugin gerenciado do Railway |

- **Migrações** rodam no **Pre-Deploy Command** (`npm run migrate:deploy`),
  nunca no start — decisão tomada com o usuário.
- **Variáveis compartilhadas** no projeto: `TELEGRAM_BOT_TOKEN`,
  `SESSION_SECRET`, `ENCRYPTION_KEY`. `APP_URL=https://msg.oa12.org`.
- **Nenhum segredo no repositório.** Tudo cadastrado à mão no painel do Railway.
- **DNS:** CNAME `msg` → `050w4agh.up.railway.app` na HostGator, sem registros
  CAA. Propagado.

### Pendência conhecida: certificado TLS

`msg.oa12.org` aparece como **"não seguro"**: o certificado servido continua
sendo o curinga `*.up.railway.app` do próprio Railway, e o painel mostra há mais
de um dia *"Certificate Authority is validating challenges"*.

Já foi verificado daqui, e **está tudo certo do lado do cliente**: o CNAME
resolve para o destino correto, não há registros CAA bloqueando a Let's Encrypt,
as portas 80 e 443 respondem, o handshake SNI completa e o TTL do DNS (14400s)
expirou há muito. Ou seja, o problema está **dentro do Railway** ou em um limite
de emissão da Let's Encrypt.

**Próximo passo: abrir chamado no suporte do Railway.** Não há o que mudar no
código nem na HostGator.

## 4. Pontos não negociáveis

Estão listados em `CLAUDE.md` e detalhados na especificação. Os que mais
condicionam decisões novas:

1. **Isolamento entre organizações na camada de dados**, nunca na interface.
   Nenhuma consulta parte de um identificador vindo da URL sem passar pelo
   escopo da sessão — `src/lib/escopo.ts`. Há testes que provam a fronteira,
   **inclusive na rota de imagem e na exportação**.
2. **Idempotência das publicações** pelo índice único
   `publications (folder_id, data_prevista, hora_prevista)`, com a reivindicação
   do slot gravada **antes** da chamada ao Telegram, dentro de uma transação.
3. **Dispatcher no serviço `worker`**, separado do `web`, fixo em uma réplica.
4. **`TZ=UTC` em todos os serviços**; agendamento e exibição sempre no fuso da
   pasta, dito explicitamente na tela.
5. **Dois limites de tamanho:** 4096 caracteres sem imagem, 1024 com imagem.
6. **Imagens no Postgres como `bytea`**, em rota autenticada. Sem armazenamento
   externo e sem volume.

## 5. O que foi acrescentado depois da fase 4

Tudo isto nasceu de pedidos feitos com o sistema já rodando:

- **Entrada por nome de usuário** em vez de e-mail.
- **Rodapé completo** com versão, data de publicação e as páginas legais
  (`/privacidade` e `/termos`) nos três idiomas.
- **Versão automática a cada commit** (`npm run versao`), em `src/lib/versao.ts`.
  O dígito maior é `npm run versao:maior` e **só com confirmação do usuário**.
- **Alerta de fila curta configurável por pasta**: chave liga/desliga e mínimo
  editável.
- **Perfil da própria conta** (e-mail, telefone, usuário do Telegram, senha) e
  **senha definida à mão** pelo admin, não só redefinida.
- **Organização ativa lembrada entre sessões.**
- **A mesma pessoa pode participar de mais de uma organização**, trocando pelo
  cabeçalho. Quem concede é o superadmin.
- **Explicações viraram balões de ajuda** (tooltips), para manter as caixas
  alinhadas na horizontal.
- **Pastas atribuídas em sanfona** logo abaixo dos dados do usuário, com
  contagem e alerta quando é zero — antes ficavam escondidas no fim da página, e
  a pessoa acabava sem nenhuma pasta sem entender por quê.
- **Nome, Perfil e Sair no alto do menu lateral**, logo depois das opções.
- **Coluna "Texto" três vezes mais larga** na lista.
- **Ações a partir da seleção de linhas**: incluir texto na posição escolhida,
  exportar escolhidos, arquivar e excluir em lote, além de mover.
- **Bandeiras antes do nome de cada idioma** no seletor.
- **A lista de textos volta como estava**: pasta e situação filtram no ato e
  ficam guardadas no usuário.
- **A largura da lista é do conteúdo**: situação e ações viraram ícones com
  balão, e a miniatura vazia saiu. A coluna do texto passou de 505 para 737
  pixels a 1450px de largura.

## 6. Onde as coisas estão

| Caminho | Conteúdo |
| :-- | :-- |
| `src/lib/escopo.ts` | **O isolamento.** Todo caminho novo passa por aqui |
| `src/lib/autorizacao.ts` | Matriz de permissões |
| `src/lib/dispatcher.ts` | Reivindicação do slot antes do envio |
| `src/lib/selecao.ts` | Ações em lote a partir da seleção da lista |
| `src/lib/lista-lembrada.ts` | Pasta e situação lembradas da última visita |
| `src/components/icones.tsx` | Os ícones da lista, em SVG embutido |
| `src/lib/mover.ts` | Mover textos entre pastas |
| `src/lib/versao.ts` | Versão e data que aparecem no rodapé |
| `src/i18n/idiomas.ts` | Idiomas, bandeiras e os grupos que vão ao navegador |
| `messages/` | `pt.json`, `es.json`, `en.json` |
| `src/worker/` | Serviço `worker` |
| `tests/` | 19 arquivos, **218 testes** |
| `docs/ESPECIFICACAO.md` | Especificação funcional e técnica (v1.5) |
| `CLAUDE.md` | Regras de trabalho e pontos não negociáveis |

## 7. Como rodar os testes

```bash
npm test                                  # só os de unidade
TEST_DATABASE_URL=postgresql://…  npm test        # + os de integração
TEST_DATABASE_URL=postgresql://…  npm run test:http   # + as rotas HTTP
```

**Cuidado:** os testes de integração dão `TRUNCATE` nas tabelas do banco
apontado por `TEST_DATABASE_URL`. Use um banco separado do de
desenvolvimento — apontar os dois para o mesmo lugar apaga os dados locais.

## 8. Aberto

| Assunto | Situação |
| :-- | :-- |
| **Certificado TLS de `msg.oa12.org`** | Travado no Railway; abrir chamado no suporte (seção 3) |
| **"Incluir linhas" em igual número da seleção** | Entregue como *um texto por vez*, abrindo o editor na posição escolhida. Fazer N de uma vez exigiria ou criar textos vazios no banco (que o dispatcher teria de aprender a pular) ou um editor múltiplo — decisão do usuário |

## 9. Como trabalhar aqui

Resumo do que está em `CLAUDE.md`, que continua valendo por inteiro:

- **Responder sempre em português.**
- **Mostrar alterações em forma de diff**, nunca arquivos inteiros.
- **Nenhum segredo no código ou no repositório.** Nunca pedir ao usuário o valor
  de um segredo nem tentar automatizar o cadastro deles.
- **Perguntar quando a especificação estiver ambígua**, em vez de decidir
  sozinho; decisões tomadas por falta de resposta ficam registradas como
  suposição explícita.
- **Trabalhar em branch e abrir PR.** As sessões rodam na nuvem.
- **`npm run versao` antes de cada commit.**
- **Nenhum identificador de modelo de IA** em commits, PRs ou comentários.
- **Medir antes de afirmar.** Diagnóstico sem verificação já custou caro neste
  projeto: o certificado e o "usuário não enxerga os dados" foram os dois casos
  em que a explicação plausível estava errada, e o que resolveu foi reproduzir.
