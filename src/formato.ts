export const formatarPreco = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const textoItens = (quantidade: number) => `${quantidade} ${quantidade === 1 ? 'item' : 'itens'}`;
