// @vitest-environment node
/** Contrato do mfe-checkout com o pedido-service: cotar o frete, criar o pedido e reler o pedido (Confirmado). */
import { MatchersV3 } from '@pact-foundation/pact';
import { cotarFrete } from '../frete';
import { criarPedido, obterPedido } from '../pedidos';
import { AUTORIZACAO, IDEMPOTENCIA, instante, JSON_UTF8, novoPact, obterToken, PEDIDO, PRODUTO } from './apoio';

const { eachLike, like, number, integer, string, uuid, regex } = MatchersV3;

const provider = novoPact('pedido-service');

const endereco = {
  destinatario: 'Ana Souza',
  cep: '01310100',
  logradouro: 'Av. Paulista',
  numero: '1000',
  complemento: '',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'SP',
};

/** O pedido como o checkout lê: status, itens congelados, frete, totais e data. */
const pedido = (id: string, status: string) => ({
  id: uuid(id),
  status: regex(/[A-Z_]+/.source, status),
  itens: eachLike({
    produtoId: uuid(PRODUTO),
    nome: string('Esfera Chrome'),
    precoUnitario: number(100.0),
    quantidade: integer(2),
    subtotal: number(200.0),
  }),
  endereco: like({
    destinatario: string('Ana Souza'),
    cep: string('01310100'),
    logradouro: string('Av. Paulista'),
    numero: string('1000'),
    bairro: string('Bela Vista'),
    cidade: string('São Paulo'),
    uf: string('SP'),
  }),
  frete: like({ codigo: string('padrao'), nome: string('Padrão'), valor: number(19.9), prazoDias: integer(7) }),
  subtotal: number(200.0),
  total: number(219.9),
  criadoEm: instante('2026-11-20T12:00:00.123456Z'),
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('contrato mfe-checkout → pedido-service', () => {
  it('cota o frete para o CEP e o subtotal', async () => {
    provider
      .uponReceiving('a cotação de frete para um CEP')
      .withRequest({
        method: 'GET',
        path: '/pedidos/fretes/cotacao',
        query: { cep: '01310100', subtotal: '200.00' },
        headers: { Accept: 'application/json', Authorization: AUTORIZACAO },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': JSON_UTF8 },
        body: eachLike({ codigo: string('padrao'), nome: string('Padrão'), valor: number(19.9), prazoDias: integer(7) }),
      });

    await provider.executeTest(async (mock) => {
      vi.stubEnv('VITE_API_URL', mock.url);
      const opcoes = await cotarFrete(obterToken, '01310100', 200);
      expect(opcoes[0].codigo).toBe('padrao');
    });
  });

  it('cria o pedido com os itens como o cliente viu', async () => {
    provider
      .given('o produto 11111111-1111-4111-8111-111111111111 custa 100,00 no catálogo')
      .uponReceiving('a criação de um pedido com frete padrão')
      .withRequest({
        method: 'POST',
        path: '/pedidos/pedidos',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: AUTORIZACAO,
          'Idempotency-Key': IDEMPOTENCIA,
        },
        body: { itens: [{ produtoId: PRODUTO, quantidade: 2, precoVisto: 100 }], endereco, freteCodigo: 'padrao' },
      })
      .willRespondWith({ status: 201, headers: { 'Content-Type': JSON_UTF8 }, body: pedido(PEDIDO, 'AGUARDANDO_PAGAMENTO') });

    await provider.executeTest(async (mock) => {
      vi.stubEnv('VITE_API_URL', mock.url);
      const foto = {
        itens: [{ produtoId: PRODUTO, nome: 'Esfera Chrome', precoUnitario: 100, quantidade: 2, subtotal: 200 }],
        quantidadeTotal: 2,
        subtotal: 200,
        desconto: 0,
        total: 200,
      };
      const criado = await criarPedido(obterToken, foto, endereco, 'padrao', 'chave-1');
      expect(criado.status).toBe('AGUARDANDO_PAGAMENTO');
      expect(criado.total).toBe(219.9);
    });
  });

  it('relê o próprio pedido (tela Confirmado)', async () => {
    provider
      .given('existe o pedido 22222222-2222-4222-8222-222222222222 do cliente logado')
      .uponReceiving('a leitura de um pedido do cliente')
      .withRequest({
        method: 'GET',
        path: `/pedidos/pedidos/${PEDIDO}`,
        headers: { Accept: 'application/json', Authorization: AUTORIZACAO },
      })
      .willRespondWith({ status: 200, headers: { 'Content-Type': JSON_UTF8 }, body: pedido(PEDIDO, 'PAGO') });

    await provider.executeTest(async (mock) => {
      vi.stubEnv('VITE_API_URL', mock.url);
      const lido = await obterPedido(obterToken, PEDIDO);
      expect(lido.id).toBe(PEDIDO);
      expect(lido.frete.prazoDias).toBe(7);
    });
  });
});
