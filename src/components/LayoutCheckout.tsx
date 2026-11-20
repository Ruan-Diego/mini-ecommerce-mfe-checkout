import type { ReactNode } from 'react';
import { Button } from '@ruan-diego/mini-design-system';
import { useCheckout } from '../estado/CheckoutContext';
import { useFoto, type EstadoFoto } from '../estado/useFoto';
import type { FotoDoCarrinho } from '../api/checkout';
import { Etapas, type Etapa } from './Etapas';
import { Resumo } from './Resumo';
import './checkout.css';

interface Props {
  etapa: Etapa;
  titulo: string;
  /** Recebe a foto do carrinho já carregada (e não vazia). */
  children: (foto: FotoDoCarrinho) => ReactNode;
}

/**
 * Moldura das etapas: título, indicador de etapas e, ao lado, o resumo fixo. Cuida sozinha de carregar a foto do
 * carrinho (esqueleto, erro com "Tentar de novo", carrinho vazio), para cada tela só tratar o próprio conteúdo.
 */
export function LayoutCheckout({ etapa, titulo, children }: Props) {
  const estado = useFoto();
  const { frete, eventBus } = useCheckout();

  return (
    <section className="wrap chk">
      <h1 className="h2">{titulo}</h1>
      <Etapas atual={etapa} />
      <Conteudo estado={estado} frete={frete} irParaLoja={() => eventBus.emit('navegar', { rota: '/' })}>
        {children}
      </Conteudo>
    </section>
  );
}

function Conteudo({
  estado,
  frete,
  irParaLoja,
  children,
}: {
  estado: EstadoFoto;
  frete: ReturnType<typeof useCheckout>['frete'];
  irParaLoja: () => void;
  children: Props['children'];
}) {
  if (estado.situacao === 'carregando') return <div className="chk-skeleton" role="status" aria-label="Carregando o carrinho" />;
  if (estado.situacao === 'erro') {
    return (
      <div className="chk-erro" role="alert">
        <p>Não foi possível carregar o seu carrinho. {estado.mensagem}</p>
        <Button variante="secundario" onClick={estado.recarregar}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (estado.foto.itens.length === 0) {
    return (
      <div className="chk-vazio">
        <p>Seu carrinho está vazio.</p>
        <Button onClick={irParaLoja}>Ir para a loja</Button>
      </div>
    );
  }
  return (
    <div className="chk-grade">
      <div className="chk-principal">{children(estado.foto)}</div>
      <Resumo foto={estado.foto} frete={frete} />
    </div>
  );
}
