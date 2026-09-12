'use client';

import { useEffect, useState } from 'react';

const CHAVE = 'msg-tema';

/**
 * Alternador de tema. O padrão é o escuro; a escolha fica no navegador de cada
 * pessoa, sem ida ao servidor.
 */
export function BotaoTema() {
  const [tema, setTema] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const guardado = (() => {
      try {
        return localStorage.getItem(CHAVE);
      } catch {
        return null;
      }
    })();
    const inicial = guardado === 'light' ? 'light' : 'dark';
    setTema(inicial);
    document.documentElement.setAttribute('data-theme', inicial);
  }, []);

  function alternar() {
    const novo = tema === 'dark' ? 'light' : 'dark';
    setTema(novo);
    document.documentElement.setAttribute('data-theme', novo);
    try {
      localStorage.setItem(CHAVE, novo);
    } catch {
      /* navegação privada: a escolha só não persiste */
    }
  }

  return (
    <button
      className="iconbtn"
      type="button"
      onClick={alternar}
      title={tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
      aria-label="Alternar tema"
    >
      {tema === 'dark' ? '☀' : '☾'}
    </button>
  );
}
