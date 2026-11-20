import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CARRINHO, FOTO, fetchFalso, montar } from '../testes';
import { formatarCep, validarEndereco, ENDERECO_VAZIO } from './enderecos';

beforeEach(() => {
  localStorage.clear();
  fetchFalso({ [CARRINHO]: { corpo: FOTO } });
});
afterEach(() => vi.unstubAllGlobals());

describe('validação do endereço', () => {
  it('exige número e destinatário (e os demais, menos o complemento)', () => {
    const erros = validarEndereco(ENDERECO_VAZIO);
    expect(Object.keys(erros).sort()).toEqual(['bairro', 'cep', 'cidade', 'destinatario', 'logradouro', 'numero', 'uf']);
    expect(erros).not.toHaveProperty('complemento');
  });

  it('CEP precisa de 8 dígitos e a UF de 2 letras', () => {
    const base = { ...ENDERECO_VAZIO, destinatario: 'Ana', logradouro: 'Rua A', numero: '1', bairro: 'Centro', cidade: 'SP' };
    expect(validarEndereco({ ...base, cep: '1234', uf: 'S' })).toEqual({ cep: expect.any(String), uf: expect.any(String) });
    expect(validarEndereco({ ...base, cep: '01310-100', uf: 'sp' })).toEqual({});
  });

  it('formata o CEP com hífen', () => {
    expect(formatarCep('01310100')).toBe('01310-100');
    expect(formatarCep('0131')).toBe('0131');
  });
});

