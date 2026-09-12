import { redirect } from 'next/navigation';
import { EmConstrucao } from '@/components/em-construcao';
import { sessaoAtual } from '@/lib/sessao';
import { podeFazer } from '@/lib/autorizacao';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');
  if (!podeFazer(sessao.perfil, 'auditoria.ver')) redirect('/inicio');

  return (
    <EmConstrucao
      sessao={sessao}
      titulo="Auditoria"
      caminho="Configuração"
      atual="/auditoria"
      fase={4}
      descricao="Log de auditoria de criações, edições, exclusões, publicações e trocas de organização. Os eventos já estão sendo gravados desde agora."
    />
  );
}
