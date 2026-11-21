// @vitest-environment node
/**
 * Contrato do mfe-checkout com o carrinho-service: a única chamada fora de pedido/pagamento, a foto final do
 * carrinho do cliente logado (POST /carrinhos/atual/checkout), de onde saem os itens do pedido.
 */
import { MatchersV3 } from '@pact-foundation/pact';
import { obterFotoDoCarrinho } from '../checkout';
import { AUTORIZACAO, JSON_UTF8, novoPact, obterToken, PRODUTO } from './apoio';

const { eachLike, number, integer, string, uuid } = MatchersV3;

const provider = novoPact('carrinho-service');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('contrato mfe-checkout → carrinho-service', () => {
  it('pega a foto final do carrinho do cliente logado', async () => {
    provider
      .given('o cliente logado tem 2 unidades do produto 11111111-1111-4111-8111-111111111111 no carrinho')
      .uponReceiving('o início do checkout com o carrinho do cliente')
      .withRequest({
        method: 'POST',
        path: '/carrinho/carrinhos/atual/checkout',
        headers: { Accept: 'application/json', Authorization: AUTORIZACAO },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': JSON_UTF8 },
        body: {
          itens: eachLike({
            produtoId: uuid(PRODUTO),
            nome: string('Esfera Chrome'),
            precoUnitario: number(100.0),
            quantidade: integer(2),
            subtotal: number(200.0),
          }),
          quantidadeTotal: integer(2),
          subtotal: number(200.0),
          desconto: number(0),
          total: number(200.0),
        },
      });

    await provider.executeTest(async (mock) => {
      vi.stubEnv('VITE_API_URL', mock.url);
      const foto = await obterFotoDoCarrinho(obterToken);
      expect(foto.itens[0].produtoId).toBe(PRODUTO);
      expect(foto.total).toBe(200);
    });
  });
});
