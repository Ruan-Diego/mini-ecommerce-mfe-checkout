import { chamar, type ObterToken } from './http';
import type { OpcaoDeFrete } from '../estado/CheckoutContext';

/**
 * Cotação do pedido-service: `GET /fretes/cotacao?cep=&subtotal=` (a issue e o documento falam em POST, mas o
 * contrato implementado é GET, e é ele que vale). O frete cotado hoje é fixo; o contrato não muda quando
 * entrar uma API de frete de verdade.
 */
export const cotarFrete = (obterToken: ObterToken, cep: string, subtotal: number, sinal?: AbortSignal) =>
  chamar<OpcaoDeFrete[]>('GET', `/pedidos/fretes/cotacao?cep=${encodeURIComponent(cep)}&subtotal=${subtotal.toFixed(2)}`, obterToken, {
    sinal,
  });
