import type { FotoDoCarrinho } from '../api/checkout';
import { formatarPreco, textoItens } from '../formato';
import type { OpcaoDeFrete } from '../estado/CheckoutContext';

interface Props {
  foto: FotoDoCarrinho;
  frete: OpcaoDeFrete | null;
}

/** Resumo do pedido, fixo ao lado de todas as etapas. O frete só entra no total depois de escolhido. */
export function Resumo({ foto, frete }: Props) {
  // O pedido-service não aplica cupom: o valor cobrado é subtotal + frete. O resumo mostra o que será cobrado
  // (e avisa do cupom) em vez de um total menor que o do pedido criado.
  const total = foto.subtotal + (frete?.valor ?? 0);
  return (
    <aside className="chk-resumo" aria-label="Resumo do pedido">
      <h2 className="h3">Resumo do pedido</h2>
      <p className="muted" style={{ margin: 0 }}>
        {textoItens(foto.quantidadeTotal)}
      </p>
      <ul className="chk-itens">
        {foto.itens.map((item) => (
          <li key={item.produtoId}>
            <span>
              {item.quantidade}× {item.nome}
            </span>
            <span className="chk-valor">{formatarPreco(item.subtotal)}</span>
          </li>
        ))}
      </ul>
      {foto.desconto > 0 && (
        <p className="chk-aviso" role="note">
          O cupom ({formatarPreco(foto.desconto)}) ainda não é aplicado ao pedido: o total abaixo é o valor cobrado.
        </p>
      )}
      <dl className="chk-totais">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatarPreco(foto.subtotal)}</dd>
        </div>
        <div>
          <dt>Frete</dt>
          <dd>{frete ? (frete.valor === 0 ? 'Grátis' : formatarPreco(frete.valor)) : 'a escolher'}</dd>
        </div>
        <div className="chk-total">
          <dt>Total</dt>
          <dd aria-live="polite">{formatarPreco(total)}</dd>
        </div>
      </dl>
    </aside>
  );
}
