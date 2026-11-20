/**
 * Adapter do ViaCEP (https://viacep.com.br): completa rua, bairro, cidade e UF a partir do CEP. É a única chamada
 * do MFE que não passa pelo gateway: o ViaCEP é um serviço público de terceiros, só leitura, sem dado do cliente
 * além do CEP digitado. Trocar de provedor de CEP é mexer só neste arquivo.
 */
export type EnderecoDoCep = { logradouro: string; bairro: string; cidade: string; uf: string };

/** `null` quando o CEP tem formato válido mas não existe. Falha de rede/HTTP lança erro (o chamador segue sem preencher). */
export async function buscarCep(cep: string, sinal?: AbortSignal): Promise<EnderecoDoCep | null> {
  const base = import.meta.env.VITE_VIACEP_URL ?? 'https://viacep.com.br/ws';
  const resposta = await fetch(`${base}/${cep.replace(/\D/g, '')}/json/`, { signal: sinal });
  // O ViaCEP responde 400 para CEP malformado; para nós isso também é "não existe".
  if (resposta.status === 400) return null;
  if (!resposta.ok) throw new Error(`ViaCEP respondeu ${resposta.status}`);
  const dados = (await resposta.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
  if (dados.erro) return null;
  return {
    logradouro: dados.logradouro ?? '',
    bairro: dados.bairro ?? '',
    cidade: dados.localidade ?? '',
    uf: (dados.uf ?? '').toUpperCase(),
  };
}
