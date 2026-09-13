import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Marca } from './marca';
import { BotaoTema } from './tema';
import { SeletorDeIdioma } from './seletor-idioma';
import { Rodape } from './rodape';

/**
 * Moldura das páginas de política de privacidade e termos de serviço.
 *
 * Públicas de propósito: são linkadas do rodapé da tela de entrada, e um
 * documento legal que só quem já entrou consegue ler não cumpre o papel.
 */
export async function PaginaLegal({
  titulo,
  atualizadoEm,
  secoes,
}: {
  titulo: string;
  atualizadoEm: string;
  secoes: { titulo: string; corpo: string }[];
}) {
  const comum = await getTranslations('comum');

  return (
    <>
      <div className="mockctl floating" style={{ position: 'fixed', top: 14, right: 16 }}>
        <SeletorDeIdioma />
        <BotaoTema />
      </div>
      <div className="legal">
        <Link className="brand" href="/entrar" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Marca />
          <div>
            <div className="name">msg</div>
            <div className="env">msg.oa12.org</div>
          </div>
        </Link>

        <h1>{titulo}</h1>
        <p className="faint">{atualizadoEm}</p>

        {secoes.map((secao) => (
          <section key={secao.titulo}>
            <h2>{secao.titulo}</h2>
            <p>{secao.corpo}</p>
          </section>
        ))}

        <p style={{ marginTop: 28 }}>
          <Link href="/entrar">{comum('voltar')}</Link>
        </p>
        <footer className="rodape">
          <Rodape />
        </footer>
      </div>
    </>
  );
}
