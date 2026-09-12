import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

export default async function Raiz() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');
  redirect('/inicio');
}
