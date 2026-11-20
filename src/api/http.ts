/**
 * Cliente HTTP do checkout, sempre pelo gateway: `VITE_API_URL` é a base (ex.: http://localhost:8080/api) e cada
 * serviço tem o próprio prefixo (`/pedidos`, `/pagamentos`). O token vem do shell (`props.getToken`).
 */

/** Erro de HTTP com a explicação que o backend mandou (problem+json: detalhe). */
export class ErroDeApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export type ObterToken = () => Promise<string | null>;

const baseUrl = () => (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function mensagemDoErro(resposta: Response): Promise<string> {
  try {
    const problema = (await resposta.json()) as { detail?: string };
    if (problema.detail) return problema.detail;
  } catch {
    // corpo vazio ou que não é JSON: cai na frase genérica
  }
  return `o servidor respondeu HTTP ${resposta.status}`;
}

export async function chamar<T>(
  metodo: 'GET' | 'POST',
  caminho: string,
  obterToken: ObterToken,
  opcoes: { corpo?: unknown; cabecalhos?: Record<string, string>; sinal?: AbortSignal } = {},
): Promise<T> {
  const cabecalhos: Record<string, string> = { Accept: 'application/json', ...opcoes.cabecalhos };
  const token = await obterToken();
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  if (opcoes.corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

  const resposta = await fetch(`${baseUrl()}${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    signal: opcoes.sinal,
  });
  if (!resposta.ok) throw new ErroDeApi(resposta.status, await mensagemDoErro(resposta));
  return (await resposta.json()) as T;
}
