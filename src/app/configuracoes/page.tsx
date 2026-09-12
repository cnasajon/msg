import { redirect } from 'next/navigation';
import { EmConstrucao } from '@/components/em-construcao';
import { sessaoAtual } from '@/lib/sessao';
import { podeFazer } from '@/lib/autorizacao';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');
  if (!podeFazer(sessao.perfil, 'alertas.configurarDestino')) redirect('/inicio');

  return (
    <EmConstrucao
      sessao={sessao}
      titulo="Configurações globais"
      caminho="Sistema · só superadmin"
      atual="/configuracoes"
      fase={3}
      descricao="Destino dos alertas (chat do Telegram e webhook do Google Chat), com teste por canal e a precedência da seção 7.4."
    />
  );
}
