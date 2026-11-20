import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { EventBus } from '@ruan-diego/mini-event-contracts';
import type { Endereco } from '../api/checkout';
import type { ObterToken } from '../api/http';

export interface OpcaoDeFrete {
  codigo: string;
  nome: string;
  valor: number;
  prazoDias: number;
}

/** Pedido já criado nesta compra: uma segunda tentativa de pagamento reaproveita o pedido em vez de criar outro. */
export interface PedidoPendente {
  id: string;
  total: number;
  /** Resumo do que foi enviado (itens, endereço, frete): se mudar, o pedido antigo não serve mais. */
  assinatura: string;
}

/** Pedido já criado nesta compra: uma segunda tentativa de pagamento reaproveita o pedido em vez de criar outro. */
export interface PedidoPendente {
  id: string;
  total: number;
  /** Resumo do que foi enviado (itens, endereço, frete): se mudar, o pedido antigo não serve mais. */
  assinatura: string;
}

interface Estado {
  /** Prefixo das rotas do MFE no shell (ex.: /checkout). */
  basePath: string;
  getToken: ObterToken;
  eventBus: EventBus;
  /** Endereço escolhido na etapa 1; as etapas seguintes exigem que exista. */
  endereco: Endereco | null;
  escolherEndereco: (e: Endereco | null) => void;
  /** Frete escolhido na etapa 2. */
  frete: OpcaoDeFrete | null;
  escolherFrete: (f: OpcaoDeFrete | null) => void;
  pedidoPendente: PedidoPendente | null;
  guardarPedido: (p: PedidoPendente | null) => void;
}

const Contexto = createContext<Estado | null>(null);

interface Props {
  basePath: string;
  getToken: ObterToken;
  eventBus: EventBus;
  children: ReactNode;
}

/**
 * Estado que atravessa as telas do checkout (endereço e frete escolhidos). Fica só em memória: recarregar a
 * página recomeça do endereço, o que é aceitável (o carrinho em si está no servidor).
 */
export function CheckoutProvider({ basePath, getToken, eventBus, children }: Props) {
  const [endereco, escolherEndereco] = useState<Endereco | null>(null);
  const [frete, escolherFrete] = useState<OpcaoDeFrete | null>(null);
  const [pedidoPendente, guardarPedido] = useState<PedidoPendente | null>(null);
  const valor = useMemo(
    () => ({ basePath, getToken, eventBus, endereco, escolherEndereco, frete, escolherFrete, pedidoPendente, guardarPedido }),
    [basePath, getToken, eventBus, endereco, frete, pedidoPendente],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCheckout(): Estado {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useCheckout fora do CheckoutProvider');
  return contexto;
}
