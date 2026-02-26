import { InlineKeyboard } from 'grammy';
import type { ChainConfig, Token } from '@urban-blazer/goblink-sdk';

const PAGE_SIZE = 9;
const COLS = 3;

// --- Main Menu ---

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔄 New Transfer', 'action:transfer')
    .text('📋 History', 'action:history')
    .row()
    .text('💰 Prices', 'action:prices')
    .text('📒 Addresses', 'action:addressbook')
    .row()
    .text('❓ Help', 'action:help');
}

// --- Chain Selection ---

export function chainSelectKeyboard(
  chains: ChainConfig[],
  page: number,
  callbackPrefix: string,
): InlineKeyboard {
  const start = page * PAGE_SIZE;
  const pageChains = chains.slice(start, start + PAGE_SIZE);
  const kb = new InlineKeyboard();

  for (let i = 0; i < pageChains.length; i++) {
    const chain = pageChains[i]!;
    kb.text(chain.name, `${callbackPrefix}:${chain.id}`);
    if ((i + 1) % COLS === 0 && i < pageChains.length - 1) {
      kb.row();
    }
  }

  kb.row();
  const totalPages = Math.ceil(chains.length / PAGE_SIZE);
  if (page > 0) {
    kb.text('◂ Back', `page:${callbackPrefix}:${page - 1}`);
  }
  if (page < totalPages - 1) {
    kb.text('More ▸', `page:${callbackPrefix}:${page + 1}`);
  }
  kb.row().text('✖ Cancel', 'action:cancel');

  return kb;
}

// --- Token Selection ---

export function tokenSelectKeyboard(
  tokens: Token[],
  page: number,
  callbackPrefix: string,
): InlineKeyboard {
  const start = page * PAGE_SIZE;
  const pageTokens = tokens.slice(start, start + PAGE_SIZE);
  const kb = new InlineKeyboard();

  for (let i = 0; i < pageTokens.length; i++) {
    const token = pageTokens[i]!;
    kb.text(token.symbol, `${callbackPrefix}:${token.symbol}`);
    if ((i + 1) % COLS === 0 && i < pageTokens.length - 1) {
      kb.row();
    }
  }

  kb.row();
  const totalPages = Math.ceil(tokens.length / PAGE_SIZE);
  if (page > 0) {
    kb.text('◂ Back', `page:${callbackPrefix}:${page - 1}`);
  }
  if (page < totalPages - 1) {
    kb.text('More ▸', `page:${callbackPrefix}:${page + 1}`);
  }
  kb.row().text('◂ Back to Chains', 'action:back_to_chains');

  return kb;
}

// --- Amount Presets ---

/**
 * Clean amount presets based on token price tier.
 */
export function amountKeyboard(tokenSymbol: string, price?: number): InlineKeyboard {
  const presets = getAmountPresets(tokenSymbol, price);
  const kb = new InlineKeyboard();

  for (let i = 0; i < presets.length; i++) {
    kb.text(presets[i]!, `amount:${presets[i]}`);
    if ((i + 1) % 4 === 0 && i < presets.length - 1) kb.row();
  }

  kb.row().text('✏️ Custom', 'amount:custom');
  kb.row().text('✖ Cancel', 'action:cancel');
  return kb;
}

function getAmountPresets(_symbol: string, price?: number): string[] {
  if (!price || price <= 0) return ['1', '5', '10', '50'];

  // Pick clean round numbers based on price per token
  if (price >= 10000)  return ['0.001', '0.005', '0.01', '0.05'];   // BTC
  if (price >= 1000)   return ['0.01', '0.05', '0.1', '0.5'];       // ETH
  if (price >= 100)    return ['0.1', '0.5', '1', '5'];              // BNB, SOL-like
  if (price >= 10)     return ['1', '5', '10', '50'];                // mid-range
  if (price >= 0.5)    return ['5', '10', '50', '100'];              // NEAR, SUI, XRP
  if (price >= 0.01)   return ['50', '100', '500', '1000'];          // low-price
  return ['100', '500', '1000', '5000'];                             // micro-price
}

// --- Confirm / Cancel ---

export function confirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Confirm', 'confirm:yes')
    .text('✖ Cancel', 'confirm:no');
}

// --- Transfer Status ---

export function transferStatusKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔄 New Transfer', 'action:transfer')
    .text('📋 History', 'action:history');
}

// --- Sort chains with top chains first ---

const TOP_CHAINS = [
  'ethereum',
  'solana',
  'sui',
  'base',
  'near',
  'arbitrum',
  'bnb',
  'polygon',
  'optimism',
];

export function sortChains(chains: ChainConfig[]): ChainConfig[] {
  const sorted: ChainConfig[] = [];
  for (const id of TOP_CHAINS) {
    const chain = chains.find((c) => c.id === id);
    if (chain) sorted.push(chain);
  }
  for (const chain of chains) {
    if (!TOP_CHAINS.includes(chain.id)) {
      sorted.push(chain);
    }
  }
  return sorted;
}

// --- Sort tokens: native first, stablecoins, then rest ---

const STABLECOINS = ['USDC', 'USDT', 'DAI', 'BUSD'];

export function sortTokens(tokens: Token[], nativeSymbol: string): Token[] {
  const native: Token[] = [];
  const stables: Token[] = [];
  const rest: Token[] = [];

  for (const t of tokens) {
    if (t.symbol.toUpperCase() === nativeSymbol.toUpperCase()) {
      native.push(t);
    } else if (STABLECOINS.includes(t.symbol.toUpperCase())) {
      stables.push(t);
    } else {
      rest.push(t);
    }
  }
  return [...native, ...stables, ...rest];
}
