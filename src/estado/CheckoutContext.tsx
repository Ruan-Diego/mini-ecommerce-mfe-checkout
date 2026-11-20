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
  const valor = useMemo(
    () => ({ basePath, getToken, eventBus, endereco, escolherEndereco, frete, escolherFrete }),
    [basePath, getToken, eventBus, endereco, frete],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCheckout(): Estado {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useCheckout fora do CheckoutProvider');
  return contexto;
}
