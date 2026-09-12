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
      titulo="Importação"
      caminho="Textos"
      atual="/importacao"
      fase={2}
      descricao="Importação de CSV e XLSX com mapeamento de colunas, data de publicação opcional para trazer histórico, e duplicatas sinalizadas."
    />
  );
}
