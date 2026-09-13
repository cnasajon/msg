'use client';

import { useRef } from 'react';

/**
 * Select que filtra assim que muda, sem passar pelo botão.
 *
 * O botão "Filtrar" continua na barra: é ele que faz a busca digitada valer, e
 * é o caminho de quem chega ao campo pelo teclado — daí o envio sair no
 * `change`, que o navegador só dispara quando a escolha está fechada, e não a
 * cada opção percorrida com as setas.
 */
export function SelectQueFiltra({
  children,
  ...resto
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const referencia = useRef<HTMLSelectElement>(null);

  return (
    <select
      {...resto}
      ref={referencia}
      onChange={(evento) => {
        resto.onChange?.(evento);
        referencia.current?.form?.requestSubmit();
      }}
    >
      {children}
    </select>
  );
}
