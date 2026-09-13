/**
 * Isolamento pela URL, agora nas rotas de verdade.
 *
 * Os testes de `isolamento.test.ts` provam a regra na camada de dados; estes
 * provam que a interface não tem atalho por fora dela. Rodam quando há um
 * servidor de pé (`MSG_BASE_URL`) apontando para o banco de teste:
 *
 *   npm run build && TEST_DATABASE_URL=… DATABASE_URL=… npm run start:web &
 *   MSG_BASE_URL=http://localhost:3000 TEST_DATABASE_URL=… npx vitest run tests/rotas-http.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac, randomBytes } from 'node:crypto';
import { prepararBanco, criarCenario, temBanco, cliente, pngDeTeste, type Cenario } from './helpers/banco';

const BASE = process.env.MSG_BASE_URL ?? null;

/** Cria uma sessão direto no banco e devolve o cookie correspondente. */
async function cookieDeSessao(userId: string, organizationAtivaId: string | null) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHmac('sha256', process.env.SESSION_SECRET!).update(token).digest('hex');
  await cliente().session.create({
    data: {
      userId,
      tokenHash,
      organizationAtivaId,
      expiraEm: new Date(Date.now() + 3_600_000),
    },
  });
  return `msg_sessao=${token}`;
}

function buscar(caminho: string, cookie?: string) {
  return fetch(`${BASE}${caminho}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
}

describe.skipIf(!temBanco || !BASE)('isolamento nas rotas HTTP', () => {
  let cenario: Cenario;
  let cookieAdminA: string;
  let cookieUsuarioA: string;

  beforeAll(async () => {
    await prepararBanco();
    cenario = await criarCenario();
    cookieAdminA = await cookieDeSessao(cenario.a.admin.id, null);
    cookieUsuarioA = await cookieDeSessao(cenario.a.usuario.id, null);
  });

  afterAll(async () => {
    await cliente().$disconnect();
  });

  it('sem sessão, tudo leva à tela de entrada', async () => {
    for (const rota of ['/', '/inicio', '/usuarios', '/organizacoes', '/textos']) {
      const resposta = await buscar(rota);
      expect([302, 307, 308]).toContain(resposta.status);
      expect(resposta.headers.get('location')).toContain('/entrar');
    }
  });

  it('o health check responde sem sessão', async () => {
    const resposta = await buscar('/health');
    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toMatchObject({ ok: true, banco: 'ok' });
  });

  it('admin de A abre a própria lista de usuários e vê só os seus', async () => {
    const resposta = await buscar('/usuarios', cookieAdminA);
    const html = await resposta.text();
    expect(resposta.status).toBe(200);
    expect(html).toContain(cenario.a.usuario.nome);
    expect(html).not.toContain(cenario.b.usuario.nome);
    expect(html).not.toContain(cenario.b.admin.username);
    expect(html).not.toContain(cenario.b.admin.email!);
  });

  it('admin de A não abre usuário de B trocando o id na URL', async () => {
    const resposta = await buscar(`/usuarios?editar=${cenario.b.usuario.id}`, cookieAdminA);
    const html = await resposta.text();
    expect(resposta.status).toBe(200);
    // a tela abre, mas sem nenhum dado de B: o identificador simplesmente não
    // resolve para nada dentro do escopo
    expect(html).not.toContain(cenario.b.usuario.nome);
    expect(html).not.toContain(cenario.b.usuario.username);
    expect(html).not.toContain(cenario.b.usuario.email!);
    expect(html).toContain('Novo usuário');
  });

  it('admin não entra nas telas de sistema, mesmo digitando a URL', async () => {
    const resposta = await buscar('/organizacoes', cookieAdminA);
    expect([302, 307, 308]).toContain(resposta.status);
    expect(resposta.headers.get('location')).toContain('/inicio');
  });

  it('perfil usuário não entra em usuários nem em pastas', async () => {
    for (const rota of ['/usuarios', '/pastas', '/organizacoes', '/auditoria']) {
      const resposta = await buscar(rota, cookieUsuarioA);
      expect([302, 307, 308]).toContain(resposta.status);
      expect(resposta.headers.get('location')).toContain('/inicio');
    }
  });

  it('a tela inicial mostra só os blocos do perfil', async () => {
    const doUsuario = await (await buscar('/inicio', cookieUsuarioA)).text();
    expect(doUsuario).toContain('Painel de controle');
    expect(doUsuario).toContain('Textos');
    expect(doUsuario).not.toContain('Organizações e configurações globais');

    const doAdmin = await (await buscar('/inicio', cookieAdminA)).text();
    expect(doAdmin).toContain('Pastas, usuários e auditoria da organização');
    expect(doAdmin).not.toContain('Organizações e configurações globais');
  });

  it('a imagem de um texto é servida para quem pode vê-la', async () => {
    const resposta = await buscar(`/api/textos/${cenario.a.texto.id}/imagem`, cookieAdminA);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toBe('image/png');
    const corpo = new Uint8Array(await resposta.arrayBuffer());
    expect(corpo.byteLength).toBeGreaterThan(0);
    // PNG de verdade: assinatura nos primeiros bytes
    expect([corpo[0], corpo[1], corpo[2], corpo[3]]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('IMAGEM DE OUTRA ORGANIZAÇÃO: admin de A pede a de B e recebe 404, sem byte nenhum', async () => {
    const resposta = await buscar(`/api/textos/${cenario.b.texto.id}/imagem`, cookieAdminA);
    expect(resposta.status).toBe(404);
    const corpo = new Uint8Array(await resposta.arrayBuffer());
    expect(corpo.byteLength).toBeLessThan(64); // só a mensagem de erro
    expect(resposta.headers.get('content-type')).not.toMatch(/^image\//);
  });

  it('a rota de imagem exige sessão', async () => {
    const resposta = await buscar(`/api/textos/${cenario.a.texto.id}/imagem`);
    expect(resposta.status).toBe(401);
  });

  it('usuário não alcança imagem de pasta que não lhe foi atribuída', async () => {
    // o usuário de A tem a pasta principal; este texto está na pasta reservada
    const textoReservado = await cliente().text.create({
      data: {
        folderId: cenario.a.pastaSemAtribuicao.id,
        conteudo: 'Texto da pasta reservada',
        ordem: 1,
        hashConteudo: `reservado-${Date.now()}`,
        imagem: pngDeTeste(),
        imagemMime: 'image/png',
      },
    });
    const resposta = await buscar(`/api/textos/${textoReservado.id}/imagem`, cookieUsuarioA);
    expect(resposta.status).toBe(404);
  });

  it('exportação: admin de A não exporta pasta de B', async () => {
    const daPropria = await buscar(`/api/exportacao?pasta=${cenario.a.pasta.id}&formato=json`, cookieAdminA);
    expect(daPropria.status).toBe(200);
    const conteudo = await daPropria.json();
    expect(conteudo.textos.some((t: { conteudo: string }) => t.conteudo.includes('Organização A'))).toBe(true);
    expect(JSON.stringify(conteudo)).not.toContain('Organização B');

    const daOutra = await buscar(`/api/exportacao?pasta=${cenario.b.pasta.id}&formato=json`, cookieAdminA);
    expect(daOutra.status).toBe(404);
  });

  it('pré-visualização da importação exige sessão', async () => {
    const resposta = await fetch(`${BASE}/api/importacao/previa`, { method: 'POST', body: new FormData() });
    expect(resposta.status).toBe(401);
  });

  it('sessão de usuário desativado para de valer na hora', async () => {
    await cliente().user.update({ where: { id: cenario.a.usuario.id }, data: { ativo: false } });
    const resposta = await buscar('/inicio', cookieUsuarioA);
    expect([302, 307, 308]).toContain(resposta.status);
    expect(resposta.headers.get('location')).toContain('/entrar');
    await cliente().user.update({ where: { id: cenario.a.usuario.id }, data: { ativo: true } });
  });
});
