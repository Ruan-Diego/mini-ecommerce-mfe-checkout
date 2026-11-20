import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { criarEventBus } from '@ruan-diego/mini-event-contracts';
import type { FotoDoCarrinho } from './api/checkout';
import App from './App';

/** Utilidades só dos testes: carrinho de exemplo, fetch falso e a montagem do App com um roteador de memória. */
export const FOTO: FotoDoCarrinho = {
  itens: [
    { produtoId: 'p1', nome: 'Esfera Chrome', precoUnitario: 100, quantidade: 2, subtotal: 200 },
    { produtoId: 'p2', nome: 'Cubo Preto', precoUnitario: 50, quantidade: 1, subtotal: 50 },
  ],
  quantidadeTotal: 3,
  subtotal: 250,
  desconto: 25,
  total: 225,
};

export interface Chamada {
  metodo: string;
  url: string;
  corpo: unknown;
  cabecalhos: Record<string, string>;
}

type Resposta = { status?: number; corpo?: unknown } | (() => { status?: number; corpo?: unknown });

/** Substitui o fetch: cada rota ("METODO /caminho") devolve a resposta combinada; o resto é 404. */
export function fetchFalso(rotas: Record<string, Resposta>) {
  const chamadas: Chamada[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: string, init?: RequestInit) => {
      const url = new URL(entrada, 'http://x');
      url.pathname = url.pathname.replace(/^\/api/, ''); // VITE_API_URL termina em /api
      const metodo = init?.method ?? 'GET';
      chamadas.push({
        metodo,
        url: url.pathname + url.search,
        corpo: init?.body ? JSON.parse(String(init.body)) : undefined,
        cabecalhos: (init?.headers ?? {}) as Record<string, string>,
      });
      const chave = Object.keys(rotas).find((r) => r === `${metodo} ${url.pathname}`);
      const definida = chave ? rotas[chave] : { status: 404, corpo: { detail: 'não encontrado' } };
      const { status = 200, corpo } = typeof definida === 'function' ? definida() : definida;
      return new Response(JSON.stringify(corpo ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
  return chamadas;
}

export const CARRINHO = 'POST /carrinho/carrinhos/atual/checkout';

export function montar(rota: string, opcoes: { token?: string | null } = {}) {
  const eventBus = criarEventBus(new EventTarget());
  const navegacoes: string[] = [];
  eventBus.on('navegar', ({ rota: r }) => navegacoes.push(r));
  let local = '';
  function Local() {
    const l = useLocation();
    local = l.pathname + l.search;
    return null;
  }
  const getToken = async () => (opcoes.token === undefined ? 'token-de-teste' : opcoes.token);
  const resultado = render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/checkout/*" element={<App basePath="/checkout" getToken={getToken} eventBus={eventBus} />} />
      </Routes>
      <Local />
    </MemoryRouter>,
  );
  return { ...resultado, eventBus, navegacoes, local: () => local };
}
