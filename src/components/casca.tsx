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
  children,
}: {
  sessao: SessaoAtual;
  titulo: string;
  caminho?: string;
  atual?: string;
  children: React.ReactNode;
}) {
  const menu = await getTranslations('menu');
  const comum = await getTranslations('comum');
  const perfis = await getTranslations('perfis');

  const organizacoes =
    sessao.perfil === 'superadmin'
      ? await prisma.organization.findMany({
          where: escopoDeOrganizacao(sessao),
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true, ativa: true },
        })
      : [];
  const orgEmVigor = organizacaoEmVigor(sessao);
  const nomeDaOrganizacao =
    sessao.perfil === 'superadmin'
      ? (organizacoes.find((o) => o.id === orgEmVigor)?.nome ?? null)
      : ((
          await prisma.organization.findFirst({
            where: escopoDeOrganizacao(sessao),
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

        <div className="foot">
          <div className="who">{sessao.nome}</div>
          <div className="role">
            {perfis(sessao.perfil)} · {sessao.username}
          </div>
          <div style={{ marginTop: 8 }}>
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
          {sessao.perfil === 'superadmin' ? (
            <SeletorDeOrganizacao organizacoes={organizacoes} ativa={orgEmVigor} />
          ) : (
            <div className="orgpicker">
              <span className="dot" />
              <span>{nomeDaOrganizacao ?? comum('nenhum')}</span>
            </div>
          )}
          <SeletorDeIdioma />
          <BotaoTema />
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
