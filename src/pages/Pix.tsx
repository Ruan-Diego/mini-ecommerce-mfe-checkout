import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@ruan-diego/mini-design-system';
import { pagamentosDoPedido, simularPagamentoPix, type Pagamento } from '../api/pagamentos';
import { QrCode } from '../components/QrCode';
import { useCheckout } from '../estado/CheckoutContext';
import { formatarPreco } from '../formato';
import '../components/checkout.css';

/** Intervalo da consulta do status do pagamento. */
export const INTERVALO_DA_CONSULTA_MS = 5000;

/** O botão "Simular pagamento" só existe no ambiente fake (desenvolvimento ou VITE_SIMULAR_PIX=true). */
const SIMULAR = import.meta.env.DEV || import.meta.env.VITE_SIMULAR_PIX === 'true';
const SEGREDO_DO_WEBHOOK = import.meta.env.VITE_WEBHOOK_SEGREDO ?? 'dev-segredo-do-webhook';

export const formatarRestante = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** O pagamento Pix mais recente do pedido (a lista pode ter tentativas anteriores). */
const maisRecentePix = (lista: Pagamento[]) =>
  lista
    .filter((p) => p.metodo === 'PIX')
    .sort((a, b) => (a.criadoEm ?? '').localeCompare(b.criadoEm ?? ''))
    .at(-1);

/** Tela Aguardando Pix: QR code, copia e cola, contagem de 30 minutos e consulta do status a cada 5 s. */
export function Pix() {
  const { pedidoId = '' } = useParams();
  const { basePath, getToken, eventBus } = useCheckout();
  const navigate = useNavigate();
  const [pagamento, setPagamento] = useState<Pagamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const consultando = useRef(false);

  const consultar = useCallback(async () => {
    if (consultando.current) return;
    consultando.current = true;
    try {
      const atual = maisRecentePix(await pagamentosDoPedido(getToken, pedidoId));
      if (!atual) {
        setErro('Não encontramos um pagamento Pix para este pedido.');
        return;
      }
      setErro(null);
      setPagamento(atual);
    } catch (e) {
      // Falha de rede numa consulta não derruba a tela: a próxima rodada tenta de novo.
      setErro(e instanceof Error ? e.message : 'Não foi possível consultar o pagamento.');
    } finally {
      consultando.current = false;
    }
  }, [getToken, pedidoId]);

  const status = pagamento?.status;
  const emEspera = !status || status === 'PENDENTE';

  // Consulta na entrada e depois a cada 5 s, enquanto o pagamento estiver pendente.
  useEffect(() => {
    const id = setTimeout(() => void consultar(), 0);
    return () => clearTimeout(id);
  }, [consultar]);
  useEffect(() => {
    if (!emEspera) return;
    const id = setInterval(() => void consultar(), INTERVALO_DA_CONSULTA_MS);
    return () => clearInterval(id);
  }, [consultar, emEspera]);

  // Contador regressivo (1 s). Só para o relógio de tela: quem decide se expirou é o servidor.
  useEffect(() => {
    if (!emEspera) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [emEspera]);

  useEffect(() => {
    if (status === 'APROVADO') navigate(`${basePath}/confirmado/${pedidoId}`, { replace: true });
  }, [status, navigate, basePath, pedidoId]);

  const restante = pagamento?.pixExpiraEm ? new Date(pagamento.pixExpiraEm).getTime() - agora : null;
  const expirado = status === 'EXPIRADO' || status === 'RECUSADO' || (emEspera && restante !== null && restante <= 0);

  async function copiar() {
    if (!pagamento?.pixCodigo) return;
    try {
      await navigator.clipboard.writeText(pagamento.pixCodigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro('Não foi possível copiar. Selecione o código e copie manualmente.');
    }
  }

  async function simular() {
    if (!pagamento || ocupado) return;
    setOcupado(true);
    try {
      await simularPagamentoPix(pagamento.transacaoId, SEGREDO_DO_WEBHOOK);
      await consultar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível simular o pagamento.');
    } finally {
      setOcupado(false);
    }
  }

  if (!pagamento) {
    return (
      <section className="wrap chk">
        <h1 className="h2">Aguardando Pix</h1>
        {erro ? (
          <div className="chk-erro" role="alert">
            <p>{erro}</p>
            <Button variante="secundario" onClick={() => void consultar()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <div className="chk-skeleton" role="status" aria-label="Carregando o pagamento" />
        )}
      </section>
    );
  }

  return (
    <section className="wrap chk">
      <h1 className="h2">{expirado ? 'Pix expirado' : 'Aguardando pagamento via Pix'}</h1>
      <div className="chk-painel chk-pix">
        {expirado ? (
          <>
            <p role="alert" style={{ margin: 0 }}>
              O código Pix expirou e o pedido foi cancelado (o estoque é liberado). Volte à loja e refaça a compra.
            </p>
            <div className="chk-acoes">
              <Button onClick={() => eventBus.emit('navegar', { rota: '/' })}>Voltar à loja</Button>
            </div>
          </>
        ) : (
          <>
            {pagamento.pixCodigo && <QrCode texto={pagamento.pixCodigo} rotulo="QR code do Pix" />}
            <p className="muted" style={{ margin: 0 }}>
              Valor: <strong className="chk-valor">{formatarPreco(pagamento.valor)}</strong>
            </p>
            <div>
              <label htmlFor="pix-codigo" className="muted" style={{ display: 'block', marginBottom: 4 }}>
                Pix copia e cola
              </label>
              <textarea id="pix-codigo" className="chk-codigo" readOnly rows={3} value={pagamento.pixCodigo ?? ''} />
            </div>
            <div className="chk-acoes">
              <Button onClick={() => void copiar()}>Copiar</Button>
              {SIMULAR && (
                <Button variante="secundario" onClick={() => void simular()} disabled={ocupado}>
                  Simular pagamento
                </Button>
              )}
            </div>
            <p aria-live="polite" className="muted" style={{ margin: 0, minHeight: 24 }}>
              {copiado ? 'Código copiado.' : ''}
            </p>
            {restante !== null && (
              <p style={{ margin: 0 }}>
                O código expira em{' '}
                <strong className="chk-valor" role="timer" aria-live="off">
                  {formatarRestante(restante)}
                </strong>
              </p>
            )}
            <p style={{ margin: 0 }} role="status">
              Aguardando pagamento…
            </p>
          </>
        )}
        {erro && (
          <p className="chk-aviso" role="alert" style={{ margin: 0 }}>
            {erro}
          </p>
        )}
      </div>
    </section>
  );
}
