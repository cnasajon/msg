import { redirect } from 'next/navigation';
import { EmConstrucao } from '@/components/em-construcao';
import { sessaoAtual } from '@/lib/sessao';
import { podeFazer } from '@/lib/autorizacao';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');
  if (!podeFazer(sessao.perfil, 'pastas.gerenciar')) redirect('/inicio');

  return (
    <EmConstrucao
      sessao={sessao}
      titulo="Pastas"
      caminho="Configuração"
      atual="/pastas"
      fase={2}
      descricao="Pastas com grupo de destino no Telegram, fuso, comportamento ao esgotar a fila, agendamentos e teste de conexão."
    />
  );
}
