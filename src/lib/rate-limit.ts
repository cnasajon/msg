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

const porIp = new Map<string, Janela>();
const porConta = new Map<string, Janela>();

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
export function permiteTentativaDeLogin(ip: string | null, email: string): boolean {
  const ipOk = ip ? registrar(porIp, ip, MAX_POR_IP) : true;
  const contaOk = registrar(porConta, email.toLowerCase(), MAX_POR_CONTA);
  return ipOk && contaOk;
}

/** Login bem-sucedido zera o contador daquela conta. */
export function limparTentativas(ip: string | null, email: string) {
  if (ip) porIp.delete(ip);
  porConta.delete(email.toLowerCase());
}

/** Só para os testes. */
export function zerarContadores() {
  porIp.clear();
  porConta.clear();
}
