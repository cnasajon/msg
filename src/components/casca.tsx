import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Marca } from './marca';
import { BotaoTema } from './tema';
import { SeletorDeOrganizacao } from './seletor-organizacao';
import { BotaoSair } from './sair';
import { SeletorDeIdioma } from './seletor-idioma';
import type { SessaoAtual } from '@/lib/sessao';
import { podeFazer } from '@/lib/autorizacao';
import { prisma } from '@/lib/db';
import { escopoDeOrganizacao, organizacaoEmVigor } from '@/lib/escopo';
import { tokenCsrfPara } from '@/lib/csrf';
import { Rodape } from './rodape';

type ItemDeMenu = { href: string; ico: string; label: string };
type GrupoDeMenu = { titulo: string; itens: ItemDeMenu[] };

/** Menu na mesma divisão da tela inicial, filtrado pela matriz de permissões. */
function menuPara(sessao: SessaoAtual, t: (chave: string) => string): GrupoDeMenu[] {
  const grupos: GrupoDeMenu[] = [
    {
      titulo: t('painelDeControle'),
      itens: [
        { href: '/painel', ico: '▦', label: t('painel') },
        { href: '/alertas', ico: '⚠', label: t('alertas') },
      ],
    },
    {
      titulo: t('textos'),
      itens: [
        { href: '/textos', ico: '☰', label: t('listaDeTextos') },
        { href: '/importacao', ico: '⇪', label: t('importacao') },
        { href: '/historico', ico: '↻', label: t('historico') },
      ],
    },
  ];

  if (podeFazer(sessao.perfil, 'pastas.gerenciar')) {
    grupos.push({
      titulo: t('configuracao'),
      itens: [
        { href: '/pastas', ico: '🗀', label: t('pastas') },
        { href: '/usuarios', ico: '☺', label: t('usuarios') },
        { href: '/auditoria', ico: '⎘', label: t('auditoria') },
      ],
    });
  }
  if (podeFazer(sessao.perfil, 'organizacoes.gerenciar')) {
    grupos.push({
      titulo: t('sistema'),
      itens: [
        { href: '/organizacoes', ico: '⬡', label: t('organizacoes') },
        { href: '/configuracoes', ico: '⚙', label: t('configuracoesGlobais') },
      ],
    });
  }
  return grupos;
}

export async function Casca({
  sessao,
  titulo,
  caminho,
  atual,
  largo = false,
  children,
}: {
  sessao: SessaoAtual;
  titulo: string;
  caminho?: string;
  atual?: string;
  /**
   * Solta o limite de largura do conteúdo. Para telas cujo miolo é uma tabela
   * de leitura: o teto de 1180px existe para o texto corrido de formulário não
   * virar linha longa demais, e numa tabela ele só desperdiça a tela.
   */
  largo?: boolean;
  children: React.ReactNode;
}) {
  const menu = await getTranslations('menu');
  const comum = await getTranslations('comum');
  const perfis = await getTranslations('perfis');

  // O seletor vale para quem tem mais de uma organização — o superadmin sempre,
  // porque alcança todas, e agora também quem participa de várias.
  const organizacoes =
    sessao.perfil === 'superadmin' || sessao.organizacoes.length > 1
      ? await prisma.organization.findMany({
          where: escopoDeOrganizacao(sessao),
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true, ativa: true },
        })
      : [];
  const orgEmVigor = organizacaoEmVigor(sessao);
  const podeTransitar = organizacoes.length > 0;
  const nomeDaOrganizacao = podeTransitar
    ? (organizacoes.find((o) => o.id === orgEmVigor)?.nome ?? null)
    : ((
        await prisma.organization.findFirst({
          where: orgEmVigor ? { id: orgEmVigor } : escopoDeOrganizacao(sessao),
          select: { nome: true },
        })
      )?.nome ?? null);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/inicio" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Marca />
          <div>
            <div className="name">msg</div>
            <div className="env">msg.oa12.org</div>
          </div>
        </Link>

        <div className="navgroup nav">
          <Link href="/inicio">
            <span className="ico">⌂</span>
            {menu('inicio')}
          </Link>
        </div>

        {menuPara(sessao, menu).map((grupo) => (
          <div className="navgroup nav" key={grupo.titulo}>
            <h4>{grupo.titulo}</h4>
            {grupo.itens.map((item) => (
              <Link key={item.href} href={item.href} className={atual === item.href ? 'active' : undefined}>
                <span className="ico">{item.ico}</span>
                {item.label}
              </Link>
            ))}
          </div>
        ))}

        {/* Logo depois do menu, e não colado no fim da barra: com muitos itens
            a barra rolava, e Perfil e Sair ficavam abaixo da dobra — quem quer
            sair não deveria ter de procurar. */}
        <div className="quem-sou">
          <div className="who">{sessao.nome}</div>
          <div className="role">
            {perfis(sessao.perfil)} · {sessao.username}
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/perfil" style={{ fontSize: '12.5px' }}>
              {menu('perfil')}
            </Link>
            <BotaoSair token={tokenCsrfPara(sessao.sessaoId)} />
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div>
            {caminho ? <div className="crumb">{caminho}</div> : null}
            <h1>{titulo}</h1>
          </div>
          <span className="spacer" />
          {podeTransitar ? (
            <SeletorDeOrganizacao
              organizacoes={organizacoes}
              ativa={orgEmVigor}
              permiteNenhuma={sessao.perfil === 'superadmin'}
            />
          ) : (
            <div className="orgpicker">
              <span className="dot" />
              <span>{nomeDaOrganizacao ?? comum('nenhum')}</span>
            </div>
          )}
          <SeletorDeIdioma />
          <BotaoTema />
        </div>
        <div className={largo ? 'content largo' : 'content'}>{children}</div>
        <footer className="rodape">
          <Rodape />
        </footer>
      </div>
    </div>
  );
}
