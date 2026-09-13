'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirCsrf } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { NaoAutorizado } from '@/lib/erros';
import { comEscopo } from '@/lib/escopo';
import { registrarAuditoria } from '@/lib/auditoria';
import { comAviso } from '@/lib/navegacao';
import { tradutorDeAvisos } from '@/lib/avisos-servidor';

/**
 * Alerta de fila curta de uma pasta, editado direto na tela de Alertas.
 *
 * A chave e o número são campos da pasta; o que esta ação acrescenta é o
 * caminho curto — quem está olhando os alertas silencia ou ajusta ali mesmo,
 * sem passar pela configuração da pasta.
 */
export async function salvarAlertaDeFilaCurta(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  // Mexer na pasta é de admin para cima, como em qualquer outra tela.
  if (!podeFazer(sessao.perfil, 'pastas.gerenciar')) throw new NaoAutorizado();

  const { t } = await tradutorDeAvisos();

  // O id vem do navegador: quem resolve é o escopo, e id de outra organização
  // não chega aqui — é a mesma porta por onde passa a configuração da pasta.
  const pasta = await comEscopo(sessao).pasta(String(dados.get('id') ?? ''));

  const ativo = dados.get('alertaDeFilaCurtaAtivo') === 'on';
  const minimo = Number(dados.get('alertarAbaixoDe') ?? pasta.alertarAbaixoDe);

  if (!Number.isInteger(minimo) || minimo < 1 || minimo > 999) {
    redirect(comAviso('/alertas', 'erro', t('alertarAbaixoDeInvalido')));
  }

  await prisma.folder.update({
    where: { id: pasta.id },
    data: { alertaDeFilaCurtaAtivo: ativo, alertarAbaixoDe: minimo },
  });

  await registrarAuditoria(sessao, {
    acao: 'editar',
    entidade: 'folder',
    entidadeId: pasta.id,
    detalhes: {
      alertaDeFilaCurtaAtivo: ativo,
      alertarAbaixoDe: minimo,
      de: { alertaDeFilaCurtaAtivo: pasta.alertaDeFilaCurtaAtivo, alertarAbaixoDe: pasta.alertarAbaixoDe },
    },
  });

  redirect(comAviso('/alertas', 'ok', t('alertaDaPastaSalvo', { pasta: pasta.nome })));
}
