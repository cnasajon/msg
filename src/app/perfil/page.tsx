import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { Ajuda } from '@/components/ajuda';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { prisma } from '@/lib/db';
import { formatarNoFuso } from '@/lib/fuso';
import { TAMANHO_MINIMO_DA_SENHA } from '@/lib/senha';
import { salvarMeuCadastro, trocarMinhaSenha } from './acoes';

export const dynamic = 'force-dynamic';

/**
 * Os dados que a própria pessoa mantém.
 *
 * Aberta a todos os perfis — é a própria conta, não a de outro. O que define o
 * que alguém **é** no sistema (nome, perfil, situação, pastas) fica na tela de
 * Usuários, com quem administra.
 */
export default async function Perfil({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const t = await getTranslations('perfil');
  const usuarios = await getTranslations('usuarios');
  const comum = await getTranslations('comum');
  const perfis = await getTranslations('perfis');
  const idioma = await getLocale();

  const { erro, ok } = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);

  const eu = await prisma.user.findUniqueOrThrow({
    where: { id: sessao.usuarioId },
    include: { organization: { select: { nome: true } } },
  });

  return (
    <Casca sessao={sessao} titulo={t('titulo')} caminho={t('caminho')} atual="/perfil">
      <Avisos erro={erro} ok={ok} />

      <div className="grid c2">
        <div className="card">
          <header>
            <h2>{t('meusDados')}</h2>
          </header>
          <div className="body">
            <dl className="kv" style={{ marginBottom: 16 }}>
              <dt>{usuarios('nome')}</dt>
              <dd>{eu.nome}</dd>
              <dt>{usuarios('usuario')}</dt>
              <dd>
                <code>{eu.username}</code>
              </dd>
              <dt>{usuarios('perfil')}</dt>
              <dd>
                <span className="pill">{perfis(eu.perfil)}</span>
              </dd>
              <dt>{t('organizacao')}</dt>
              <dd>{eu.organization?.nome ?? <span className="faint">{comum('nenhum')}</span>}</dd>
              <dt>{t('ultimoAcesso')}</dt>
              <dd>
                {eu.ultimoLoginEm ? (
                  formatarNoFuso(eu.ultimoLoginEm, 'America/Sao_Paulo', idioma)
                ) : (
                  <span className="faint">{comum('nenhum')}</span>
                )}
              </dd>
            </dl>
            <p className="faint" style={{ margin: 0 }}>
              {t('quemMudaOResto')}
            </p>
          </div>
        </div>

        <div className="card">
          <header>
            <h2>{t('contato')}</h2>
          </header>
          <div className="body">
            <form action={salvarMeuCadastro}>
              <CampoCsrf token={csrf} />
              <label className="field">
                <span className="lbl">
                  {usuarios('email')} <span className="faint">{usuarios('opcional')}</span>
                  <Ajuda texto={t('emailHint')} rotulo={comum('ajudaSobre', { campo: usuarios('email') })} />
                </span>
                <input type="email" name="email" defaultValue={eu.email ?? ''} />
              </label>
              <label className="field">
                <span className="lbl">
                  {usuarios('telefone')} <span className="faint">{usuarios('opcional')}</span>
                </span>
                <input type="text" name="telefone" defaultValue={eu.telefone ?? ''} />
              </label>
              <label className="field">
                <span className="lbl">
                  {usuarios('telegram')} <span className="faint">{usuarios('opcional')}</span>
                </span>
                <input
                  type="text"
                  name="telegramUsername"
                  defaultValue={eu.telegramUsername ?? ''}
                  placeholder="@usuario"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </label>
              <button className="btn primary" type="submit">
                {comum('salvar')}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="card">
        <header>
          <h2>{t('trocarSenha')}</h2>
        </header>
        <div className="body">
          <form action={trocarMinhaSenha}>
            <CampoCsrf token={csrf} />
            <div className="row">
              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">{t('senhaAtual')}</span>
                <input type="password" name="atual" autoComplete="current-password" required />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">
                  {t('senhaNova')}
                  <Ajuda
                    texto={t('regraDaSenha', { minimo: TAMANHO_MINIMO_DA_SENHA })}
                    rotulo={comum('ajudaSobre', { campo: t('senhaNova') })}
                  />
                </span>
                <input type="password" name="nova" autoComplete="new-password" required />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">{t('repetirSenha')}</span>
                <input type="password" name="repetida" autoComplete="new-password" required />
              </label>
            </div>
            <button className="btn primary" type="submit" style={{ marginTop: 14 }}>
              {t('trocarSenha')}
            </button>
            <p className="faint" style={{ margin: '10px 0 0' }}>
              {t('derrubaSessoes')}
            </p>
          </form>
        </div>
      </div>
    </Casca>
  );
}
