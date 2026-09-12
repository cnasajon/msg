import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Marca } from '@/components/marca';
import { BotaoTema } from '@/components/tema';
import { SeletorDeOrganizacao } from '@/components/seletor-organizacao';
import { ArtePainel, ArteTextos, ArteConfiguracao, ArteSistema } from '@/components/ilustracoes';
import { BotaoSair } from '@/components/sair';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { prisma } from '@/lib/db';
import { escopoDeOrganizacao, organizacaoEmVigor } from '@/lib/escopo';

export const dynamic = 'force-dynamic';

const ROTULO_DO_PERFIL = { superadmin: 'Superadmin', admin: 'Admin', usuario: 'Usuário' } as const;

export default async function Inicio() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

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
      titulo: 'Painel de controle',
      sub: 'O que já foi publicado e o que vem a seguir',
      texto:
        'Próxima publicação de cada pasta, próximo texto da fila, últimos publicados e os alertas de erro ou fila curta.',
      atalhos: ['Painel', 'Alertas'],
      visivel: true,
    },
    {
      href: '/textos',
      arte: <ArteTextos />,
      titulo: 'Textos',
      sub: 'Escrever, importar, exportar e conferir o histórico',
      texto:
        'A fila de cada pasta, com imagem opcional e reordenação. Importação de CSV e XLSX, exportação em cinco formatos e o histórico das publicações.',
      atalhos: ['Lista de textos', 'Importação', 'Histórico'],
      visivel: true,
    },
    {
      href: '/pastas',
      arte: <ArteConfiguracao />,
      titulo: 'Configuração',
      sub: 'Pastas, usuários e auditoria da organização',
      texto:
        'Grupos de destino no Telegram, fuso e agendamento de cada pasta, quem tem acesso a quê, e o registro de tudo que foi alterado.',
      atalhos: ['Pastas', 'Usuários', 'Auditoria'],
      visivel: podeFazer(sessao.perfil, 'pastas.gerenciar'),
    },
    {
      href: '/organizacoes',
      arte: <ArteSistema />,
      titulo: 'Sistema',
      sub: 'Organizações e configurações globais',
      texto:
        'Criação e manutenção das organizações, destino dos alertas operacionais e o estado do bot e do dispatcher.',
      atalhos: ['Organizações', 'Configurações globais'],
      visivel: podeFazer(sessao.perfil, 'organizacoes.gerenciar'),
    },
  ].filter((b) => b.visivel);

  const primeiroNome = sessao.nome.split(' ')[0];

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
            <span>{nomeDaOrganizacao ?? '—'}</span>
          </div>
        )}
        <BotaoTema />
      </div>

      <div className="home-hero">
        <h1>Olá, {primeiroNome}.</h1>
        {sessao.perfil === 'superadmin' && !orgEmVigor ? (
          <p>
            Escolha uma organização no seletor acima para operar pastas, textos e usuários. Enquanto
            nenhuma estiver escolhida, você vê apenas as telas de sistema.
          </p>
        ) : (
          <p>
            Você está operando <b>{nomeDaOrganizacao ?? '—'}</b>. Escolha por onde começar.
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
          Entrou como <b>{sessao.nome}</b> · {ROTULO_DO_PERFIL[sessao.perfil]}
        </span>
        <span className="spacer" />
        <BotaoSair token={tokenCsrfPara(sessao.sessaoId)} />
      </div>
    </div>
  );
}
