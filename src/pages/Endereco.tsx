import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@ruan-diego/mini-design-system';
import type { Endereco as EnderecoDados } from '../api/checkout';
import { LayoutCheckout } from '../components/LayoutCheckout';
import { useCheckout } from '../estado/CheckoutContext';
import {
  ENDERECO_VAZIO,
  formatarCep,
  lerEnderecosSalvos,
  normalizar,
  salvarEndereco,
  validarEndereco,
  type Erros,
} from './enderecos';

const rotulo = (e: EnderecoDados) =>
  `${e.logradouro}, ${e.numero}${e.complemento ? ` · ${e.complemento}` : ''} — ${e.bairro}, ${e.cidade}/${e.uf} · CEP ${formatarCep(e.cep)}`;

/** Etapa 1: escolher um endereço salvo ou preencher um novo. Seguir leva ao frete. */
export function Endereco() {
  return (
    <LayoutCheckout etapa="Endereço" titulo="Endereço de entrega">
      {() => <Escolha />}
    </LayoutCheckout>
  );
}

function Escolha() {
  const { basePath, endereco, escolherEndereco, escolherFrete } = useCheckout();
  const navigate = useNavigate();
  const [salvos] = useState(lerEnderecosSalvos);
  const [novo, setNovo] = useState(salvos.length === 0);
  const [indice, setIndice] = useState(() => {
    const i = endereco ? salvos.findIndex((s) => JSON.stringify(s) === JSON.stringify(endereco)) : 0;
    return Math.max(i, 0);
  });
  const [campos, setCampos] = useState<EnderecoDados>(ENDERECO_VAZIO);
  const [erros, setErros] = useState<Erros>({});
  const [guardar, setGuardar] = useState(true);

  function seguir(e: EnderecoDados) {
    // O frete depende do CEP: trocar de endereço invalida a escolha anterior.
    if (endereco && endereco.cep !== e.cep) escolherFrete(null);
    escolherEndereco(e);
    navigate(`${basePath}/frete`);
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!novo) {
      seguir(salvos[indice]);
      return;
    }
    const encontrados = validarEndereco(campos);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      // Leva o foco ao primeiro campo com erro (quem usa teclado ou leitor de tela não precisa procurar).
      const primeiro = Object.keys(encontrados)[0];
      document.getElementById(`end-${primeiro}`)?.focus();
      return;
    }
    const limpo = normalizar(campos);
    if (guardar) salvarEndereco(limpo);
    seguir(limpo);
  }

  const campo = (nome: keyof EnderecoDados, rotuloCampo: string, classe: string, extra: Record<string, unknown> = {}) => (
    <div className={classe}>
      <Input
        id={`end-${nome}`}
        label={rotuloCampo}
        value={campos[nome]}
        erro={erros[nome]}
        onChange={(ev) => setCampos((c) => ({ ...c, [nome]: ev.target.value }))}
        {...extra}
      />
    </div>
  );

  return (
    <form onSubmit={enviar} noValidate className="chk-principal">
      {salvos.length > 0 && !novo && (
        <fieldset className="chk-lista" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="h3" style={{ marginBottom: 12 }}>
            Endereços salvos
          </legend>
          {salvos.map((s, i) => (
            <label key={`${s.cep}-${s.numero}-${i}`} className="chk-opcao" htmlFor={`end-salvo-${i}`}>
              <input id={`end-salvo-${i}`} type="radio" name="endereco" checked={indice === i} onChange={() => setIndice(i)} />
              <strong>{s.destinatario}</strong>
              <span className="muted">{rotulo(s)}</span>
            </label>
          ))}
        </fieldset>
      )}

      {novo && (
        <div className="chk-form">
          <h2 className="h3">Novo endereço</h2>
          {campo('destinatario', 'Destinatário', 'c6', { autoComplete: 'name', required: true })}
          {campo('cep', 'CEP', 'c2', {
            inputMode: 'numeric',
            autoComplete: 'postal-code',
            required: true,
            onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setCampos((c) => ({ ...c, cep: formatarCep(ev.target.value) })),
          })}
          {campo('logradouro', 'Rua', 'c4', { autoComplete: 'address-line1', required: true })}
          {campo('numero', 'Número', 'c2', { required: true })}
          {campo('complemento', 'Complemento (opcional)', 'c4', { autoComplete: 'address-line2' })}
          {campo('bairro', 'Bairro', 'c2', { required: true })}
          {campo('cidade', 'Cidade', 'c3', { autoComplete: 'address-level2', required: true })}
          {campo('uf', 'UF', 'c1', {
            maxLength: 2,
            autoComplete: 'address-level1',
            required: true,
            onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setCampos((c) => ({ ...c, uf: ev.target.value.toUpperCase() })),
          })}
          <label className="chk-form-check">
            <input type="checkbox" checked={guardar} onChange={(ev) => setGuardar(ev.target.checked)} />
            Salvar este endereço neste navegador
          </label>
        </div>
      )}

      <div className="chk-acoes">
        {salvos.length > 0 && (
          <Button type="button" variante="secundario" onClick={() => setNovo((n) => !n)}>
            {novo ? 'Usar um endereço salvo' : 'Novo endereço'}
          </Button>
        )}
        <Button type="submit">Continuar</Button>
      </div>
    </form>
  );
}
