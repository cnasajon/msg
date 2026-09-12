import { redirect } from 'next/navigation';
import { Marca } from '@/components/marca';
import { BotaoTema } from '@/components/tema';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { trocarSenha } from './acoes';

export const dynamic = 'force-dynamic';

export default async function PrimeiroAcesso({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  const { erro } = await searchParams;

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
              <div className="env">Primeiro acesso</div>
            </div>
          </div>
          <div className="card">
            <div className="body">
              <Avisos erro={erro} />
              {sessao.senhaProvisoria ? (
                <div className="banner warn" style={{ marginBottom: 16 }}>
                  <div>
                    <div className="ttl">Senha provisória</div>
                    Sua conta foi criada com senha provisória. Defina uma senha nova para continuar.
                  </div>
                </div>
              ) : null}

              <form action={trocarSenha}>
                <CampoCsrf token={tokenCsrfPara(sessao.sessaoId)} />
                <label className="field">
                  <span className="lbl">Senha atual</span>
                  <input type="password" name="atual" autoComplete="current-password" required />
                </label>
                <label className="field">
                  <span className="lbl">Nova senha</span>
                  <input type="password" name="nova" autoComplete="new-password" required minLength={8} />
                  <span className="hint">
                    Pelo menos 8 caracteres, com uma letra maiúscula, um número e um caractere
                    especial. Armazenada com argon2id.
                  </span>
                </label>
                <label className="field">
                  <span className="lbl">Repita a nova senha</span>
                  <input type="password" name="repetida" autoComplete="new-password" required minLength={8} />
                </label>
                <button className="btn primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
                  Salvar e entrar
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
