import { chamar, type ObterToken } from './http';
import type { Endereco, FotoDoCarrinho } from './checkout';

export interface Pedido {
  id: string;
  status: string;
  itens: { produtoId: string; nome: string; precoUnitario: number; quantidade: number; subtotal: number }[];
  endereco: Endereco;
  frete: { codigo: string; nome: string; valor: number; prazoDias: number };
  subtotal: number;
  total: number;
  criadoEm: string;
}

/** Chave que identifica UMA tentativa de compra, para o servidor reconhecer uma repetição do mesmo clique. */
export const novaChaveDeIdempotencia = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

/** `POST /pedidos`: itens como o cliente os viu (o servidor confere nome e preço no catálogo e recusa se o preço mudou). */
export const criarPedido = (
  obterToken: ObterToken,
  foto: FotoDoCarrinho,
  endereco: Endereco,
  freteCodigo: string,
  chaveDeIdempotencia: string,
) =>
  chamar<Pedido>('POST', '/pedidos/pedidos', obterToken, {
    corpo: {
      itens: foto.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, precoVisto: i.precoUnitario })),
      endereco,
      freteCodigo,
    },
    cabecalhos: { 'Idempotency-Key': chaveDeIdempotencia },
  });

export const obterPedido = (obterToken: ObterToken, id: string) => chamar<Pedido>('GET', `/pedidos/pedidos/${encodeURIComponent(id)}`, obterToken);
