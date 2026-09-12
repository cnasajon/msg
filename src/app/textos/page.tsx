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
      titulo="Textos"
      caminho="Textos"
      atual="/textos"
      fase={2}
      descricao="Lista com miniatura, busca, filtro por situação, reordenação por arrastar, arquivamento e exportação em PDF, XLSX, CSV, JSON e XML."
    />
  );
}
