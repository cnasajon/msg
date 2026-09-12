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
      titulo="Alertas"
      caminho="Painel de controle"
      atual="/alertas"
      fase={3}
      descricao="Registro consultável dos alertas operacionais: falha definitiva, slot perdido, fila esgotada, fila curta e falha de autenticação do bot."
    />
  );
}
