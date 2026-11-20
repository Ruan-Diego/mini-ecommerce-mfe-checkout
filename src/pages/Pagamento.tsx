import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button, Input } from '@ruan-diego/mini-design-system';
import type { FotoDoCarrinho } from '../api/checkout';
import { criarPedido, novaChaveDeIdempotencia } from '../api/pedidos';
import { ErroDeApi } from '../api/http';
import { pagar } from '../api/pagamentos';
import { LayoutCheckout } from '../components/LayoutCheckout';
import { useCheckout } from '../estado/CheckoutContext';
import { formatarPreco } from '../formato';
import { formatarNumero, formatarValidade, soDigitos, validarCartao, type CamposCartao, type ErrosCartao } from './cartao';

type Metodo = 'CARTAO' | 'PIX';
const VAZIO: CamposCartao = { numero: '', nome: '', validade: '', cvv: '' };

/** Etapa 3: pagar com cartão ou Pix. Sem endereço ou frete escolhidos, volta para a etapa que falta. */
export function Pagamento() {
  const { endereco, frete, basePath } = useCheckout();
  if (!endereco) return <Navigate to={`${basePath}/endereco`} replace />;
  if (!frete) return <Navigate to={`${basePath}/frete`} replace />;
  return (
    <LayoutCheckout etapa="Pagamento" titulo="Pagamento">
      {(foto) => <Formulario foto={foto} />}
    </LayoutCheckout>
  );
}

