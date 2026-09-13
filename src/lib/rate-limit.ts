/**
 * Limite de tentativas de login, por IP e por conta.
 *
 * A contagem vive na memória do processo — de propósito. É proteção contra
 * força bruta, não contra fraude distribuída, e precisa continuar funcionando
 * mesmo se o banco estiver lento. Com o serviço `web` escalado, cada instância
 * tem a sua contagem; para o objetivo (frear tentativa repetida na mesma
 * conta) isso basta, e o custo de uma tabela a mais no caminho do login não
 * compensaria.
 */

type Janela = { tentativas: number; expiraEm: number };

const JANELA_MS = 15 * 60_000;
const MAX_POR_IP = 30;
const MAX_POR_CONTA = 8;
const MAX_DE_PEDIDOS_POR_IP = 10;
const MAX_DE_PEDIDOS_POR_CONTA = 3;

const porIp = new Map<string, Janela>();
const porConta = new Map<string, Janela>();
// Contadores proprios para o pedido de redefinicao: se ele dividisse a contagem
// com o login, bastaria pedir a senha de alguem varias vezes para trancar a
// pessoa do lado de fora.
const pedidosPorIp = new Map<string, Janela>();
const pedidosPorConta = new Map<string, Janela>();

function registrar(mapa: Map<string, Janela>, chave: string, maximo: number): boolean {
  const agora = Date.now();
  const atual = mapa.get(chave);

  if (!atual || atual.expiraEm < agora) {
    mapa.set(chave, { tentativas: 1, expiraEm: agora + JANELA_MS });
    return true;
  }
  atual.tentativas += 1;
  return atual.tentativas <= maximo;
}

/** `false` quando a tentativa deve ser recusada sem nem olhar a senha. */
export function permiteTentativaDeLogin(ip: string | null, conta: string): boolean {
  const ipOk = ip ? registrar(porIp, ip, MAX_POR_IP) : true;
  const contaOk = registrar(porConta, conta.toLowerCase(), MAX_POR_CONTA);
  return ipOk && contaOk;
}

/** Login bem-sucedido zera o contador daquela conta. */
export function limparTentativas(ip: string | null, conta: string) {
  if (ip) porIp.delete(ip);
  porConta.delete(conta.toLowerCase());
}

/**
 * Pedidos de redefinicao de senha. O limite e mais apertado que o do login: um
 * pedido legitimo acontece uma vez, e cada repeticao vira mensagem no grupo de
 * alertas dos administradores.
 */
export function permitePedidoDeSenha(ip: string | null, conta: string): boolean {
  const ipOk = ip ? registrar(pedidosPorIp, ip, MAX_DE_PEDIDOS_POR_IP) : true;
  const contaOk = registrar(pedidosPorConta, conta.toLowerCase(), MAX_DE_PEDIDOS_POR_CONTA);
  return ipOk && contaOk;
}

/** Só para os testes. */
export function zerarContadores() {
  porIp.clear();
  porConta.clear();
  pedidosPorIp.clear();
  pedidosPorConta.clear();
}