describe('tela Endereço', () => {
  it('mostra etapas, resumo do pedido com os totais e o formulário (nenhum endereço salvo)', async () => {
    montar('/checkout/endereco');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Endereço de entrega');
    expect(await screen.findByLabelText('Destinatário')).toBeInTheDocument();
    const etapas = screen.getByRole('navigation', { name: 'Etapas do checkout' });
    expect(etapas.querySelector('[aria-current="step"]')).toHaveTextContent('Endereço');
    const resumo = screen.getByRole('complementary', { name: 'Resumo do pedido' });
    expect(resumo).toHaveTextContent('2× Esfera Chrome');
    expect(resumo).toHaveTextContent('Subtotal');
    expect(resumo).toHaveTextContent('a escolher');
  });

  it('número e destinatário obrigatórios: erro no campo, foco no primeiro e nada avança', async () => {
    const t = montar('/checkout/endereco');
    await screen.findByLabelText('Destinatário');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByLabelText('Destinatário')).toHaveAccessibleDescription('Informe o nome de quem vai receber.');
    expect(screen.getByLabelText('Destinatário')).toBeInvalid();
    expect(screen.getByLabelText('Número')).toHaveAccessibleDescription('Informe o número.');
    expect(screen.getByLabelText('Destinatário')).toHaveFocus();
    expect(t.local()).toBe('/checkout/endereco');
  });

  it('endereço válido segue para o frete e é salvo para a próxima vez', async () => {
    const t = montar('/checkout/endereco');
    await userEvent.type(await screen.findByLabelText('Destinatário'), 'Ana Souza');
    await userEvent.type(screen.getByLabelText('CEP'), '01310100');
    await userEvent.type(screen.getByLabelText('Rua'), 'Avenida Paulista');
    await userEvent.type(screen.getByLabelText('Número'), '1000');
    await userEvent.type(screen.getByLabelText('Bairro'), 'Bela Vista');
    await userEvent.type(screen.getByLabelText('Cidade'), 'São Paulo');
    await userEvent.type(screen.getByLabelText('UF'), 'sp');
    expect(screen.getByLabelText('CEP')).toHaveValue('01310-100');
    expect(screen.getByLabelText('UF')).toHaveValue('SP');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => expect(t.local()).toBe('/checkout/frete'));
    const salvos = JSON.parse(localStorage.getItem('mini:enderecos')!);
    expect(salvos[0]).toMatchObject({ destinatario: 'Ana Souza', cep: '01310100', uf: 'SP' });
  });

  describe('preenchimento pelo ViaCEP', () => {
    const VIACEP = 'GET /ws/01310100/json/';
    const PAULISTA = { logradouro: 'Avenida Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' };

    it('ao completar o CEP preenche rua, bairro, cidade e UF e leva o foco ao número', async () => {
      const chamadas = fetchFalso({ [CARRINHO]: { corpo: FOTO }, [VIACEP]: { corpo: PAULISTA } });
      montar('/checkout/endereco');
      await userEvent.type(await screen.findByLabelText('CEP'), '01310100');

      await waitFor(() => expect(screen.getByLabelText('Rua')).toHaveValue('Avenida Paulista'));
      expect(screen.getByLabelText('Bairro')).toHaveValue('Bela Vista');
      expect(screen.getByLabelText('Cidade')).toHaveValue('São Paulo');
      expect(screen.getByLabelText('UF')).toHaveValue('SP');
      expect(screen.getByLabelText('Número')).toHaveFocus();
      // Uma consulta só, feita quando o CEP chegou a 8 dígitos (e não a cada tecla).
      expect(chamadas.filter((c) => c.url.startsWith('/ws/'))).toHaveLength(1);
    });

    it('CEP inexistente mostra o erro no campo e não preenche nada', async () => {
      fetchFalso({ [CARRINHO]: { corpo: FOTO }, [VIACEP]: { corpo: { erro: 'true' } } });
      montar('/checkout/endereco');
      await userEvent.type(await screen.findByLabelText('CEP'), '01310100');

      await waitFor(() => expect(screen.getByLabelText('CEP')).toHaveAccessibleDescription('CEP não encontrado. Confira os números.'));
      expect(screen.getByLabelText('CEP')).toBeInvalid();
      expect(screen.getByLabelText('Rua')).toHaveValue('');
    });

    it('o erro some ao corrigir o CEP', async () => {
      fetchFalso({ [CARRINHO]: { corpo: FOTO }, [VIACEP]: { corpo: { erro: true } } });
      montar('/checkout/endereco');
      const cep = await screen.findByLabelText('CEP');
      await userEvent.type(cep, '01310100');
      await waitFor(() => expect(cep).toBeInvalid());

      await userEvent.type(cep, '{Backspace}');
      expect(cep).toBeValid();
    });

    it('ViaCEP fora do ar não bloqueia: o cliente preenche à mão e segue', async () => {
      fetchFalso({ [CARRINHO]: { corpo: FOTO }, [VIACEP]: { status: 503, corpo: {} } });
      montar('/checkout/endereco');
      await userEvent.type(await screen.findByLabelText('CEP'), '01310100');

      await waitFor(() => expect(screen.queryByText('Buscando endereço…')).not.toBeInTheDocument());
      expect(screen.getByLabelText('CEP')).toBeValid();
      await userEvent.type(screen.getByLabelText('Rua'), 'Avenida Paulista');
      expect(screen.getByLabelText('Rua')).toHaveValue('Avenida Paulista');
    });

    it('CEP geral sem rua preenche cidade e UF, preserva o que o cliente digitou e foca a rua', async () => {
      fetchFalso({ [CARRINHO]: { corpo: FOTO }, [VIACEP]: { corpo: { logradouro: '', bairro: '', localidade: 'Cidadezinha', uf: 'mg' } } });
      montar('/checkout/endereco');
      await userEvent.type(await screen.findByLabelText('Bairro'), 'Centro');
      await userEvent.type(screen.getByLabelText('CEP'), '01310100');

      await waitFor(() => expect(screen.getByLabelText('Cidade')).toHaveValue('Cidadezinha'));
      expect(screen.getByLabelText('UF')).toHaveValue('MG');
      expect(screen.getByLabelText('Bairro')).toHaveValue('Centro');
      expect(screen.getByLabelText('Rua')).toHaveFocus();
    });
  });

  it('com endereços salvos, lista para escolher e permite abrir o formulário de novo endereço', async () => {
    localStorage.setItem(
      'mini:enderecos',
      JSON.stringify([
        { destinatario: 'Ana Souza', cep: '01310100', logradouro: 'Avenida Paulista', numero: '1000', complemento: '', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' },
      ]),
    );
    const t = montar('/checkout/endereco');
    expect(await screen.findByRole('radio', { name: /Ana Souza/ })).toBeChecked();
    expect(screen.queryByLabelText('Destinatário')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Novo endereço' }));
    expect(screen.getByLabelText('Destinatário')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Usar um endereço salvo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(t.local()).toBe('/checkout/frete'));
  });

  it('erro ao carregar o carrinho mostra aviso com "Tentar de novo"', async () => {
    let falhar = true;
    fetchFalso({ [CARRINHO]: () => (falhar ? { status: 503, corpo: { detail: 'carrinho fora do ar' } } : { corpo: FOTO }) });
    montar('/checkout/endereco');
    expect(await screen.findByRole('alert')).toHaveTextContent('carrinho fora do ar');
    falhar = false;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByLabelText('Destinatário')).toBeInTheDocument();
  });

  // Achado no E2E: logo depois do login o checkout consulta o carrinho antes de o drawer uni-lo ao do visitante.
  it('carrinho:atualizado recarrega a foto: a consulta que veio vazia é refeita depois da união pós-login', async () => {
    let unido = false;
    const chamadas = fetchFalso({
      [CARRINHO]: () => (unido ? { corpo: FOTO } : { status: 422, corpo: { detail: 'o carrinho está vazio' } }),
    });
    const t = montar('/checkout/endereco');
    expect(await screen.findByRole('alert')).toHaveTextContent('o carrinho está vazio');

    unido = true;
    act(() => t.eventBus.emit('carrinho:atualizado', { quantidadeTotal: 3, subtotal: 250 }));
    expect(await screen.findByLabelText('Destinatário')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(chamadas.filter((c) => c.url === '/carrinho/carrinhos/atual/checkout')).toHaveLength(2);
  });

  it('carrinho vazio avisa e leva à loja pelo evento navegar', async () => {
    fetchFalso({ [CARRINHO]: { corpo: { ...FOTO, itens: [], quantidadeTotal: 0, subtotal: 0, total: 0, desconto: 0 } } });
    const t = montar('/checkout/endereco');
    expect(await screen.findByText('Seu carrinho está vazio.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ir para a loja' }));
    expect(t.navegacoes).toEqual(['/']);
  });

  it('envia o token ao carrinho', async () => {
    const chamadas = fetchFalso({ [CARRINHO]: { corpo: FOTO } });
    montar('/checkout/endereco', { token: 'abc' });
    await screen.findByLabelText('Destinatário');
    expect(chamadas[0].cabecalhos.Authorization).toBe('Bearer abc');
  });
});
