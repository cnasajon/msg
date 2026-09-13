'use client';

import { useState } from 'react';

/**
 * Bloco que abre e fecha, com uma contagem ao lado do título.
 *
 * Existe porque a lista de pastas atribuídas era uma pilha de caixas de seleção
 * no fim da página: quem estava editando um usuário não chegava até lá, e a
 * pessoa acabava sem nenhuma pasta — sem ver nada, sem saber por quê. Fechado,
 * o bloco cabe logo abaixo dos dados; a contagem diz o que há dentro sem
 * precisar abrir, e o zero se anuncia sozinho.
 *
 * `<details>` nativo faria o mesmo com menos código, mas não deixa estilizar o
 * marcador de forma consistente entre navegadores, e aqui a contagem precisa de
 * destaque próprio quando está zerada.
 */
export function Sanfona({
  titulo,
  quantidade,
  alerta,
  abertoInicialmente = false,
  children,
}: {
  titulo: string;
  /** Aparece ao lado do título; zero ganha destaque de alerta. */
  quantidade: number;
  /** Frase mostrada quando a contagem é zero. */
  alerta?: string;
  abertoInicialmente?: boolean;
  children: React.ReactNode;
}) {
  // Zerado já nasce aberto: se não há nada dentro, esconder o conteúdo é
  // esconder justamente o que precisa ser resolvido.
  const [aberto, setAberto] = useState(abertoInicialmente || quantidade === 0);
  const vazio = quantidade === 0;

  return (
    <section className="sanfona">
      <button
        type="button"
        className="sanfona-topo"
        aria-expanded={aberto}
        onClick={() => setAberto((estava) => !estava)}
      >
        <span className="sanfona-seta" aria-hidden="true">
          {aberto ? '▾' : '▸'}
        </span>
        <span className="sanfona-titulo">{titulo}</span>
        <span className={vazio ? 'pill err' : 'pill'}>{quantidade}</span>
        {vazio && alerta ? <span className="sanfona-alerta">{alerta}</span> : null}
      </button>
      {aberto ? <div className="sanfona-corpo">{children}</div> : null}
    </section>
  );
}
