import { useCallback, useEffect, useState } from 'react';
import { obterFotoDoCarrinho, type FotoDoCarrinho } from '../api/checkout';
import { useCheckout } from './CheckoutContext';

export type EstadoFoto =
  | { situacao: 'carregando' }
  | { situacao: 'erro'; mensagem: string; recarregar: () => void }
  | { situacao: 'pronto'; foto: FotoDoCarrinho };

/** Carrega a foto final do carrinho ao entrar numa etapa. Erro e "tentar de novo" ficam por conta da tela. */
export function useFoto(): EstadoFoto {
  const { getToken } = useCheckout();
  const [estado, setEstado] = useState<EstadoFoto>({ situacao: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  const recarregar = useCallback(() => {
    setEstado({ situacao: 'carregando' });
    setTentativa((t) => t + 1);
  }, []);

  useEffect(() => {
    let ativo = true;
    obterFotoDoCarrinho(getToken)
      .then((foto) => ativo && setEstado({ situacao: 'pronto', foto }))
      .catch((e: unknown) => {
        if (!ativo) return;
        const mensagem = e instanceof Error ? e.message : 'Tente de novo em instantes.';
        setEstado({ situacao: 'erro', mensagem, recarregar });
      });
    return () => {
      ativo = false;
    };
  }, [getToken, tentativa, recarregar]);

  return estado;
}
