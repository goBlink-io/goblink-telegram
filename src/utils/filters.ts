/**
 * Chain and token filters — must match goblink.io exactly.
 * Source of truth: goblink/apps/web/src/components/SwapForm.tsx + lib/token-filters.ts
 */

/** Only these 12 chains are active on goblink.io */
export const ACTIVE_CHAIN_IDS = new Set([
  'aptos',
  'arbitrum',
  'base',
  'bsc',
  'ethereum',
  'near',
  'optimism',
  'polygon',
  'solana',
  'starknet',
  'sui',
  'tron',
]);

/** Tokens hidden from all selectors (obscure/meme/incomplete) */
export const HIDDEN_TOKEN_SYMBOLS = new Set([
  'ABG', 'ADI', 'ALEO', 'APT', 'BERA', 'BLACKDRAGON', 'BOME', 'BRETT',
  'cbBTC', 'CFI', 'EURe', 'FMS', 'GBPe', 'HAPI', 'INX', 'ITLX', 'JAMBO',
  'KAITO', 'LOUD', 'MELANIA', 'MOG', 'mpDAO', 'NearKat', 'NPRO', 'PENGU',
  'PUBLIC', 'PURGE', 'RHEA', 'SAFE', 'SPX', 'SWEAT', 'TITN', 'TRUMP',
  'TURBO', 'USD1', 'USDf',
]);

export function isActiveChain(chainId: string): boolean {
  return ACTIVE_CHAIN_IDS.has(chainId.toLowerCase());
}

/** Map user-friendly aliases to SDK chain IDs */
const CHAIN_ALIASES: Record<string, string> = {
  'bnb': 'bsc',
};

/** Normalize a chain identifier to the SDK chain ID (e.g. 'bnb' → 'bsc') */
export function normalizeChainId(chain: string): string {
  const lower = chain.toLowerCase();
  return CHAIN_ALIASES[lower] ?? lower;
}

export function filterTokensBySymbol<T extends { symbol: string }>(tokens: T[]): T[] {
  return tokens.filter((t) => !HIDDEN_TOKEN_SYMBOLS.has(t.symbol));
}
