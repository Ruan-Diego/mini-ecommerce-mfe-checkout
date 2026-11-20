import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CARRINHO, FOTO, fetchFalso, montar } from '../testes';
import { formatarNumero, formatarValidade, luhnValido, validadeValida } from './cartao';

const COTACAO = 'GET /pedidos/fretes/cotacao';
const PEDIDOS = 'POST /pedidos/pedidos';
const PAGAMENTOS = 'POST /pagamentos/pagamentos';
const ENDERECO = {
  destinatario: 'Ana Souza', cep: '01310100', logradouro: 'Avenida Paulista', numero: '1000', complemento: '',
  bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP',
};
const PEDIDO = { id: 'ped-1', status: 'AGUARDANDO_PAGAMENTO', total: 269.9 };
const pagamento = (extra: object) => ({ id: 'pag-1', pedidoId: 'ped-1', metodo: 'CARTAO', valor: 269.9, status: 'APROVADO', transacaoId: 't1', pixCodigo: null, pixExpiraEm: null, motivoRecusa: null, ...extra });

function rotas(extra: Record<string, unknown> = {}) {
  return {
    [CARRINHO]: { corpo: FOTO },
    [COTACAO]: { corpo: [{ codigo: 'PADRAO', nome: 'Padrão', valor: 19.9, prazoDias: 6 }] },
    [PEDIDOS]: { status: 201, corpo: PEDIDO },
    [PAGAMENTOS]: { status: 201, corpo: pagamento({}) },
    ...extra,
  } as Parameters<typeof fetchFalso>[0];
}

/** Endereço → frete → pagamento, clicando como o cliente. */
async function irParaOPagamento() {
  localStorage.setItem('mini:enderecos', JSON.stringify([ENDERECO]));
  const t = montar('/checkout/endereco');
  await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }));
  await screen.findByRole('radio', { name: /Padrão/ });
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await waitFor(() => expect(t.local()).toBe('/checkout/pagamento'));
  return t;
}

async function preencherCartao(numero = '4111 1111 1111 1111') {
  await userEvent.type(await screen.findByLabelText('Número do cartão'), numero);
  await userEvent.type(screen.getByLabelText('Nome impresso no cartão'), 'ANA SOUZA');
  await userEvent.type(screen.getByLabelText('Validade (MM/AA)'), '1230');
  await userEvent.type(screen.getByLabelText('CVV'), '123');
}

const corpoDe = (chamadas: ReturnType<typeof fetchFalso>, metodo: string, url: string) => chamadas.filter((c) => c.metodo === metodo && c.url === url);

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('validação do cartão', () => {
  it('Luhn: números de teste conhecidos', () => {
    expect(luhnValido('4111 1111 1111 1111')).toBe(true);
    expect(luhnValido('4111 1111 1111 1112')).toBe(false);
    expect(luhnValido('1234')).toBe(false);
    expect(luhnValido('')).toBe(false);
  });

  it('validade vale até o fim do mês indicado', () => {
    const hoje = new Date(2026, 10, 20); // novembro de 2026
    expect(validadeValida('11/26', hoje)).toBe(true);
    expect(validadeValida('10/26', hoje)).toBe(false);
    expect(validadeValida('01/27', hoje)).toBe(true);
    expect(validadeValida('13/27', hoje)).toBe(false);
    expect(validadeValida('1/27', hoje)).toBe(false);
  });

  it('formata número em grupos de 4 e validade com barra', () => {
    expect(formatarNumero('4111111111111111')).toBe('4111 1111 1111 1111');
    expect(formatarValidade('1230')).toBe('12/30');
  });
});

