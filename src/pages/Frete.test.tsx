import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CARRINHO, FOTO, fetchFalso, montar } from '../testes';

const COTACAO = 'GET /pedidos/fretes/cotacao';
const OPCOES = [
  { codigo: 'EXPRESSO', nome: 'Expresso', valor: 34.9, prazoDias: 2 },
  { codigo: 'PADRAO', nome: 'Padrão', valor: 19.9, prazoDias: 6 },
];
const ENDERECO = {
  destinatario: 'Ana Souza', cep: '01310100', logradouro: 'Avenida Paulista', numero: '1000', complemento: '',
  bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP',
};

/** Chega à etapa de frete do jeito de verdade: preenchendo o endereço salvo e clicando em Continuar. */
async function irParaOFrete() {
  localStorage.setItem('mini:enderecos', JSON.stringify([ENDERECO]));
  const t = montar('/checkout/endereco');
  await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }));
  await waitFor(() => expect(t.local()).toBe('/checkout/frete'));
  return t;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('tela Frete', () => {
  it('cota pelo CEP e pelo subtotal, mostra prazo e valor e pré-seleciona a opção mais barata', async () => {
    const chamadas = fetchFalso({ [CARRINHO]: { corpo: FOTO }, [COTACAO]: { corpo: OPCOES } });
    await irParaOFrete();

    expect(await screen.findByRole('radio', { name: /Padrão/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Expresso/ })).not.toBeChecked();
    expect(screen.getByText('Entrega em 6 dias úteis')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Etapas do checkout' }).querySelector('[aria-current="step"]')).toHaveTextContent('Frete');

    const cotacao = chamadas.find((c) => c.url.startsWith('/pedidos/fretes/cotacao'))!;
    expect(cotacao.url).toBe('/pedidos/fretes/cotacao?cep=01310100&subtotal=250.00');
    expect(cotacao.metodo).toBe('GET');
  });

  it('o total do resumo muda ao trocar a opção', async () => {
    fetchFalso({ [CARRINHO]: { corpo: FOTO }, [COTACAO]: { corpo: OPCOES } });
    await irParaOFrete();
    const resumo = screen.getByRole('complementary', { name: 'Resumo do pedido' });

    await waitFor(() => expect(within(resumo).getByText(/269,90/)).toBeInTheDocument()); // 250 + 19,90
    await userEvent.click(screen.getByRole('radio', { name: /Expresso/ }));
    expect(within(resumo).getByText(/284,90/)).toBeInTheDocument(); // 250 + 34,90
    expect(within(resumo).getByText(/34,90/, { selector: 'dd' })).toBeInTheDocument();
  });

  it('frete grátis aparece como Grátis e não soma no total', async () => {
    fetchFalso({ [CARRINHO]: { corpo: FOTO }, [COTACAO]: { corpo: [{ codigo: 'PADRAO', nome: 'Padrão', valor: 0, prazoDias: 6 }] } });
    await irParaOFrete();
    expect(await screen.findByRole('radio', { name: /Padrão · Grátis/ })).toBeChecked();
    expect(within(screen.getByRole('complementary', { name: 'Resumo do pedido' })).getByText('Grátis')).toBeInTheDocument();
  });

  it('erro na cotação mostra aviso e "Tentar de novo" refaz a chamada', async () => {
    let falhar = true;
    fetchFalso({ [CARRINHO]: { corpo: FOTO }, [COTACAO]: () => (falhar ? { status: 502, corpo: { detail: 'frete indisponível' } } : { corpo: OPCOES }) });
    await irParaOFrete();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível calcular o frete. frete indisponível');
    falhar = false;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('radio', { name: /Padrão/ })).toBeChecked();
  });

  it('Continuar segue para o pagamento e Voltar para o endereço', async () => {
    fetchFalso({ [CARRINHO]: { corpo: FOTO }, [COTACAO]: { corpo: OPCOES } });
    const t = await irParaOFrete();
    await screen.findByRole('radio', { name: /Padrão/ });
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    await waitFor(() => expect(t.local()).toBe('/checkout/endereco'));
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }));
    await screen.findByRole('radio', { name: /Padrão/ });
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(t.local()).toBe('/checkout/pagamento'));
  });

  it('sem endereço escolhido, volta para a etapa do endereço', async () => {
    fetchFalso({ [CARRINHO]: { corpo: FOTO }, [COTACAO]: { corpo: OPCOES } });
    const t = montar('/checkout/frete');
    await waitFor(() => expect(t.local()).toBe('/checkout/endereco'));
  });
});
