import { redirect } from 'next/navigation';
import { Marca } from '@/components/marca';
import { BotaoTema } from '@/components/tema';
import { sessaoAtual } from '@/lib/sessao';
import { FormularioDeLogin } from './formulario';

export const dynamic = 'force-dynamic';

export default async function Entrar() {
  if (await sessaoAtual()) redirect('/inicio');

  return (
    <>
      <div className="mockctl floating" style={{ position: 'fixed', top: 14, right: 16 }}>
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
              <FormularioDeLogin />
              <p className="faint" style={{ margin: '14px 0 0', textAlign: 'center' }}>
                Esqueceu a senha? Um administrador da sua organização redefine para você.
                <br />
                Não há cadastro público.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