describe('tela Pagamento', () => {
  it('tem abas Cartão e Pix, com Cartão selecionada, e o botão mostra o total com frete', async () => {
    fetchFalso(rotas());
    await irParaOPagamento();
    expect(await screen.findByRole('tab', { name: 'Cartão' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Pix' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('button', { name: /Pagar R\$\s*269,90/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Pix' }));
    expect(screen.getByText(/O código vale 30 minutos/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Número do cartão')).not.toBeInTheDocument();
  });

  it('cartão inválido (Luhn, validade, CVV) mostra erro no campo e não chama o servidor', async () => {
    const chamadas = fetchFalso(rotas());
    await irParaOPagamento();
    await userEvent.type(await screen.findByLabelText('Número do cartão'), '4111111111111112');
    await userEvent.type(screen.getByLabelText('Validade (MM/AA)'), '0120');
    await userEvent.click(screen.getByRole('button', { name: /Pagar/ }));

    expect(screen.getByLabelText('Número do cartão')).toHaveAccessibleDescription('Número de cartão inválido.');
    expect(screen.getByLabelText('Validade (MM/AA)')).toHaveAccessibleDescription(/validade futura/);
    expect(screen.getByLabelText('CVV')).toBeInvalid();
    expect(screen.getByLabelText('Número do cartão')).toHaveFocus();
    expect(corpoDe(chamadas, 'POST', '/pedidos/pedidos')).toHaveLength(0);
  });

  it('cartão aprovado cria o pedido, paga o total do pedido e vai para a confirmação', async () => {
    const chamadas = fetchFalso(rotas());
    const t = await irParaOPagamento();
    await preencherCartao();
    await userEvent.click(screen.getByRole('button', { name: /Pagar/ }));

    await waitFor(() => expect(t.local()).toBe('/checkout/confirmado/ped-1'));
    const [pedido] = corpoDe(chamadas, 'POST', '/pedidos/pedidos');
    expect(pedido.corpo).toMatchObject({
      freteCodigo: 'PADRAO',
      itens: [{ produtoId: 'p1', quantidade: 2, precoVisto: 100 }, { produtoId: 'p2', quantidade: 1, precoVisto: 50 }],
      endereco: { destinatario: 'Ana Souza', cep: '01310100' },
    });
    expect(pedido.cabecalhos['Idempotency-Key']).toBeTruthy();
    const [pag] = corpoDe(chamadas, 'POST', '/pagamentos/pagamentos');
    expect(pag.corpo).toEqual({ pedidoId: 'ped-1', valor: 269.9, metodo: 'CARTAO', numeroCartao: '4111111111111111' });
    expect(pag.cabecalhos['Idempotency-Key']).toBeTruthy();
  });

  // Critério de pronto da issue: clique duplo não cria dois pedidos.
  it('clique duplo no botão cria um único pedido e um único pagamento', async () => {
    const chamadas = fetchFalso(rotas());
    const t = await irParaOPagamento();
    await preencherCartao();
    const botao = screen.getByRole('button', { name: /Pagar/ });
    await userEvent.dblClick(botao);

    await waitFor(() => expect(t.local()).toBe('/checkout/confirmado/ped-1'));
    expect(corpoDe(chamadas, 'POST', '/pedidos/pedidos')).toHaveLength(1);
    expect(corpoDe(chamadas, 'POST', '/pagamentos/pagamentos')).toHaveLength(1);
  });

  it('enquanto envia, o botão fica desabilitado com spinner', async () => {
    let liberar: () => void = () => {};
    const espera = new Promise<void>((r) => (liberar = r));
    fetchFalso(rotas());
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (...args: Parameters<typeof fetch>) => {
      if (String(args[0]).endsWith('/pagamentos/pagamentos')) await espera;
      return original(...args);
    }));
    await irParaOPagamento();
    await preencherCartao();
    await userEvent.click(screen.getByRole('button', { name: /Pagar/ }));

    const botao = await screen.findByRole('button', { name: /Processando/ });
    expect(botao).toBeDisabled();
    liberar();
    await waitFor(() => expect(screen.queryByRole('button', { name: /Processando/ })).not.toBeInTheDocument());
  });

  it('cartão recusado cancela o pedido: mostra o motivo, tira o botão de pagar e oferece voltar à loja', async () => {
    const chamadas = fetchFalso(
      rotas({ [PAGAMENTOS]: { status: 201, corpo: pagamento({ status: 'RECUSADO', motivoRecusa: 'Cartão recusado pelo emissor' }) } }),
    );
    const t = await irParaOPagamento();
    await preencherCartao('4111 1111 1111 1111');
    await userEvent.click(screen.getByRole('button', { name: /Pagar/ }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Pagamento recusado: Cartão recusado pelo emissor');
    expect(alerta).toHaveTextContent('O pedido foi cancelado');
    expect(screen.queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument(); // sem nova tentativa no mesmo pedido
    expect(t.local()).toBe('/checkout/pagamento');

    await userEvent.click(screen.getByRole('button', { name: 'Voltar à loja' }));
    expect(t.navegacoes).toEqual(['/']);
    expect(corpoDe(chamadas, 'POST', '/pagamentos/pagamentos')).toHaveLength(1);
  });

  it('409 ao pagar (o pedido já foi cancelado no servidor) mostra o motivo e só oferece voltar à loja', async () => {
    fetchFalso(rotas({ [PAGAMENTOS]: { status: 409, corpo: { detail: 'o pedido ped-1 foi cancelado: refaça a compra' } } }));
    const t = await irParaOPagamento();
    await preencherCartao();
    await userEvent.click(screen.getByRole('button', { name: /Pagar/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Este pedido foi cancelado. o pedido ped-1 foi cancelado: refaça a compra');
    expect(screen.queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar à loja' }));
    expect(t.navegacoes).toEqual(['/']);
  });

  it('erro do servidor (preço mudou) aparece e permite tentar de novo', async () => {
    fetchFalso(rotas({ [PEDIDOS]: { status: 409, corpo: { detail: 'O preço de Esfera Chrome mudou' } } }));
    const t = await irParaOPagamento();
    await preencherCartao();
    await userEvent.click(screen.getByRole('button', { name: /Pagar/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('O preço de Esfera Chrome mudou');
    expect(t.local()).toBe('/checkout/pagamento');
    expect(screen.getByRole('button', { name: /Pagar/ })).toBeEnabled();
  });

  it('Pix cria o pedido, pede o pagamento Pix (sem número de cartão) e vai para a tela do Pix', async () => {
    const chamadas = fetchFalso(rotas({ [PAGAMENTOS]: { status: 201, corpo: pagamento({ metodo: 'PIX', status: 'PENDENTE', pixCodigo: '000201...' }) } }));
    const t = await irParaOPagamento();
    await userEvent.click(await screen.findByRole('tab', { name: 'Pix' }));
    await userEvent.click(screen.getByRole('button', { name: /Pagar/ }));

    await waitFor(() => expect(t.local()).toBe('/checkout/pix/ped-1'));
    const [pag] = corpoDe(chamadas, 'POST', '/pagamentos/pagamentos');
    expect(pag.corpo).toEqual({ pedidoId: 'ped-1', valor: 269.9, metodo: 'PIX' });
  });

  it('sem frete escolhido, volta para a etapa do frete', async () => {
    fetchFalso(rotas());
    localStorage.setItem('mini:enderecos', JSON.stringify([ENDERECO]));
    const t = montar('/checkout/endereco');
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(t.local()).toBe('/checkout/frete'));
    // tenta pular direto: o estado ainda tem o frete? simulando o MFE recarregado
    const sem = montar('/checkout/pagamento');
    await waitFor(() => expect(sem.local()).toBe('/checkout/endereco'));
  });
});
