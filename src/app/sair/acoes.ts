'use server';

import { redirect } from 'next/navigation';
import { encerrarSessaoAtual } from '@/lib/sessao';
import { exigirCsrf } from '@/lib/csrf';

/**
 * Sair. É uma ação POST com verificação de CSRF, e não um link GET, por dois
 * motivos: um GET que encerra sessão é derrubado por qualquer prefetch do
 * navegador — o Next busca links antes do clique, e a sessão morria sozinha —,
 * e um endereço que desloga por GET é um convite a CSRF de logout.
 */
export async function sair(dados: FormData) {
  await exigirCsrf(dados);
  await encerrarSessaoAtual();
  redirect('/entrar');
}