function Formulario({ foto }: { foto: FotoDoCarrinho }) {
  const { basePath, getToken, eventBus, endereco, frete, pedidoPendente, guardarPedido } = useCheckout();
  const navigate = useNavigate();
  const [metodo, setMetodo] = useState<Metodo>('CARTAO');
  const [campos, setCampos] = useState<CamposCartao>(VAZIO);
  const [erros, setErros] = useState<ErrosCartao>({});
  const [enviando, setEnviando] = useState(false);
  // Pedido cancelado (pagamento recusado ou já cancelado no servidor): a tela só oferece voltar à loja.
  const [cancelado, setCancelado] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'recusa' | 'erro'; texto: string } | null>(null);

  // Trava contra clique duplo: o `enviando` do estado só vale no próximo render, e dois cliques podem chegar
  // antes dele. O ref muda na hora, então o segundo clique encontra a trava fechada.
  const emAndamento = useRef(false);
  // Chaves de idempotência: uma por pedido e uma por tentativa de pagamento. Só são trocadas quando o servidor
  // respondeu de fato; se a resposta se perdeu na rede, repetir com a mesma chave é seguro.
  const chavePedido = useRef<string | null>(null);
  const chavePagamento = useRef<string | null>(null);

  const total = foto.subtotal + (frete?.valor ?? 0);
  const assinatura = JSON.stringify({ e: endereco, f: frete?.codigo, i: foto.itens.map((i) => [i.produtoId, i.quantidade, i.precoUnitario]) });

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (emAndamento.current || cancelado || !endereco || !frete) return;

    if (metodo === 'CARTAO') {
      const encontrados = validarCartao(campos);
      setErros(encontrados);
      const primeiro = Object.keys(encontrados)[0];
      if (primeiro) {
        document.getElementById(`cartao-${primeiro}`)?.focus();
        return;
      }
    }

    emAndamento.current = true;
    setEnviando(true);
    setMensagem(null);
    // Em caso de sucesso a trava NÃO é solta: a tela só sai do ar no próximo render, e um clique nesse intervalo
    // pagaria o pedido outra vez. Recusa e erro soltam a trava para o cliente tentar de novo.
    let soltarTrava = true;
    try {
      // 1) Pedido: criado uma vez por compra. Depois de uma recusa, a nova tentativa paga o MESMO pedido.
      let pedido = pedidoPendente?.assinatura === assinatura ? pedidoPendente : null;
      if (!pedido) {
        chavePedido.current ??= novaChaveDeIdempotencia();
        const criado = await criarPedido(getToken, foto, endereco, frete.codigo, chavePedido.current);
        pedido = { id: criado.id, total: criado.total, assinatura };
        guardarPedido(pedido);
        chavePedido.current = null;
      }

      // 2) Pagamento do valor que o servidor calculou para o pedido.
      chavePagamento.current ??= novaChaveDeIdempotencia();
      let pagamento;
      try {
        pagamento = await pagar(getToken, pedido.id, pedido.total, metodo, chavePagamento.current, metodo === 'CARTAO' ? soDigitos(campos.numero) : undefined);
      } catch (e) {
        if (e instanceof ErroDeApi && e.status === 409) {
          // O pedido já foi cancelado (pagamento recusado antes, estoque, prazo): não há o que pagar neste pedido.
          chavePagamento.current = null;
          guardarPedido(null);
          setCancelado(true);
          setMensagem({ tipo: 'erro', texto: e.message });
          return;
        }
        throw e;
      }
      chavePagamento.current = null;

      if (pagamento.status === 'RECUSADO') {
        // Pagamento recusado cancela o pedido (e libera o estoque): uma nova tentativa exige uma nova compra.
        guardarPedido(null);
        setCancelado(true);
        setMensagem({ tipo: 'recusa', texto: pagamento.motivoRecusa ?? 'O pagamento foi recusado.' });
      } else if (metodo === 'PIX') {
        soltarTrava = false;
        navigate(`${basePath}/pix/${pedido.id}`);
      } else {
        soltarTrava = false;
        navigate(`${basePath}/confirmado/${pedido.id}`);
      }
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível concluir o pagamento.' });
    } finally {
      if (soltarTrava) {
        emAndamento.current = false;
        setEnviando(false);
      }
    }
  }

  const campo = (nome: keyof CamposCartao, rotulo: string, extra: Record<string, unknown> = {}) => (
    <Input
      id={`cartao-${nome}`}
      label={rotulo}
      value={campos[nome]}
      erro={erros[nome]}
      onChange={(ev) => setCampos((c) => ({ ...c, [nome]: ev.target.value }))}
      {...extra}
    />
  );

  return (
    <form onSubmit={enviar} noValidate className="chk-principal" aria-busy={enviando}>
      <div role="tablist" aria-label="Forma de pagamento" className="chk-abas">
        {(['CARTAO', 'PIX'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`aba-${m}`}
            aria-selected={metodo === m}
            aria-controls="painel-pagamento"
            className="chk-aba"
            disabled={enviando}
            onClick={() => {
              setMetodo(m);
              setMensagem(null);
            }}
          >
            {m === 'CARTAO' ? 'Cartão' : 'Pix'}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="painel-pagamento" aria-labelledby={`aba-${metodo}`} className="chk-painel">
        {metodo === 'CARTAO' ? (
          <>
            {campo('numero', 'Número do cartão', {
              inputMode: 'numeric',
              autoComplete: 'cc-number',
              onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setCampos((c) => ({ ...c, numero: formatarNumero(ev.target.value) })),
            })}
            {campo('nome', 'Nome impresso no cartão', { autoComplete: 'cc-name' })}
            <div className="chk-linha2">
              {campo('validade', 'Validade (MM/AA)', {
                inputMode: 'numeric',
                autoComplete: 'cc-exp',
                placeholder: 'MM/AA',
                onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setCampos((c) => ({ ...c, validade: formatarValidade(ev.target.value) })),
              })}
              {campo('cvv', 'CVV', {
                inputMode: 'numeric',
                autoComplete: 'cc-csc',
                maxLength: 4,
                onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setCampos((c) => ({ ...c, cvv: soDigitos(ev.target.value) })),
              })}
            </div>
          </>
        ) : (
          <p style={{ margin: 0 }}>Ao confirmar, geramos um código Pix copia e cola. O código vale 30 minutos.</p>
        )}
      </div>

      {mensagem && (
        <div className="chk-recusa" role="alert">
          <p>
            {mensagem.tipo === 'recusa'
              ? `Pagamento recusado: ${mensagem.texto}. O pedido foi cancelado e o estoque liberado; volte à loja e refaça a compra.`
              : cancelado
                ? `Este pedido foi cancelado. ${mensagem.texto}`
                : `Não foi possível concluir o pagamento. ${mensagem.texto}`}
          </p>
        </div>
      )}

      {cancelado ? (
        <div className="chk-acoes">
          <Button type="button" onClick={() => eventBus.emit('navegar', { rota: '/' })}>
            Voltar à loja
          </Button>
        </div>
      ) : (
        <div className="chk-acoes">
          <Button type="button" variante="secundario" disabled={enviando} onClick={() => navigate(`${basePath}/frete`)}>
            Voltar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? (
              <>
                <span className="chk-spinner" aria-hidden="true" />
                Processando…
              </>
            ) : (
              `Pagar ${formatarPreco(total)}`
            )}
          </Button>
        </div>
      )}
    </form>
  );
}
