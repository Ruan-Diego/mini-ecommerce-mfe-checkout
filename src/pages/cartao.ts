export const soDigitos = (texto: string) => texto.replace(/\D/g, '');

/** Algoritmo de Luhn: o dígito final de todo número de cartão é uma soma de verificação dos demais. */
export function luhnValido(numero: string): boolean {
  const d = soDigitos(numero);
  if (d.length < 13 || d.length > 19) return false;
  let soma = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    soma += n;
  }
  return soma % 10 === 0;
}

/** Número em grupos de 4 (aceita só dígitos, até 19). */
export const formatarNumero = (texto: string) => soDigitos(texto).slice(0, 19).replace(/(.{4})/g, '$1 ').trim();

/** Validade em MM/AA. */
export function formatarValidade(texto: string): string {
  const d = soDigitos(texto).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/** A validade vale até o último dia do mês indicado. */
export function validadeValida(texto: string, hoje: Date = new Date()): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(texto);
  if (!m) return false;
  const mes = Number(m[1]);
  const ano = 2000 + Number(m[2]);
  if (mes < 1 || mes > 12) return false;
  return ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes >= hoje.getMonth() + 1);
}

export interface CamposCartao {
  numero: string;
  nome: string;
  validade: string;
  cvv: string;
}

export type ErrosCartao = Partial<Record<keyof CamposCartao, string>>;

export function validarCartao(c: CamposCartao, hoje?: Date): ErrosCartao {
  const erros: ErrosCartao = {};
  if (!luhnValido(c.numero)) erros.numero = 'Número de cartão inválido.';
  if (!c.nome.trim()) erros.nome = 'Informe o nome impresso no cartão.';
  if (!validadeValida(c.validade, hoje)) erros.validade = 'Informe uma validade futura (MM/AA).';
  if (!/^\d{3,4}$/.test(c.cvv)) erros.cvv = 'O CVV tem 3 ou 4 dígitos.';
  return erros;
}
