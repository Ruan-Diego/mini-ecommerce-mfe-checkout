import { act, fireEvent, screen } from '@testing-library/react';
import { CARRINHO, FOTO, fetchFalso, montar } from '../testes';
import { formatarRestante, INTERVALO_DA_CONSULTA_MS } from './Pix';

const LISTA = 'GET /pagamentos/pagamentos/pedido/ped-1';
const WEBHOOK = 'POST /pagamentos/webhooks/gateway';
const AGORA = new Date('2026-11-20T12:00:00Z');

const pix = (extra: object = {}) => ({
  id: 'pag-1', pedidoId: 'ped-1', metodo: 'PIX', valor: 269.9, status: 'PENDENTE', transacaoId: 'tx-1',
  pixCodigo: '00020126580014br.gov.bcb.pix0136mini-ecommerce-fake', pixExpiraEm: new Date(AGORA.getTime() + 30 * 60_000).toISOString(),
  motivoRecusa: null, ...extra,
});

/** Deixa as promessas pendentes (fetch falso, setState) terminarem dentro do act. */
const assentar = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const avancar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(AGORA);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('formatarRestante', () => {
  it('mostra mm:ss e nunca negativo', () => {
    expect(formatarRestante(30 * 60_000)).toBe('30:00');
    expect(formatarRestante(61_000)).toBe('01:01');
    expect(formatarRestante(-5000)).toBe('00:00');
  });
});

describe('tela Aguardando Pix', () => {
  it('mostra QR code, copia e cola, valor e o contador de 30 minutos', async () => {
    fetchFalso({ [CARRINHO]: { corpo: FOTO }, [LISTA]: { corpo: [pix()] } });
    montar('/checkout/pix/ped-1');
    await assentar();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aguardando pagamento via Pix');
    expect(screen.getByRole('img', { name: 'QR code do Pix' })).toBeInTheDocument();
    expect(screen.getByLabelText('Pix copia e cola')).toHaveValue('00020126580014br.gov.bcb.pix0136mini-ecommerce-fake');
    expect(screen.getByText(/269,90/)).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('30:00');
    await avancar(65_000);
    expect(screen.getByRole('timer')).toHaveTextContent('28:55');
    expect(screen.getByText('Aguardando pagamento…')).toBeInTheDocument();
  });

  it('o botão Copiar coloca o código na área de transferência e avisa', async () => {
    fetchFalso({ [CARRINHO]: { corpo: FOTO }, [LISTA]: { corpo: [pix()] } });
    const escrever = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
    montar('/checkout/pix/ped-1');
    await assentar();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await assentar();
    expect(escrever).toHaveBeenCalledWith('00020126580014br.gov.bcb.pix0136mini-ecommerce-fake');
    expect(screen.getByText('Código copiado.')).toBeInTheDocument();
  });

  it('consulta o status a cada 5 segundos e, aprovado, vai para o Pedido confirmado', async () => {
    let status = 'PENDENTE';
    const chamadas = fetchFalso({ [CARRINHO]: { corpo: FOTO }, [LISTA]: () => ({ corpo: [pix({ status })] }) });
    const t = montar('/checkout/pix/ped-1');
    await assentar();
    const consultas = () => chamadas.filter((c) => c.url === '/pagamentos/pagamentos/pedido/ped-1').length;
    expect(consultas()).toBe(1);

    await avancar(INTERVALO_DA_CONSULTA_MS);
    expect(consultas()).toBe(2);
    await avancar(INTERVALO_DA_CONSULTA_MS);
    expect(consultas()).toBe(3);

    status = 'APROVADO';
    await avancar(INTERVALO_DA_CONSULTA_MS);
    expect(t.local()).toBe('/checkout/confirmado/ped-1');
    const antes = consultas();
    await avancar(INTERVALO_DA_CONSULTA_MS * 3);
    expect(consultas()).toBe(antes); // parou de consultar
  });

  it('Pix expirado (status EXPIRADO) avisa que o pedido foi cancelado e só oferece voltar à loja', async () => {
    const chamadas = fetchFalso({
      [CARRINHO]: { corpo: FOTO },
      [LISTA]: { corpo: [pix({ status: 'EXPIRADO' })] },
    });
    const t = montar('/checkout/pix/ped-1');
    await assentar();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pix expirado');
    expect(screen.getByRole('alert')).toHaveTextContent('o pedido foi cancelado');
    expect(screen.queryByRole('img', { name: 'QR code do Pix' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gerar outro Pix' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar à loja' }));
    expect(t.navegacoes).toEqual(['/']);
    expect(chamadas.filter((c) => c.metodo === 'POST' && c.url === '/pagamentos/pagamentos')).toHaveLength(0);
  });

  it('o relógio chegando a zero também mostra expirado, sem esperar a próxima consulta', async () => {
    fetchFalso({ [CARRINHO]: { corpo: FOTO }, [LISTA]: { corpo: [pix({ pixExpiraEm: new Date(AGORA.getTime() + 3000).toISOString() })] } });
    montar('/checkout/pix/ped-1');
    await assentar();
    expect(screen.getByRole('timer')).toHaveTextContent('00:03');
    await avancar(4000);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pix expirado');
  });

  it('Simular pagamento dispara o webhook com o segredo e a tela segue para a confirmação', async () => {
    let status = 'PENDENTE';
    const chamadas = fetchFalso({
      [CARRINHO]: { corpo: FOTO },
      [LISTA]: () => ({ corpo: [pix({ status })] }),
      [WEBHOOK]: () => {
        status = 'APROVADO';
        return { corpo: {} };
      },
    });
    const t = montar('/checkout/pix/ped-1');
    await assentar();
    fireEvent.click(screen.getByRole('button', { name: 'Simular pagamento' }));
    await assentar();
    const hook = chamadas.find((c) => c.url === '/pagamentos/webhooks/gateway')!;
    expect(hook.corpo).toEqual({ transacaoId: 'tx-1', evento: 'APROVADO' });
    expect(hook.cabecalhos['X-Webhook-Segredo']).toBeTruthy();
    expect(t.local()).toBe('/checkout/confirmado/ped-1');
  });

  it('falha de rede numa consulta mostra aviso e a tela continua tentando', async () => {
    let falhar = false;
    fetchFalso({ [CARRINHO]: { corpo: FOTO }, [LISTA]: () => (falhar ? { status: 503, corpo: { detail: 'fora do ar' } } : { corpo: [pix()] }) });
    montar('/checkout/pix/ped-1');
    await assentar();
    falhar = true;
    await avancar(INTERVALO_DA_CONSULTA_MS);
    expect(screen.getByText('fora do ar')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'QR code do Pix' })).toBeInTheDocument(); // o Pix continua na tela
    falhar = false;
    await avancar(INTERVALO_DA_CONSULTA_MS);
    expect(screen.queryByText('fora do ar')).not.toBeInTheDocument();
  });

  it('sem pagamento Pix para o pedido mostra erro com "Tentar de novo"', async () => {
    fetchFalso({ [CARRINHO]: { corpo: FOTO }, [LISTA]: { corpo: [] } });
    montar('/checkout/pix/ped-1');
    await assentar();
    expect(screen.getByRole('alert')).toHaveTextContent('Não encontramos um pagamento Pix');
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});
