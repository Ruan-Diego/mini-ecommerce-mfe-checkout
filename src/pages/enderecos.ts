import type { Endereco } from '../api/checkout';

export const ENDERECO_VAZIO: Endereco = {
  destinatario: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
};

export type Erros = Partial<Record<keyof Endereco, string>>;

export const soDigitos = (texto: string) => texto.replace(/\D/g, '');

/** CEP no formato 01310-100 (aceita só os dígitos). */
export const formatarCep = (cep: string) => {
  const d = soDigitos(cep).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

/**
 * Regras da tela: todos os campos, menos complemento, são obrigatórios; CEP com 8 dígitos e UF com 2 letras.
 * O backend repete as regras (o domínio é quem manda); aqui só se evita a ida e volta.
 */
export function validarEndereco(e: Endereco): Erros {
  const erros: Erros = {};
  if (!e.destinatario.trim()) erros.destinatario = 'Informe o nome de quem vai receber.';
  if (soDigitos(e.cep).length !== 8) erros.cep = 'Informe um CEP com 8 dígitos.';
  if (!e.logradouro.trim()) erros.logradouro = 'Informe a rua.';
  if (!e.numero.trim()) erros.numero = 'Informe o número.';
  if (!e.bairro.trim()) erros.bairro = 'Informe o bairro.';
  if (!e.cidade.trim()) erros.cidade = 'Informe a cidade.';
  if (!/^[A-Za-z]{2}$/.test(e.uf.trim())) erros.uf = 'Informe a UF com 2 letras.';
  return erros;
}

export function normalizar(e: Endereco): Endereco {
  return {
    destinatario: e.destinatario.trim(),
    cep: soDigitos(e.cep),
    logradouro: e.logradouro.trim(),
    numero: e.numero.trim(),
    complemento: e.complemento.trim(),
    bairro: e.bairro.trim(),
    cidade: e.cidade.trim(),
    uf: e.uf.trim().toUpperCase(),
  };
}

const CHAVE = 'mini:enderecos';

/**
 * Endereços salvos. Ainda não existe serviço de endereços (a conta do cliente é da Fase 6), então ficam no
 * localStorage do navegador. Só este arquivo muda quando houver API. Sem localStorage, a lista vem vazia.
 */
export function lerEnderecosSalvos(): Endereco[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE) ?? '[]') as Endereco[];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function salvarEndereco(novo: Endereco): void {
  try {
    const mesmo = (a: Endereco, b: Endereco) =>
      a.cep === b.cep && a.numero === b.numero && a.complemento === b.complemento && a.destinatario === b.destinatario;
    const outros = lerEnderecosSalvos().filter((e) => !mesmo(e, novo));
    localStorage.setItem(CHAVE, JSON.stringify([novo, ...outros].slice(0, 5)));
  } catch {
    // sem armazenamento: o endereço vale só para este pedido
  }
}
