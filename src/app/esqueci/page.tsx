import { redirect } from 'next/navigation';
import { Marca } from '@/components/marca';
import { BotaoTema } from '@/components/tema';
import { SeletorDeIdioma } from '@/components/seletor-idioma';
import { sessaoAtual } from '@/lib/sessao';
import { FormularioDeEsquecimento } from './formulario';

export const dynamic = 'force-dynamic';

export default async function Esqueci() {
  if (await sessaoAtual()) redirect('/inicio');

  return (
    <>
      <div className="mockctl floating" style={{ position: 'fixed', top: 14, right: 16 }}>
        <SeletorDeIdioma />
        <BotaoTema />
      </div>
      <div className="auth">
        <div className="box">
          <div className="brand">
            <Marca />
            <div>
              <div className="name">msg</div>
              <div className="env">msg.oa12.org</div>
            </div>
          </div>
          <div className="card">
            <div className="body">
              <FormularioDeEsquecimento />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
