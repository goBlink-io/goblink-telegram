import type { BotContext } from '../types/index.js';
import { getSDK } from '../services/goblink.js';
import { isActiveChain, filterTokensBySymbol } from '../utils/filters.js';
import { InlineKeyboard } from 'grammy';

const TOP_TOKENS = ['BTC', 'ETH', 'SOL', 'NEAR', 'SUI', 'USDC', 'XRP', 'BNB', 'DOGE', 'ADA'];

export async function priceCommand(ctx: BotContext): Promise<void> {
  const query = ctx.message?.text?.split(/\s+/).slice(1).join(' ').trim().toUpperCase();

  if (query) {
    await showTokenPrice(ctx, query);
  } else {
    await showPriceOverview(ctx);
  }
}

export async function handlePriceCallback(ctx: BotContext, symbol: string): Promise<void> {
  try { await ctx.answerCallbackQuery(); } catch {}
  await showTokenPrice(ctx, symbol, true);
}

async function showPriceOverview(ctx: BotContext): Promise<void> {
  try {
    const sdk = getSDK();
    const allTokens = await sdk.getTokens();
    const tokens = filterTokensBySymbol(allTokens).filter((t) => isActiveChain(t.chain));

    // Deduplicate by symbol, keeping the one with the highest price (most canonical)
    const bySymbol = new Map<string, { symbol: string; price?: number }>();
    for (const t of tokens) {
      const existing = bySymbol.get(t.symbol);
      if (!existing || (t.price ?? 0) > (existing.price ?? 0)) {
        bySymbol.set(t.symbol, { symbol: t.symbol, price: t.price });
      }
    }

    const lines: string[] = ['💰 *Market Prices*\n'];
    for (const sym of TOP_TOKENS) {
      const t = bySymbol.get(sym);
      if (t?.price) {
        lines.push(`*${t.symbol}:* $${formatPrice(t.price)}`);
      }
    }

    lines.push('\n_Use /price TOKEN for any token (e.g. /price LINK)_');

    // Build quick-lookup buttons
    const kb = new InlineKeyboard();
    const row1 = ['BTC', 'ETH', 'SOL', 'NEAR', 'SUI'];
    const row2 = ['XRP', 'BNB', 'DOGE', 'ADA', 'ARB'];
    for (const s of row1) kb.text(s, `price:${s}`);
    kb.row();
    for (const s of row2) kb.text(s, `price:${s}`);

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'Markdown',
      reply_markup: kb,
    });
  } catch (err) {
    console.error('Price overview failed:', err);
    await ctx.reply('Something went wrong fetching prices. Try again.');
  }
}

async function showTokenPrice(ctx: BotContext, symbol: string, edit = false): Promise<void> {
  try {
    const sdk = getSDK();
    const allTokens = await sdk.getTokens();
    const matches = filterTokensBySymbol(allTokens)
      .filter((t) => t.symbol.toUpperCase() === symbol && isActiveChain(t.chain));

    if (matches.length === 0) {
      const msg = `Token "${symbol}" not found. Use /price to see available tokens.`;
      if (edit && ctx.callbackQuery?.message) {
        try { await ctx.editMessageText(msg); } catch { await ctx.reply(msg); }
      } else {
        await ctx.reply(msg);
      }
      return;
    }

    // Use the match with highest price (most canonical)
    const token = matches.reduce((a, b) => ((a.price ?? 0) >= (b.price ?? 0) ? a : b));
    const price = token.price;

    // Find which chains this token is available on
    const chains = [...new Set(matches.map((t) => t.chain))];

    const lines = [
      `💰 *${token.symbol}*`,
      '',
      price ? `Price: *$${formatPrice(price)}*` : 'Price: _unavailable_',
      '',
      `Available on: ${chains.join(', ')}`,
    ];

    const kb = new InlineKeyboard()
      .text('🔄 Transfer ' + token.symbol, 'action:transfer')
      .text('◂ All Prices', 'action:prices');

    const text = lines.join('\n');
    if (edit && ctx.callbackQuery?.message) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
      } catch {
        await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
      }
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
    }
  } catch (err) {
    console.error('Price lookup failed:', err);
    await ctx.reply('Something went wrong. Try again.');
  }
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  if (price >= 0.0001) return price.toFixed(6);
  return price.toExponential(2);
}
