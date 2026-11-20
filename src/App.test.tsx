import { screen } from '@testing-library/react';
import { CARRINHO, FOTO, fetchFalso, montar } from './testes';

afterEach(() => vi.unstubAllGlobals());

describe('mfe-checkout', () => {
  it('renderiza a primeira tela a partir do basePath', () => {
    fetchFalso({ [CARRINHO]: { corpo: FOTO } });
    montar('/checkout/endereco');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Endereço de entrega');
  });

  it('a raiz do MFE redireciona para o endereço', async () => {
    fetchFalso({ [CARRINHO]: { corpo: FOTO } });
    const t = montar('/checkout');
    expect(await screen.findByLabelText('Destinatário')).toBeInTheDocument();
    expect(t.local()).toBe('/checkout/endereco');
  });
});
