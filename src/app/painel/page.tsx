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
      titulo="Painel"
      caminho="Painel de controle"
      atual="/painel"
      fase={4}
      descricao="Próxima publicação de cada pasta, próximo texto da fila, últimos publicados com miniatura e os avisos de fila curta."
    />
  );
}
