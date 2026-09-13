import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Marca } from '@/components/marca';
import { BotaoTema } from '@/components/tema';
import { SeletorDeOrganizacao } from '@/components/seletor-organizacao';
import { ArtePainel, ArteTextos, ArteConfiguracao, ArteSistema } from '@/components/ilustracoes';
import { BotaoSair } from '@/components/sair';
import { SeletorDeIdioma } from '@/components/seletor-idioma';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { prisma } from '@/lib/db';
import { escopoDeOrganizacao, organizacaoEmVigor } from '@/lib/escopo';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const t = await getTranslations('inicio');
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

  const blocos = [
    {
      href: '/painel',
      arte: <ArtePainel />,
      titulo: menu('painelDeControle'),
      sub: t('blocoPainelSub'),
      texto: t('blocoPainelTexto'),
      atalhos: [menu('painel'), menu('alertas')],
      visivel: true,
    },
    {
      href: '/textos',
      arte: <ArteTextos />,
      titulo: menu('textos'),
      sub: t('blocoTextosSub'),
      texto: t('blocoTextosTexto'),
      atalhos: [menu('listaDeTextos'), menu('importacao'), menu('historico')],
      visivel: true,
    },
    {
      href: '/pastas',
      arte: <ArteConfiguracao />,
      titulo: menu('configuracao'),
      sub: t('blocoConfiguracaoSub'),
      texto: t('blocoConfiguracaoTexto'),
      atalhos: [menu('pastas'), menu('usuarios'), menu('auditoria')],
      visivel: podeFazer(sessao.perfil, 'pastas.gerenciar'),
    },
    {
      href: '/organizacoes',
      arte: <ArteSistema />,
      titulo: menu('sistema'),
      sub: t('blocoSistemaSub'),
      texto: t('blocoSistemaTexto'),
      atalhos: [menu('organizacoes'), menu('configuracoesGlobais')],
      visivel: podeFazer(sessao.perfil, 'organizacoes.gerenciar'),
    },
  ].filter((b) => b.visivel);

  // `split` pode devolver vazio para um nome só com espaços; o nome inteiro serve de reserva
  const primeiroNome = sessao.nome.split(' ')[0] || sessao.nome;

  return (
    <div className="home">
      <div className="home-top">
        <Link className="brand" href="/inicio" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Marca />
          <div>
            <div className="name">msg</div>
            <div className="env">msg.oa12.org</div>
          </div>
        </Link>
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

      <div className="home-hero">
        <h1>{t('saudacao', { nome: primeiroNome })}</h1>
        {sessao.perfil === 'superadmin' && !orgEmVigor ? (
          <p>{t('escolhaOrganizacao')}</p>
        ) : (
          <p>
            {t.rich('operando', {
              organizacao: nomeDaOrganizacao ?? comum('nenhum'),
              b: (partes) => <b>{partes}</b>,
            })}
          </p>
        )}
      </div>

      <div className="tiles">
        {blocos.map((b) => (
          <Link className="tile" href={b.href} key={b.titulo}>
            <div className="art">{b.arte}</div>
            <div className="tile-body">
              <h2>{b.titulo}</h2>
              <p className="sub">{b.sub}</p>
              <p className="txt">{b.texto}</p>
              <div className="tile-links">
                {b.atalhos.map((a) => (
                  <span key={a}>{a}</span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="home-foot">
        <span className="faint">
          {comum('entrouComo')} <b>{sessao.nome}</b> · {perfis(sessao.perfil)}
        </span>
        <span className="spacer" />
        <BotaoSair token={tokenCsrfPara(sessao.sessaoId)} />
      </div>
    </div>
  );
}
