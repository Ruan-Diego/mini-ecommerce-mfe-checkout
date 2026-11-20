// @vitest-environment node
/**
 * Contrato do mfe-checkout com o pagamento-service: pagar com cartão (aprovado e recusado), gerar Pix e
 * listar os pagamentos do pedido (o polling da tela do Pix). O "Simular pagamento" (webhook, só em dev) fica fora.
 */
import { MatchersV3 } from '@pact-foundation/pact';
import { pagamentosDoPedido, pagar } from '../pagamentos';
import { AUTORIZACAO, IDEMPOTENCIA, instante, JSON_UTF8, novoPact, obterToken, PEDIDO } from './apoio';

const { eachLike, number, string, uuid, regex, nullValue } = MatchersV3;

const provider = novoPact('pagamento-service');

const cabecalhosDoPost = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Authorization: AUTORIZACAO,
  'Idempotency-Key': IDEMPOTENCIA,
};

const comum = {
  id: uuid('33333333-3333-4333-8333-333333333333'),
  pedidoId: uuid(PEDIDO),
  valor: number(219.9),
  transacaoId: string('fake-cartao-1'),
  criadoEm: instante('2026-11-20T12:00:00.123456Z'),
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('contrato mfe-checkout → pagamento-service', () => {
  it('paga com cartão e o pagamento é aprovado', async () => {
    provider
      .given('o pedido 22222222-2222-4222-8222-222222222222 está aberto para pagamento')
      .uponReceiving('um pagamento com cartão aprovado')
      .withRequest({
        method: 'POST',
        path: '/pagamentos/pagamentos',
        headers: cabecalhosDoPost,
        body: { pedidoId: PEDIDO, valor: 219.9, metodo: 'CARTAO', numeroCartao: '4242424242424242' },
      })
      .willRespondWith({
        status: 201,
        headers: { 'Content-Type': JSON_UTF8 },
        body: { ...comum, metodo: 'CARTAO', status: 'APROVADO', pixCodigo: nullValue(), motivoRecusa: nullValue() },
      });

    await provider.executeTest(async (mock) => {
      vi.stubEnv('VITE_API_URL', mock.url);
      const pagamento = await pagar(obterToken, PEDIDO, 219.9, 'CARTAO', 'chave-1', '4242424242424242');
      expect(pagamento.status).toBe('APROVADO');
    });
  });

  it('paga com cartão e o pagamento é recusado, com o motivo', async () => {
    provider
      .given('o pedido 22222222-2222-4222-8222-222222222222 está aberto para pagamento')
      .uponReceiving('um pagamento com cartão recusado')
      .withRequest({
        method: 'POST',
        path: '/pagamentos/pagamentos',
        headers: cabecalhosDoPost,
        body: { pedidoId: PEDIDO, valor: 219.9, metodo: 'CARTAO', numeroCartao: '4111111111111111' },
      })
      .willRespondWith({
        status: 201,
        headers: { 'Content-Type': JSON_UTF8 },
        body: { ...comum, metodo: 'CARTAO', status: 'RECUSADO', motivoRecusa: string('cartão recusado pela operadora') },
      });

    await provider.executeTest(async (mock) => {
      vi.stubEnv('VITE_API_URL', mock.url);
      const pagamento = await pagar(obterToken, PEDIDO, 219.9, 'CARTAO', 'chave-2', '4111111111111111');
      expect(pagamento.status).toBe('RECUSADO');
      expect(pagamento.motivoRecusa).toBeTruthy();
    });
  });

  it('gera a cobrança Pix com o código copia e cola e a validade', async () => {
    provider
      .given('o pedido 22222222-2222-4222-8222-222222222222 está aberto para pagamento')
      .uponReceiving('um pagamento com Pix')
      .withRequest({
        method: 'POST',
        path: '/pagamentos/pagamentos',
        headers: cabecalhosDoPost,
        body: { pedidoId: PEDIDO, valor: 219.9, metodo: 'PIX' },
      })
      .willRespondWith({
        status: 201,
        headers: { 'Content-Type': JSON_UTF8 },
        body: {
          ...comum,
          metodo: 'PIX',
          status: 'PENDENTE',
          pixCodigo: string('00020126580014br.gov.bcb.pix'),
          pixExpiraEm: instante('2026-11-20T12:30:00.123456Z'),
        },
      });

    await provider.executeTest(async (mock) => {
      vi.stubEnv('VITE_API_URL', mock.url);
      const pagamento = await pagar(obterToken, PEDIDO, 219.9, 'PIX', 'chave-3');
      expect(pagamento.pixCodigo).toBeTruthy();
      expect(pagamento.pixExpiraEm).toBeTruthy();
    });
  });

  it('lista os pagamentos do pedido (polling do Pix)', async () => {
    provider
      .given('o pedido 22222222-2222-4222-8222-222222222222 tem um pagamento Pix pendente')
      .uponReceiving('a lista de pagamentos de um pedido')
      .withRequest({
        method: 'GET',
        path: `/pagamentos/pagamentos/pedido/${PEDIDO}`,
        headers: { Accept: 'application/json', Authorization: AUTORIZACAO },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': JSON_UTF8 },
        body: eachLike({ ...comum, metodo: string('PIX'), status: regex(/PENDENTE|APROVADO|RECUSADO|EXPIRADO|ESTORNADO/.source, 'PENDENTE') }),
      });

    await provider.executeTest(async (mock) => {
      vi.stubEnv('VITE_API_URL', mock.url);
      const lista = await pagamentosDoPedido(obterToken, PEDIDO);
      expect(lista[0].pedidoId).toBe(PEDIDO);
    });
  });
});
