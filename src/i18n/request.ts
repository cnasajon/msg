import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { organizacaoEmVigor } from '@/lib/escopo';
import { sessaoAtual } from '@/lib/sessao';
import { COOKIE_DE_IDIOMA, IDIOMA_PADRAO, idiomaValido as valido, type Idioma } from './idiomas';

/**
 * Idioma da interface.
 *
 * Sem rota por idioma: o endereço é o mesmo para todo mundo, e o idioma vem de
 * quem está olhando — a preferência do usuário, senão o padrão da organização,
 * senão português. Assim um link enviado por um admin brasileiro abre em
 * espanhol para quem é da OA España, sem ninguém trocar nada.
 *
 * Visitante sem sessão (tela de entrada) pode escolher pelo seletor, que grava
 * um cookie.
 */

export async function idiomaEmVigor(): Promise<Idioma> {
  const sessao = await sessaoAtual().catch(() => null);

  if (sessao) {
    const doUsuario = valido(sessao.idioma);
    if (doUsuario) return doUsuario;

    // O idioma segue a organização que está sendo operada agora: quem participa
    // de duas vê cada uma no idioma dela.
    const organizationId = organizacaoEmVigor(sessao);
    if (organizationId) {
      const organizacao = await prisma.organization
        .findUnique({ where: { id: organizationId }, select: { idiomaPadrao: true } })
        .catch(() => null);
      const daOrganizacao = valido(organizacao?.idiomaPadrao);
      if (daOrganizacao) return daOrganizacao;
    }
  }

  const jar = await cookies().catch(() => null);
  return valido(jar?.get(COOKIE_DE_IDIOMA)?.value) ?? IDIOMA_PADRAO;
}

export default getRequestConfig(async () => {
  const locale = await idiomaEmVigor();
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
