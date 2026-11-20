import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@ruan-diego/mini-design-system';
import { obterPedido, type Pedido } from '../api/pedidos';
import { pagamentosDoPedido, type Pagamento } from '../api/pagamentos';
import { useCheckout } from '../estado/CheckoutContext';
import { formatarPreco, textoItens } from '../formato';
import '../components/checkout.css';

/** Soma `dias` dias úteis (segunda a sexta) a partir de uma data. Feriados não entram: é uma estimativa. */
export function somarDiasUteis(inicio: Date, dias: number): Date {
  const data = new Date(inicio);
  let faltam = dias;
  while (faltam > 0) {
    data.setDate(data.getDate() + 1);
    const dia = data.getDay();
    if (dia !== 0 && dia !== 6) faltam--;
  }
  return data;
}

const dataLonga = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const formatarCep = (cep: string) => (cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep);

type Carga = { situacao: 'carregando' } | { situacao: 'erro'; mensagem: string } | { situacao: 'pronto'; pedido: Pedido; pagamento: Pagamento | null };

/** Tela final: número do pedido, resumo, previsão de entrega. Ao chegar, avisa que o carrinho foi limpo. */
export function Confirmado() {
  const { pedidoId = '' } = useParams();
  const { getToken, eventBus } = useCheckout();
  const [carga, setCarga] = useState<Carga>({ situacao: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  // A compra terminou: o badge do carrinho zera. Emitido uma vez ao chegar, antes de qualquer consulta, para
  // não depender de o resumo carregar.
  useEffect(() => {
    eventBus.emit('carrinho:limpo', {});
  }, [eventBus]);

  useEffect(() => {
    let ativo = true;
    Promise.all([obterPedido(getToken, pedidoId), pagamentosDoPedido(getToken, pedidoId).catch(() => [] as Pagamento[])])
      .then(([pedido, pagamentos]) => {
        if (!ativo) return;
        const aprovado = pagamentos.find((p) => p.status === 'APROVADO') ?? null;
        setCarga({ situacao: 'pronto', pedido, pagamento: aprovado });
      })
      .catch((e: unknown) => ativo && setCarga({ situacao: 'erro', mensagem: e instanceof Error ? e.message : '' }));
    return () => {
      ativo = false;
    };
  }, [getToken, pedidoId, tentativa]);

  if (carga.situacao === 'carregando') {
    return (
      <section className="wrap chk">
        <div className="chk-skeleton" role="status" aria-label="Carregando o pedido" />
      </section>
    );
  }

  if (carga.situacao === 'erro') {
    return (
      <section className="wrap chk">
        <h1 className="h2">Pedido recebido</h1>
        <div className="chk-erro" role="alert">
          <p>Seu pagamento foi processado, mas não conseguimos carregar o resumo do pedido. {carga.mensagem}</p>
          <Button
            variante="secundario"
            onClick={() => {
              setCarga({ situacao: 'carregando' });
              setTentativa((t) => t + 1);
            }}
          >
            Tentar de novo
          </Button>
        </div>
      </section>
    );
  }

  const { pedido, pagamento } = carga;
  const previsao = somarDiasUteis(new Date(pedido.criadoEm), pedido.frete.prazoDias);
  const quantidade = pedido.itens.reduce((soma, i) => soma + i.quantidade, 0);
  const e = pedido.endereco;

  return (
    <section className="wrap chk">
      <h1 className="h2">Pedido confirmado</h1>
      <p role="status" style={{ margin: 0 }}>
        Obrigado pela compra! Seu pedido <strong className="chk-valor">#{pedido.id.slice(0, 8)}</strong> foi recebido.
      </p>

      <div className="chk-grade">
        <div className="chk-principal">
          <div className="chk-painel">
            <h2 className="h3">Previsão de entrega</h2>
            <p style={{ margin: 0 }}>
              Até <strong>{dataLonga(previsao)}</strong> ({pedido.frete.nome}, {pedido.frete.prazoDias} {pedido.frete.prazoDias === 1 ? 'dia útil' : 'dias úteis'})
            </p>
            <h2 className="h3">Entrega em</h2>
            <p style={{ margin: 0 }}>
              {e.destinatario}
              <br />
              {e.logradouro}, {e.numero}
              {e.complemento ? ` · ${e.complemento}` : ''} — {e.bairro}
              <br />
              {e.cidade}/{e.uf} · CEP {formatarCep(e.cep)}
            </p>
            {pagamento && (
              <>
                <h2 className="h3">Pagamento</h2>
                <p style={{ margin: 0 }}>{pagamento.metodo === 'PIX' ? 'Pix' : 'Cartão'} · aprovado</p>
              </>
            )}
          </div>
          <div className="chk-acoes">
            <Button onClick={() => eventBus.emit('navegar', { rota: `/conta/pedidos/${pedido.id}` })}>Acompanhar pedido</Button>
            <Button variante="secundario" onClick={() => eventBus.emit('navegar', { rota: '/' })}>
              Voltar para a loja
            </Button>
          </div>
        </div>

        <aside className="chk-resumo" aria-label="Resumo do pedido">
          <h2 className="h3">Resumo do pedido</h2>
          <p className="muted" style={{ margin: 0 }}>
            {textoItens(quantidade)}
          </p>
          <ul className="chk-itens">
            {pedido.itens.map((item) => (
              <li key={item.produtoId}>
                <span>
                  {item.quantidade}× {item.nome}
                </span>
                <span className="chk-valor">{formatarPreco(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="chk-totais">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatarPreco(pedido.subtotal)}</dd>
            </div>
            <div>
              <dt>Frete</dt>
              <dd>{pedido.frete.valor === 0 ? 'Grátis' : formatarPreco(pedido.frete.valor)}</dd>
            </div>
            <div className="chk-total">
              <dt>Total</dt>
              <dd>{formatarPreco(pedido.total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
