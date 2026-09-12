import Link from 'next/link';
import { Marca } from './marca';
import { BotaoTema } from './tema';
import { SeletorDeOrganizacao } from './seletor-organizacao';
import { BotaoSair } from './sair';
import type { SessaoAtual } from '@/lib/sessao';
import { podeFazer } from '@/lib/autorizacao';
import { prisma } from '@/lib/db';
import { escopoDeOrganizacao, organizacaoEmVigor } from '@/lib/escopo';
import { tokenCsrfPara } from '@/lib/csrf';

type ItemDeMenu = { href: string; ico: string; label: string };
type GrupoDeMenu = { titulo: string; itens: ItemDeMenu[] };

/** Menu na mesma divisão da tela inicial, filtrado pela matriz de permissões. */
function menuPara(sessao: SessaoAtual): GrupoDeMenu[] {
  const grupos: GrupoDeMenu[] = [
    {
      titulo: 'Painel de controle',
      itens: [
        { href: '/painel', ico: '▦', label: 'Painel' },
        { href: '/alertas', ico: '⚠', label: 'Alertas' },
      ],
    },
    {
      titulo: 'Textos',
      itens: [
        { href: '/textos', ico: '☰', label: 'Lista de textos' },
        { href: '/importacao', ico: '⇪', label: 'Importação' },
        { href: '/historico', ico: '↻', label: 'Histórico' },
      ],
    },
  ];

  if (podeFazer(sessao.perfil, 'pastas.gerenciar')) {
    grupos.push({
      titulo: 'Configuração',
      itens: [
        { href: '/pastas', ico: '🗀', label: 'Pastas' },
        { href: '/usuarios', ico: '☺', label: 'Usuários' },
        { href: '/auditoria', ico: '⎘', label: 'Auditoria' },
      ],
    });
  }
  if (podeFazer(sessao.perfil, 'organizacoes.gerenciar')) {
    grupos.push({
      titulo: 'Sistema',
      itens: [
        { href: '/organizacoes', ico: '⬡', label: 'Organizações' },
        { href: '/configuracoes', ico: '⚙', label: 'Configurações globais' },
      ],
    });
  }
  return grupos;
}

const ROTULO_DO_PERFIL = { superadmin: 'Superadmin', admin: 'Admin', usuario: 'Usuário' } as const;

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
            <span className="ico">⌂</span>Início
          </Link>
        </div>

        {menuPara(sessao).map((grupo) => (
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
            {ROTULO_DO_PERFIL[sessao.perfil]} · {sessao.email}
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
              <span>{nomeDaOrganizacao ?? '—'}</span>
            </div>
          )}
          <BotaoTema />
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
