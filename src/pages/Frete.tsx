import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@ruan-diego/mini-design-system';
import { cotarFrete } from '../api/frete';
import type { FotoDoCarrinho } from '../api/checkout';
import { LayoutCheckout } from '../components/LayoutCheckout';
import { useCheckout, type OpcaoDeFrete } from '../estado/CheckoutContext';
import { formatarPreco } from '../formato';

const prazo = (dias: number) => (dias === 1 ? '1 dia útil' : `${dias} dias úteis`);

/** Etapa 2: escolher o frete. Sem endereço escolhido não há o que cotar: volta para a etapa 1. */
export function Frete() {
  const { endereco, basePath } = useCheckout();
  if (!endereco) return <Navigate to={`${basePath}/endereco`} replace />;
  return (
    <LayoutCheckout etapa="Frete" titulo="Escolha do frete">
      {(foto) => <Opcoes foto={foto} cep={endereco.cep} />}
    </LayoutCheckout>
  );
}

type Cotacao = { situacao: 'carregando' } | { situacao: 'erro'; mensagem: string } | { situacao: 'pronta'; opcoes: OpcaoDeFrete[] };

function Opcoes({ foto, cep }: { foto: FotoDoCarrinho; cep: string }) {
  const { basePath, getToken, frete, escolherFrete } = useCheckout();
  const navigate = useNavigate();
  const [cotacao, setCotacao] = useState<Cotacao>({ situacao: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controle = new AbortController();
    cotarFrete(getToken, cep, foto.subtotal, controle.signal)
      .then((opcoes) => {
        setCotacao({ situacao: 'pronta', opcoes });
        // Mantém a escolha anterior se ela ainda existe; senão, pré-seleciona a mais barata.
        const anterior = opcoes.find((o) => o.codigo === frete?.codigo);
        const maisBarata = [...opcoes].sort((a, b) => a.valor - b.valor || a.prazoDias - b.prazoDias)[0];
        escolherFrete(anterior ?? maisBarata ?? null);
      })
      .catch((e: unknown) => {
        if (controle.signal.aborted) return;
        setCotacao({ situacao: 'erro', mensagem: e instanceof Error ? e.message : '' });
      });
    return () => controle.abort();
    // A cotação refaz só se o CEP, o subtotal ou a tentativa mudarem; `frete` é lido uma vez, na chegada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, cep, foto.subtotal, tentativa]);

  if (cotacao.situacao === 'carregando') return <div className="chk-skeleton" role="status" aria-label="Calculando o frete" />;

  if (cotacao.situacao === 'erro') {
    return (
      <div className="chk-erro" role="alert">
        <p>Não foi possível calcular o frete. {cotacao.mensagem}</p>
        <Button
          variante="secundario"
          onClick={() => {
            setCotacao({ situacao: 'carregando' });
            setTentativa((t) => t + 1);
          }}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <form
      className="chk-principal"
      onSubmit={(e) => {
        e.preventDefault();
        if (frete) navigate(`${basePath}/pagamento`);
      }}
    >
      <fieldset className="chk-lista" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="h3" style={{ marginBottom: 12 }}>
          Opções de entrega
        </legend>
        {cotacao.opcoes.map((o) => (
          <label key={o.codigo} className="chk-opcao" htmlFor={`frete-${o.codigo}`}>
            <input
              id={`frete-${o.codigo}`}
              type="radio"
              name="frete"
              checked={frete?.codigo === o.codigo}
              onChange={() => escolherFrete(o)}
            />
            <strong>
              {o.nome} · {o.valor === 0 ? 'Grátis' : formatarPreco(o.valor)}
            </strong>
            <span className="muted">Entrega em {prazo(o.prazoDias)}</span>
          </label>
        ))}
      </fieldset>
      <div className="chk-acoes">
        <Button type="button" variante="secundario" onClick={() => navigate(`${basePath}/endereco`)}>
          Voltar
        </Button>
        <Button type="submit" disabled={!frete}>
          Continuar
        </Button>
      </div>
    </form>
  );
}
