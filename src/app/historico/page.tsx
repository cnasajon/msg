import { redirect } from 'next/navigation';
import { EmConstrucao } from '@/components/em-construcao';
import { sessaoAtual } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  return (
    <EmConstrucao
      sessao={sessao}
      titulo="Histórico"
      caminho="Textos"
      atual="/historico"
      fase={3}
      descricao="Histórico das publicações por slot, incluindo as enviadas, as com erro, as perdidas e o histórico importado."
    />
  );
}
