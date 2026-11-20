import { chamar, type ObterToken } from './http';

export interface ItemDoCarrinho {
  produtoId: string;
  nome: string;
  precoUnitario: number;
  quantidade: number;
  subtotal: number;
}

/** Foto final do carrinho (`POST /checkout` do carrinho-service): o que vira pedido. */
export interface FotoDoCarrinho {
  itens: ItemDoCarrinho[];
  quantidadeTotal: number;
  subtotal: number;
  desconto: number;
  total: number;
}

export interface Endereco {
  destinatario: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

/**
 * O checkout não tem o carrinho: quem o tem é o carrinho-service. Esta é a única chamada fora dos serviços
 * de pedido e pagamento, e é de leitura: o endpoint existe justamente para o checkout (confere o carrinho do
 * cliente logado e devolve a foto final). Nenhum código do mfe-carrinho é importado.
 */
export const obterFotoDoCarrinho = (obterToken: ObterToken) =>
  chamar<FotoDoCarrinho>('POST', '/carrinho/carrinhos/atual/checkout', obterToken);
