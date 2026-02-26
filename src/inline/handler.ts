import type { BotContext } from '../types/index.js';
import { getSDK } from '../services/goblink.js';
import { displaySymbol, formatAmount } from '../utils/formatters.js';
import type { ChainConfig } from '@urban-blazer/goblink-sdk';

// Active chain filter (same as transfer.ts)
const ACTIVE_CHAINS = new Set([
  'ethereum', 'solana', 'sui', 'near', 'base', 'arbitrum',
  'bnb', 'polygon', 'optimism', 'tron', 'aptos', 'starknet',
]);

/**
 * Handle inline queries.
 *
 * Usage: @goBlinkBot <amount> <token> to <chain>
 * Example: @goBlinkBot 100 USDC to solana
 * 
 * Or just: @goBlinkBot → shows help
 */
export async function handleInlineQuery(ctx: BotContext): Promise<void> {
  const query = ctx.inlineQuery?.query?.trim() ?? '';

  if (!query) {
    // Empty query → show usage help
    await ctx.answerInlineQuery([
      {
        type: 'article',
        id: 'help',
        title: '⚡ goBlink — Quick Transfer',
        description: 'Type: 100 USDC to solana',
        input_message_content: {
          message_text:
            '⚡ *goBlink* — Move value anywhere, instantly\\.\n\n' +
            '12 chains \\| 65\\+ tokens \\| Non\\-custodial\n\n' +
            '[Start a transfer](https://t.me/goBlinkBot)',
          parse_mode: 'MarkdownV2',
        },
        thumbnail_url: 'https://goblink.io/icon-512.png',
      },
    ], { cache_time: 300 });
    return;
  }

  // Parse: <amount> <token> [to <chain>]
  const match = query.match(/^(\d+(?:\.\d+)?)\s+(\w+)(?:\s+(?:to|on|→)\s+(\w+))?$/i);

  if (!match) {
    await ctx.answerInlineQuery([
      {
        type: 'article',
        id: 'usage',
        title: '💡 Format: 100 USDC to solana',
        description: 'Try: 50 ETH to base, 1000 NEAR to sui',
        input_message_content: {
          message_text: '⚡ Use @goBlinkBot to send tokens across chains.\n\nFormat: `100 USDC to solana`',
          parse_mode: 'Markdown',
        },
      },
    ], { cache_time: 60 });
    return;
  }

  const amount = match[1]!;
  const tokenQuery = match[2]!.toUpperCase();
  const chainQuery = match[3]?.toLowerCase();

  const sdk = getSDK();
  const allChains = sdk.getChains().filter(c => ACTIVE_CHAINS.has(c.id));

  // Build results — one per destination chain (or specific chain if provided)
  const targetChains = chainQuery
    ? allChains.filter(c => c.id === chainQuery || c.name.toLowerCase() === chainQuery)
    : allChains;

  if (targetChains.length === 0) {
    await ctx.answerInlineQuery([
      {
        type: 'article',
        id: 'no-chain',
        title: `❌ Unknown chain: ${chainQuery}`,
        description: 'Supported: ethereum, solana, sui, near, base, arbitrum, polygon, bnb, optimism, tron, aptos, starknet',
        input_message_content: {
          message_text: `❌ Unknown chain "${chainQuery}". Supported: ethereum, solana, sui, near, base, arbitrum, polygon, bnb, optimism, tron, aptos, starknet`,
        },
      },
    ], { cache_time: 60 });
    return;
  }

  const results = targetChains.slice(0, 10).map((chain: ChainConfig) => ({
    type: 'article' as const,
    id: `transfer-${chain.id}-${tokenQuery}-${amount}`,
    title: `⚡ Send ${amount} ${displaySymbol(tokenQuery)} → ${chain.name}`,
    description: `Tap to start transfer via goBlink`,
    input_message_content: {
      message_text:
        `⚡ *goBlink Transfer*\n\n` +
        `💸 ${formatAmount(amount)} ${displaySymbol(tokenQuery)} → ${chain.name}\n\n` +
        `Non-custodial · No wallet connection needed\n` +
        `Send to a deposit address from any wallet.\n\n` +
        `[Start this transfer](https://t.me/goBlinkBot?start=t_${amount}_${tokenQuery}_${chain.id})`,
      parse_mode: 'Markdown' as const,
    },
    reply_markup: {
      inline_keyboard: [[
        { text: '⚡ Open goBlink', url: `https://t.me/goBlinkBot?start=t_${amount}_${tokenQuery}_${chain.id}` },
      ]],
    },
    thumbnail_url: 'https://goblink.io/icon-512.png',
  }));

  await ctx.answerInlineQuery(results, { cache_time: 30 });
}
