/**
 * Isolamento entre organizações — ponto não negociável nº 1.
 *
 * Cada teste representa uma tentativa real: alguém autenticado em uma
 * organização troca o identificador na URL pelo de outra. O que se espera é
 * sempre o mesmo: `NaoEncontrado`, nada vazado e nada alterado.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prepararBanco, criarCenario, sessaoDe, temBanco, cliente, type Cenario } from './helpers/banco';
import { comEscopo, escopoDePasta, escopoDeTexto, escopoDeUsuario } from '@/lib/escopo';
import { NaoEncontrado } from '@/lib/erros';

describe.skipIf(!temBanco)('isolamento entre organizações', () => {
  let cenario: Cenario;

  beforeAll(async () => {
    await prepararBanco();
    cenario = await criarCenario();
  });

  afterAll(async () => {
    await cliente().$disconnect();
  });

  it('1. admin de A não alcança a organização B pelo identificador', async () => {
    const sessao = sessaoDe(cenario.a.admin);
    await expect(comEscopo(sessao).organizacao(cenario.b.organizacao.id)).rejects.toThrow(NaoEncontrado);
    // e continua alcançando a própria
    await expect(comEscopo(sessao).organizacao(cenario.a.organizacao.id)).resolves.toMatchObject({
      id: cenario.a.organizacao.id,
    });
  });

  it('2. admin de A não abre a pasta de B pelo identificador da URL', async () => {
    const sessao = sessaoDe(cenario.a.admin);
    await expect(comEscopo(sessao).pasta(cenario.b.pasta.id)).rejects.toThrow(NaoEncontrado);
    await expect(comEscopo(sessao).pasta(cenario.a.pasta.id)).resolves.toMatchObject({
      id: cenario.a.pasta.id,
    });
  });

  it('2b. o alerta de fila curta de B não é silenciado pelo admin de A', async () => {
    // A tela de Alertas recebe o id da pasta do navegador; quem resolve é o
    // mesmo escopo da configuração da pasta, e não há segunda porta.
    const sessao = sessaoDe(cenario.a.admin);
    await expect(comEscopo(sessao).pasta(cenario.b.pasta.id)).rejects.toThrow(NaoEncontrado);

    const antes = await cliente().folder.findUniqueOrThrow({ where: { id: cenario.b.pasta.id } });
    expect(antes.alertaDeFilaCurtaAtivo).toBe(true);
  });

  it('3. admin de A não lê nem altera texto de B', async () => {
    const sessao = sessaoDe(cenario.a.admin);
    await expect(comEscopo(sessao).texto(cenario.b.texto.id)).rejects.toThrow(NaoEncontrado);

    // a tentativa de alterar passa pelo mesmo escopo, então nada é escrito
    const alteradas = await cliente().text.updateMany({
      where: { AND: [{ id: cenario.b.texto.id }, escopoDeTexto(sessao)] },
      data: { conteudo: 'invadido' },
    });
    expect(alteradas.count).toBe(0);

    const intacto = await cliente().text.findUniqueOrThrow({ where: { id: cenario.b.texto.id } });
    expect(intacto.conteudo).toBe('Texto de Organização B');
  });

  it('4. admin de A não baixa a imagem de um texto de B', async () => {
    const sessao = sessaoDe(cenario.a.admin);
    await expect(comEscopo(sessao).imagemDoTexto(cenario.b.texto.id)).rejects.toThrow(NaoEncontrado);

    // a própria imagem continua acessível — o teste falharia por engano se a
    // rota simplesmente nunca devolvesse nada
    const propria = await comEscopo(sessao).imagemDoTexto(cenario.a.texto.id);
    expect(propria.imagem.length).toBeGreaterThan(0);
    expect(propria.imagemMime).toBe('image/png');
  });

  it('5. admin de A não alcança usuário de B, nem para redefinir senha', async () => {
    const sessao = sessaoDe(cenario.a.admin);
    await expect(comEscopo(sessao).usuario(cenario.b.usuario.id)).rejects.toThrow(NaoEncontrado);

    const alterados = await cliente().user.updateMany({
      where: { AND: [{ id: cenario.b.usuario.id }, escopoDeUsuario(sessao)] },
      data: { senhaProvisoria: true },
    });
    expect(alterados.count).toBe(0);
  });

  it('6. usuário só alcança as pastas atribuídas, mesmo dentro da própria organização', async () => {
    const sessao = sessaoDe(cenario.a.usuario, { pastasAtribuidas: [cenario.a.pasta.id] });

    await expect(comEscopo(sessao).pasta(cenario.a.pasta.id)).resolves.toBeTruthy();
    await expect(comEscopo(sessao).pasta(cenario.a.pastaSemAtribuicao.id)).rejects.toThrow(NaoEncontrado);
    await expect(comEscopo(sessao).pasta(cenario.b.pasta.id)).rejects.toThrow(NaoEncontrado);
  });

  it('6b. atribuição forjada de pasta de outra organização não abre porta', async () => {
    // alguém injeta na sessão o identificador de uma pasta de B
    const sessao = sessaoDe(cenario.a.usuario, {
      pastasAtribuidas: [cenario.a.pasta.id, cenario.b.pasta.id],
    });
    await expect(comEscopo(sessao).pasta(cenario.b.pasta.id)).rejects.toThrow(NaoEncontrado);
  });

  it('7. admin de A não consegue selecionar pasta de B para atribuir a alguém', async () => {
    const sessao = sessaoDe(cenario.a.admin);
    const permitidas = await cliente().folder.findMany({
      where: { AND: [{ id: { in: [cenario.b.pasta.id] } }, escopoDePasta(sessao)] },
      select: { id: true },
    });
    expect(permitidas).toHaveLength(0);
  });

  it('8. superadmin vê só a organização ativa, e a troca muda o que ele vê', async () => {
    const emA = sessaoDe(cenario.superadmin, { organizationAtivaId: cenario.a.organizacao.id });
    const emB = sessaoDe(cenario.superadmin, { organizationAtivaId: cenario.b.organizacao.id });

    const textosEmA = await cliente().text.findMany({ where: escopoDeTexto(emA) });
    const textosEmB = await cliente().text.findMany({ where: escopoDeTexto(emB) });

    expect(textosEmA.map((t) => t.id)).toEqual([cenario.a.texto.id]);
    expect(textosEmB.map((t) => t.id)).toEqual([cenario.b.texto.id]);

    await expect(comEscopo(emA).texto(cenario.b.texto.id)).rejects.toThrow(NaoEncontrado);
  });

  it('9. superadmin sem organização ativa não alcança dado de organização nenhuma', async () => {
    const sessao = sessaoDe(cenario.superadmin, { organizationAtivaId: null });

    const textos = await cliente().text.findMany({ where: escopoDeTexto(sessao) });
    const pastas = await cliente().folder.findMany({ where: escopoDePasta(sessao) });
    expect(textos).toHaveLength(0);
    expect(pastas).toHaveLength(0);

    // mas continua enxergando as organizações, que é o que ele administra
    const organizacoes = await cliente().organization.findMany();
    expect(organizacoes).toHaveLength(2);
  });

  it('9b. admin de A não define a senha de ninguém de B', async () => {
    // `definirSenha` recebe o id pelo formulário e resolve pelo mesmo escopo de
    // `redefinirSenha` — não há segunda porta para a senha alheia.
    const sessao = sessaoDe(cenario.a.admin);
    await expect(comEscopo(sessao).usuario(cenario.b.usuario.id)).rejects.toThrow(NaoEncontrado);
    await expect(comEscopo(sessao).usuario(cenario.b.admin.id)).rejects.toThrow(NaoEncontrado);
  });

  it('9c. admin não define a senha do superadmin', async () => {
    // o superadmin não pertence a organização nenhuma, então não entra no
    // escopo de nenhum admin — nem para redefinir, nem para definir à mão
    const sessao = sessaoDe(cenario.a.admin);
    await expect(comEscopo(sessao).usuario(cenario.superadmin.id)).rejects.toThrow(NaoEncontrado);
  });

  it('11. quem participa de duas organizações só alcança uma de cada vez', async () => {
    // a participação amplia para onde a pessoa PODE ir; não mistura o que ela vê
    const emDuas = sessaoDe(
      { ...cenario.a.admin, organizacoes: [cenario.a.organizacao.id, cenario.b.organizacao.id] },
      { organizationAtivaId: cenario.a.organizacao.id },
    );
    await expect(comEscopo(emDuas).pasta(cenario.a.pasta.id)).resolves.toMatchObject({
      id: cenario.a.pasta.id,
    });
    await expect(comEscopo(emDuas).pasta(cenario.b.pasta.id)).rejects.toThrow(NaoEncontrado);

    // troca a organização em vigor: inverte exatamente
    const naOutra = { ...emDuas, organizationAtivaId: cenario.b.organizacao.id };
    await expect(comEscopo(naOutra).pasta(cenario.b.pasta.id)).resolves.toMatchObject({
      id: cenario.b.pasta.id,
    });
    await expect(comEscopo(naOutra).pasta(cenario.a.pasta.id)).rejects.toThrow(NaoEncontrado);
  });

  it('12. organização FORJADA na sessão não dá acesso a quem não participa dela', async () => {
    // o admin de A grava a organização de B como ativa; participa só de A
    const forjada = sessaoDe(cenario.a.admin, { organizationAtivaId: cenario.b.organizacao.id });
    await expect(comEscopo(forjada).pasta(cenario.b.pasta.id)).rejects.toThrow(NaoEncontrado);
    await expect(comEscopo(forjada).organizacao(cenario.b.organizacao.id)).rejects.toThrow(NaoEncontrado);
    // e continua enxergando a sua, em vez de ficar sem nenhuma
    await expect(comEscopo(forjada).pasta(cenario.a.pasta.id)).resolves.toMatchObject({
      id: cenario.a.pasta.id,
    });
  });

  it('10. admin não alcança superadmin pela lista de usuários', async () => {
    const sessao = sessaoDe(cenario.a.admin);
    const usuarios = await cliente().user.findMany({ where: escopoDeUsuario(sessao) });
    expect(usuarios.map((u) => u.perfil)).not.toContain('superadmin');
    await expect(comEscopo(sessao).usuario(cenario.superadmin.id)).rejects.toThrow(NaoEncontrado);
  });
});
