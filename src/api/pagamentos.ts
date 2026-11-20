import { chamar, type ObterToken } from './http';

export type StatusPagamento = 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'EXPIRADO' | 'ESTORNADO';

export interface Pagamento {
  id: string;
  pedidoId: string;
  metodo: 'CARTAO' | 'PIX';
  valor: number;
  status: StatusPagamento;
  transacaoId: string;
  /** Código copia e cola; só em pagamentos Pix. */
  pixCodigo: string | null;
  pixExpiraEm: string | null;
  motivoRecusa: string | null;
  /** ISO-8601; usado para achar o pagamento mais recente de um pedido. */
  criadoEm?: string;
}

/**
 * `POST /pagamentos`. O número do cartão vai só neste corpo (o servidor nunca o grava) e não é guardado em
 * nenhum estado fora do formulário. Cartão recusado volta 201 com `status: RECUSADO` e o motivo.
 */
export const pagar = (
  obterToken: ObterToken,
  pedidoId: string,
  valor: number,
  metodo: 'CARTAO' | 'PIX',
  chaveDeIdempotencia: string,
  numeroCartao?: string,
) =>
  chamar<Pagamento>('POST', '/pagamentos/pagamentos', obterToken, {
    corpo: { pedidoId, valor, metodo, numeroCartao },
    cabecalhos: { 'Idempotency-Key': chaveDeIdempotencia },
  });

export const pagamentosDoPedido = (obterToken: ObterToken, pedidoId: string, sinal?: AbortSignal) =>
  chamar<Pagamento[]>('GET', `/pagamentos/pagamentos/pedido/${encodeURIComponent(pedidoId)}`, obterToken, { sinal });

/** Só no ambiente fake: dispara o webhook do gateway como se o Pix tivesse sido pago (item 40). */
export const simularPagamentoPix = async (transacaoId: string, segredo: string) => {
  const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  const resposta = await fetch(`${base}/pagamentos/webhooks/gateway`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Segredo': segredo },
    body: JSON.stringify({ transacaoId, evento: 'APROVADO' }),
  });
  if (!resposta.ok) throw new Error(`o webhook respondeu HTTP ${resposta.status}`);
};
