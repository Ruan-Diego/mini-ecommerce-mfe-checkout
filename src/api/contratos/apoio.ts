/**
 * Apoio dos testes de contrato (Pact) do checkout com carrinho, pedido e pagamento.
 *
 * O checkout usa VITE_API_URL = .../api e põe o prefixo do serviço na chamada (/pedidos/pedidos), então o
 * contrato grava o caminho público, como passa pelo gateway. O teste do provider no backend tira o primeiro
 * segmento, como o StripPrefix=2 do gateway (ADR-0005 do backend).
 */
import { rmSync } from 'node:fs';
import path from 'node:path';
import { MatchersV3, PactV3 } from '@pact-foundation/pact';

const { regex } = MatchersV3;

export const PRODUTO = '11111111-1111-4111-8111-111111111111';
export const PEDIDO = '22222222-2222-4222-8222-222222222222';

/** O token é do shell; no contrato, qualquer Bearer (o provider aceita o de exemplo "token-pact"). */
export const obterToken = async () => 'token-pact';
export const AUTORIZACAO = regex(/Bearer .+/.source, 'Bearer token-pact');
export const IDEMPOTENCIA = regex(/.+/.source, 'chave-pact');
export const JSON_UTF8 = regex(/application\/json.*/.source, 'application/json');
/** Instante ISO-8601 em UTC, com ou sem fração de segundo (é como o Jackson escreve um Instant). */
export const instante = (exemplo: string) =>
  regex(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/.source, exemplo);

/** Cria o Pact de um provider, apagando o contrato antigo (o Pact mescla com o arquivo existente). */
export function novoPact(provider: string): PactV3 {
  const pasta = path.resolve(process.cwd(), 'pacts');
  rmSync(path.join(pasta, `mfe-checkout-${provider}.json`), { force: true });
  return new PactV3({ consumer: 'mfe-checkout', provider, dir: pasta, logLevel: 'warn' });
}
