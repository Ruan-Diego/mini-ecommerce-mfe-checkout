const ETAPAS = ['Endereço', 'Frete', 'Pagamento'] as const;
export type Etapa = (typeof ETAPAS)[number];

/** Indicador de etapas: lista ordenada; a etapa atual leva aria-current="step" (não depende só de cor). */
export function Etapas({ atual }: { atual: Etapa }) {
  const indice = ETAPAS.indexOf(atual);
  return (
    <nav aria-label="Etapas do checkout">
      <ol className="chk-etapas">
        {ETAPAS.map((nome, i) => (
          <li key={nome} className={i < indice ? 'feita' : i === indice ? 'atual' : ''} aria-current={i === indice ? 'step' : undefined}>
            <span className="chk-etapa-num" aria-hidden="true">
              {i < indice ? '✓' : i + 1}
            </span>
            {nome}
            {i < indice && <span className="sr"> (concluída)</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
