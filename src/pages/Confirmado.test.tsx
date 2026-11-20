import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { criarEventBus } from '@ruan-diego/mini-event-contracts';
import { CARRINHO, FOTO, fetchFalso, montar } from '../testes';
import { somarDiasUteis } from './Confirmado';

const PEDIDO_GET = 'GET /pedidos/pedidos/ped-12345678';
const LISTA = 'GET /pagamentos/pagamentos/pedido/ped-12345678';

const PEDIDO = {
  id: 'ped-12345678-aaaa',
  status: 'PAGO',
  itens: [
    { produtoId: 'p1', nome: 'Esfera Chrome', precoUnitario: 100, quantidade: 2, subtotal: 200 },
    { produtoId: 'p2', nome: 'Cubo Preto', precoUnitario: 50, quantidade: 1, subtotal: 50 },
  ],
  endereco: { destinatario: 'Ana Souza', cep: '01310100', logradouro: 'Avenida Paulista', numero: '1000', complemento: '', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' },
  frete: { codigo: 'PADRAO', nome: 'Padrão', valor: 19.9, prazoDias: 6 },
  subtotal: 250,
  total: 269.9,
  criadoEm: '2026-11-20T15:00:00Z', // sexta-feira
};
const PAGAMENTO = { id: 'pag-1', pedidoId: PEDIDO.id, metodo: 'CARTAO', valor: 269.9, status: 'APROVADO', transacaoId: 't', pixCodigo: null, pixExpiraEm: null, motivoRecusa: null };

const rotas = () => ({ [CARRINHO]: { corpo: FOTO }, [PEDIDO_GET]: { corpo: PEDIDO }, [LISTA]: { corpo: [PAGAMENTO] } });

afterEach(() => vi.unstubAllGlobals());

describe('somarDiasUteis', () => {
  it('pula sábado e domingo', () => {
    expect(somarDiasUteis(new Date(2026, 10, 20), 1).getDay()).toBe(1); // sexta + 1 dia útil = segunda
    expect(somarDiasUteis(new Date(2026, 10, 20), 6).getDate()).toBe(30); // sexta 20 + 6 úteis = segunda 30
    expect(somarDiasUteis(new Date(2026, 10, 20), 0).getDate()).toBe(20);
  });
});

describe('tela Pedido confirmado', () => {
  // Critério de pronto da issue: o badge do carrinho zera ao chegar na tela.
  it('emite carrinho:limpo uma única vez ao chegar, sem esperar o pedido carregar', async () => {
    fetchFalso({ [CARRINHO]: { corpo: FOTO } }); // o pedido nem existe (404): o evento sai mesmo assim
    const eventBus = criarEventBus(new EventTarget());
    const limpos: unknown[] = [];
    eventBus.on('carrinho:limpo', (p) => limpos.push(p));
    montar('/checkout/confirmado/ped-12345678', { eventBus });
    expect(limpos).toEqual([{}]);
    await screen.findByRole('alert');
    expect(limpos).toHaveLength(1);
  });

  it('mostra número, resumo, endereço, pagamento e a previsão de entrega', async () => {
    fetchFalso(rotas());
    montar('/checkout/confirmado/ped-12345678');
    expect(await screen.findByText(/Obrigado pela compra/)).toHaveTextContent('#ped-1234');
    const resumo = screen.getByRole('complementary', { name: 'Resumo do pedido' });
    expect(resumo).toHaveTextContent('2× Esfera Chrome');
    expect(resumo).toHaveTextContent('269,90');
    expect(screen.getByText(/Avenida Paulista, 1000/)).toBeInTheDocument();
    expect(screen.getByText('Cartão · aprovado')).toBeInTheDocument();
    expect(screen.getByText(/Padrão, 6 dias úteis/)).toBeInTheDocument();
    expect(screen.getByText(/segunda-feira, 30 de novembro/)).toBeInTheDocument();
  });

  it('os botões levam a Acompanhar pedido e à loja pelo evento navegar', async () => {
    fetchFalso(rotas());
    const t = montar('/checkout/confirmado/ped-12345678');
    await screen.findByText(/Obrigado pela compra/);
    await userEvent.click(screen.getByRole('button', { name: 'Acompanhar pedido' }));
    await userEvent.click(screen.getByRole('button', { name: 'Voltar para a loja' }));
    expect(t.navegacoes).toEqual([`/conta/pedidos/${PEDIDO.id}`, '/']);
  });

  it('erro ao carregar o pedido avisa que o pagamento foi processado e permite tentar de novo', async () => {
    let falhar = true;
    fetchFalso({ ...rotas(), [PEDIDO_GET]: () => (falhar ? { status: 503, corpo: { detail: 'pedido fora do ar' } } : { corpo: PEDIDO }) });
    montar('/checkout/confirmado/ped-12345678');
    expect(await screen.findByRole('alert')).toHaveTextContent('pedido fora do ar');
    falhar = false;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText(/Obrigado pela compra/)).toBeInTheDocument();
  });
});
