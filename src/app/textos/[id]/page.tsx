import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { EditorDeTexto } from '@/components/editor-texto';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { comEscopo } from '@/lib/escopo';
import { prisma } from '@/lib/db';
import { formatarNoFuso } from '@/lib/fuso';
import { tamanhoDoTexto } from '@/lib/textos';
import { formatarPadraoDeData } from '@/lib/data-da-publicacao';
import { Ajuda } from '@/components/ajuda';
import { campoDoInstante } from '@/lib/data-publicada';
import { siglaDoFuso } from '@/lib/fuso';
import { ajustarDataDePublicada, arquivarTexto, desarquivarTexto, editarTexto, excluirTexto } from '../acoes';
import { publicarAgora, pularTexto, reenviarTexto } from '@/app/pastas/acoes-agenda';

export const dynamic = 'force-dynamic';

export default async function EditarTexto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const t = await getTranslations('editor');
  const lista = await getTranslations('textos');
  const comum = await getTranslations('comum');
  const menu = await getTranslations('menu');
  const idioma = await getLocale();

  const { id } = await params;
  const { erro, ok } = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);

  const texto = await comEscopo(sessao).texto(id);
  const pasta = await prisma.folder.findUniqueOrThrow({
    where: { id: texto.folderId },
    select: { id: true, nome: true, timezone: true, telegramChatId: true, tipoDeLista: true },
  });
  const temImagem = texto.imagem !== null;

  return (
    <Casca
      sessao={sessao}
      titulo={t('editarTextoTitulo')}
      caminho={`${menu('textos')} · ${pasta.nome}`}
      atual="/textos"
    >
      <Avisos erro={erro} ok={ok} />

      {texto.status === 'arquivado' ? (
        <div className="banner warn">
          <div>
            {t('arquivadoDesde', {
              quando: texto.arquivadoEm
                ? formatarNoFuso(texto.arquivadoEm, pasta.timezone, idioma)
                : comum('nenhum'),
            })}
          </div>
        </div>
      ) : null}
      {texto.erroMensagem ? (
        <div className="banner err">
          <div>
            <div className="ttl">{t('ultimaFalhou')}</div>
            {texto.erroMensagem}
          </div>
        </div>
      ) : null}

      <div className="grid c2">
        <div className="card">
          <header>
            <h2>{t('conteudo')}</h2>
          </header>
          <div className="body">
            <form action={editarTexto}>
              <CampoCsrf token={csrf} />
              <input type="hidden" name="id" value={texto.id} />
              <EditorDeTexto
                valorInicial={texto.conteudo}
                temImagemInicial={temImagem}
                urlDaImagem={temImagem ? `/api/textos/${texto.id}/imagem` : null}
                dataInicial={
                  pasta.tipoDeLista === 'data'
                    ? formatarPadraoDeData({
                        dia: texto.diaDaPublicacao,
                        mes: texto.mesDaPublicacao,
                        ano: texto.anoDaPublicacao,
                      })
                    : undefined
                }
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                <button className="btn primary" type="submit">
                  {comum('salvar')}
                </button>
                <Link className="btn" href={`/textos?pasta=${pasta.id}`}>
                  {comum('voltar')}
                </Link>
              </div>
            </form>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <header>
              <h2>{t('preVisualizacao')}</h2>
            </header>
            <div className="body">
              <div className="preview">
                <div className="tg-bubble">
                  {temImagem ? <img src={`/api/textos/${texto.id}/imagem`} alt="" /> : null}
                  <div dangerouslySetInnerHTML={{ __html: texto.conteudo.replace(/\n/g, '<br>') }} />
                </div>
              </div>
              <p className="faint" style={{ margin: '12px 0 0' }}>
                {t('comoVaiSair')}
              </p>
            </div>
          </div>

          <div className="card">
            <header>
              <h2>{lista('situacao')}</h2>
            </header>
            <div className="body">
              <dl className="kv">
                <dt>{menu('pastas')}</dt>
                <dd>{pasta.nome}</dd>
                <dt>{t('grupoDeDestino')}</dt>
                <dd>
                  {pasta.telegramChatId ? (
                    <code>{pasta.telegramChatId}</code>
                  ) : (
                    <span className="faint">{t('naoConfigurado')}</span>
                  )}
                </dd>
                <dt>{lista('situacao')}</dt>
                <dd>
                  <span
                    className={
                      texto.status === 'publicado' ? 'pill ok' : texto.status === 'erro' ? 'pill err' : 'pill'
                    }
                  >
                    {lista(texto.status)}
                  </span>
                </dd>
                <dt>{t('posicaoNaFila')}</dt>
                <dd>
                  {texto.status === 'pendente' ? (
                    texto.ordem
                  ) : (
                    <span className="faint">{t('foraDaFila')}</span>
                  )}
                </dd>
                <dt>{t('tamanho')}</dt>
                <dd>
                  {t('tamanhoValor', {
                    quantidade: tamanhoDoTexto(texto.conteudo),
                    limite: temImagem ? 1024 : 4096,
                  })}
                </dd>
                {texto.imagemBytes ? (
                  <>
                    <dt>{t('imagem')}</dt>
                    <dd>
                      {texto.imagemBytes < 1024
                        ? `${texto.imagemBytes} B`
                        : `${Math.round(texto.imagemBytes / 1024)} KB`}{' '}
                      · <code>{texto.imagemMime}</code>
                      <div className="faint">{texto.imagemNomeOriginal}</div>
                    </dd>
                  </>
                ) : null}
                <dt>{lista('publicadoEm')}</dt>
                <dd>
                  {texto.publicadoEm ? (
                    formatarNoFuso(texto.publicadoEm, pasta.timezone, idioma)
                  ) : (
                    <span className="faint">{t('aindaNao')}</span>
                  )}
                </dd>
              </dl>
            </div>
          </div>

          {/* Informar ou limpar a data de publicação, para quando a publicação
              aconteceu fora daqui. Formulário separado do conteúdo de propósito:
              isto muda a situação do texto, e ninguém deveria mudá-la sem querer
              ao salvar uma vírgula. */}
          <div className="card">
            <header>
              <h2>{t('dataDePublicacao')}</h2>
            </header>
            <div className="body">
              <form action={ajustarDataDePublicada}>
                <CampoCsrf token={csrf} />
                <input type="hidden" name="id" value={texto.id} />
                <label className="field">
                  <span className="lbl">
                    {t('publicadaEm')}
                    <Ajuda
                      texto={t('dataDePublicacaoHint', { fuso: siglaDoFuso(pasta.timezone) })}
                      rotulo={comum('ajudaSobre', { campo: t('publicadaEm') })}
                    />
                  </span>
                  <input
                    type="datetime-local"
                    name="publicadoEm"
                    defaultValue={
                      texto.publicadoEm ? campoDoInstante(texto.publicadoEm, pasta.timezone) : ''
                    }
                  />
                </label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn primary" type="submit">
                    {t('marcarComoPublicado')}
                  </button>
                  {texto.publicadoEm ? (
                    <button
                      className="btn"
                      type="submit"
                      name="limpar"
                      value="1"
                    >
                      {t('limparData')}
                    </button>
                  ) : null}
                </div>
                {texto.publicadoEm ? (
                  <p className="faint" style={{ marginBottom: 0 }}>
                    {t('limparDataAviso')}
                  </p>
                ) : null}
              </form>
            </div>
          </div>

          <div className="card">
            <header>
              <h2>{t('publicar')}</h2>
            </header>
            <div className="body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {texto.status === 'erro' ? (
                <form action={reenviarTexto}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={texto.id} />
                  <input type="hidden" name="destino" value={`/textos/${texto.id}`} />
                  <button className="btn primary" type="submit" disabled={!pasta.telegramChatId}>
                    {t('reenviarAgora')}
                  </button>
                </form>
              ) : (
                <form action={publicarAgora}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={texto.id} />
                  <input type="hidden" name="destino" value={`/textos/${texto.id}`} />
                  <button
                    className="btn primary"
                    type="submit"
                    disabled={!pasta.telegramChatId || texto.status !== 'pendente'}
                  >
                    {lista('publicarAgora')}
                  </button>
                </form>
              )}
              {texto.status === 'pendente' ? (
                <form action={pularTexto}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={texto.id} />
                  <input type="hidden" name="destino" value={`/textos?pasta=${pasta.id}`} />
                  <button className="btn" type="submit">
                    {lista('pular')}
                  </button>
                </form>
              ) : null}
              <span className="faint" style={{ flexBasis: '100%' }}>
                {pasta.telegramChatId ? t('explicacaoPublicar') : t('semChatId')}
              </span>
            </div>
          </div>

          <div className="card">
            <header>
              <h2>{t('tirarDaLista')}</h2>
            </header>
            <div className="body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {texto.status === 'arquivado' ? (
                <form action={desarquivarTexto}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={texto.id} />
                  <input type="hidden" name="destino" value={`/textos/${texto.id}`} />
                  <button className="btn" type="submit">
                    {lista('desarquivar')}
                  </button>
                </form>
              ) : (
                <form action={arquivarTexto}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={texto.id} />
                  <input type="hidden" name="destino" value={`/textos/${texto.id}`} />
                  <button className="btn" type="submit">
                    {lista('arquivar')}
                  </button>
                </form>
              )}
              <form action={excluirTexto}>
                <CampoCsrf token={csrf} />
                <input type="hidden" name="id" value={texto.id} />
                <button className="btn danger" type="submit">
                  {t('excluir')}
                </button>
              </form>
              <span className="faint" style={{ flexBasis: '100%' }}>
                {t('explicacaoTirar')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Casca>
  );
}
