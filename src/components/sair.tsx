import { CampoCsrf } from './csrf';
import { sair } from '@/app/sair/acoes';

/** Botão de sair, com a aparência de link. */
export function BotaoSair({ token }: { token: string }) {
  return (
    <form action={sair} style={{ display: 'inline' }}>
      <CampoCsrf token={token} />
      <button
        type="submit"
        className="faint"
        style={{
          background: 'none',
          border: 0,
          padding: 0,
          font: 'inherit',
          fontSize: '12.5px',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        Sair
      </button>
    </form>
  );
}
