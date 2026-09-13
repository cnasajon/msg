'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * Balão de ajuda ao lado do rótulo de um campo.
 *
 * Existe para a explicação sair de baixo da caixa de texto: quando um campo tem
 * texto de apoio e o vizinho não, as caixas da mesma linha deixam de terminar na
 * mesma altura e o formulário fica desalinhado.
 *
 * Abre no passar do mouse e também no clique — só o hover deixaria a explicação
 * inalcançável em telefone e por teclado.
 *
 * `texto` aceita conteúdo rico, e não apenas string, porque boa parte das
 * explicações traz trecho em destaque ou nome de tag em `<code>`.
 */
export function Ajuda({ texto, rotulo }: { texto: React.ReactNode; rotulo: string }) {
  const id = useId();
  const area = useRef<HTMLSpanElement>(null);
  const [aberto, setAberto] = useState(false);
  const [fixado, setFixado] = useState(false);

  // Clique fora e Escape fecham o que foi aberto por clique; sem isso o balão
  // fica presevado na tela depois que a pessoa já seguiu para outro campo.
  useEffect(() => {
    if (!fixado) return;

    function aoClicar(evento: MouseEvent) {
      if (!area.current?.contains(evento.target as Node)) {
        setFixado(false);
        setAberto(false);
      }
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setFixado(false);
        setAberto(false);
      }
    }

    document.addEventListener('mousedown', aoClicar);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicar);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [fixado]);

  return (
    <span className="ajuda" ref={area}>
      <button
        type="button"
        className="ajuda-marca"
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-describedby={aberto ? id : undefined}
        onClick={() => {
          setFixado((estava) => !estava);
          setAberto((estava) => !estava || !fixado);
        }}
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => !fixado && setAberto(false)}
        onFocus={() => setAberto(true)}
        onBlur={() => !fixado && setAberto(false)}
      >
        ?
      </button>
      {aberto ? (
        <span className="ajuda-balao" id={id} role="tooltip">
          {texto}
        </span>
      ) : null}
    </span>
  );
}
