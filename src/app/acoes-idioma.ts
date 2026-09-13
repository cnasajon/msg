'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao';
import { COOKIE_DE_IDIOMA, IDIOMAS } from '@/i18n/idiomas';

/**
 * Troca o idioma da interface. Com sessão, a escolha vira preferência do
 * usuário e o acompanha em qualquer navegador; sem sessão, fica num cookie,
 * porque não há onde guardar.
 */
export async function trocarIdiomaDaSessao(escolhido: string) {
  if (!IDIOMAS.includes(escolhido as (typeof IDIOMAS)[number])) return;

  const jar = await cookies();
  jar.set(COOKIE_DE_IDIOMA, escolhido, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 3600,
  });

  const sessao = await sessaoAtual();
  if (sessao) {
    await prisma.user.update({
      where: { id: sessao.usuarioId },
      data: { idioma: escolhido as 'pt' | 'es' | 'en' },
    });
  }
  revalidatePath('/', 'layout');
}
