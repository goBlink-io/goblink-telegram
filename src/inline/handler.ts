import type { BotContext } from '../types/index.js';
import { getSDK } from '../services/goblink.js';
import { displaySymbol, formatAmount } from '../utils/formatters.js';
import type { ChainConfig } from '@urban-blazer/goblink-sdk';

const ACTIVE_CHAINS = new Set([
  'ethereum', 'solana', 'sui', 'near', 'base', 'arbitrum',
  'bnb', 'polygon', 'optimism', 'tron', 'aptos', 'starknet',
]);

/**
 * Handle inline queries.
 *
 * Formats:
 *   @goBlinkBot 100 USDC from ethereum to solana  → both chains pre-filled
 *   @goBlinkBot 100 USDC to solana                → destination only
 *   @goBlinkBot 100 USDC                          → pick both chains
 *   @goBlinkBot                                   → help
 */
export async function handleInlineQuery(ctx: BotContext): Promise<void> {
  const query = ctx.inlineQuery?.query?.trim() ?? '';

  if (!query) {
    await ctx.answerInlineQuery([
      {
        type: 'article',
        id: 'help',
        title: '⚡ goBlink — Quick Transfer',
        description: 'Type: 100 USDC from ethereum to solana',
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

  // Parse all formats:
  // <amount> <token> from <srcChain> to <dstChain>
  // <amount> <token> to <dstChain>
  // <amount> <token>
  const fullMatch = query.match(
    /^(\d+(?:\.\d+)?)\s+(\w+)\s+(?:from|on)\s+(\w+)\s+(?:to|→)\s+(\w+)$/i,
  );
  const dstOnlyMatch = !fullMatch
    ? query.match(/^(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|→)\s+(\w+)$/i)
    : null;
  const tokenOnlyMatch = !fullMatch && !dstOnlyMatch
    ? query.match(/^(\d+(?:\.\d+)?)\s+(\w+)$/i)
    : null;

  if (!fullMatch && !dstOnlyMatch && !tokenOnlyMatch) {
    await ctx.answerInlineQuery([
      {
        type: 'article',
        id: 'usage',
        title: '💡 Format: 100 USDC from ethereum to solana',
        description: 'Also: 100 USDC to solana, or just 100 USDC',
        input_message_content: {
          message_text:
            '⚡ Use @goBlinkBot to send tokens across chains.\n\n' +
            'Formats:\n' +
            '`100 USDC from ethereum to solana`\n' +
            '`100 USDC to solana`\n' +
            '`100 USDC`',
          parse_mode: 'Markdown',
        },
      },
    ], { cache_time: 60 });
    return;
  }

  const sdk = getSDK();
  const allChains = sdk.getChains().filter(c => ACTIVE_CHAINS.has(c.id));

  const findChain = (q: string) =>
    allChains.find(c => c.id === q.toLowerCase() || c.name.toLowerCase() === q.toLowerCase());

  if (fullMatch) {
    // Both chains specified
    const [, amount, token, srcQ, dstQ] = fullMatch;
    const tokenUp = token!.toUpperCase();
    const srcChain = findChain(srcQ!);
    const dstChain = findChain(dstQ!);

    if (!srcChain || !dstChain) {
      const bad = !srcChain ? srcQ : dstQ;
      await ctx.answerInlineQuery([{
        type: 'article',
        id: 'no-chain',
        title: `❌ Unknown chain: ${bad}`,
        description: 'Supported: ethereum, solana, sui, near, base, arbitrum, polygon, bnb, optimism, tron, aptos, starknet',
        input_message_content: { message_text: `❌ Unknown chain "${bad}".` },
      }], { cache_time: 60 });
      return;
    }

    // Deep link: t_<amount>_<token>_<srcChain>_<dstChain>
    const deepLink = `t_${amount}_${tokenUp}_${srcChain.id}_${dstChain.id}`;

    await ctx.answerInlineQuery([{
      type: 'article',
      id: `transfer-${srcChain.id}-${dstChain.id}-${tokenUp}-${amount}`,
      title: `⚡ ${amount} ${displaySymbol(tokenUp)}: ${srcChain.name} → ${dstChain.name}`,
      description: 'Tap to start this transfer via goBlink',
      input_message_content: {
        message_text:
          `⚡ *goBlink Transfer*\n\n` +
          `💸 ${formatAmount(amount!)} ${displaySymbol(tokenUp)}\n` +
          `📤 From: ${srcChain.name}\n` +
          `📥 To: ${dstChain.name}\n\n` +
          `Non-custodial · Send to a deposit address from any wallet.\n\n` +
          `[Start this transfer](https://t.me/goBlinkBot?start=${deepLink})`,
        parse_mode: 'Markdown' as const,
      },
      reply_markup: {
        inline_keyboard: [[
          { text: '⚡ Open goBlink', url: `https://t.me/goBlinkBot?start=${deepLink}` },
        ]],
      },
      thumbnail_url: 'https://goblink.io/icon-512.png',
    }], { cache_time: 30 });
    return;
  }

  if (dstOnlyMatch) {
    // Destination only
    const [, amount, token, dstQ] = dstOnlyMatch;
    const tokenUp = token!.toUpperCase();
    const dstChain = findChain(dstQ!);

    if (!dstChain) {
      await ctx.answerInlineQuery([{
        type: 'article',
        id: 'no-chain',
        title: `❌ Unknown chain: ${dstQ}`,
        description: 'Supported: ethereum, solana, sui, near, base, arbitrum, polygon, bnb, optimism, tron, aptos, starknet',
        input_message_content: { message_text: `❌ Unknown chain "${dstQ}".` },
      }], { cache_time: 60 });
      return;
    }

    const deepLink = `t_${amount}_${tokenUp}_${dstChain.id}`;

    await ctx.answerInlineQuery([{
      type: 'article',
      id: `transfer-${dstChain.id}-${tokenUp}-${amount}`,
      title: `⚡ Send ${amount} ${displaySymbol(tokenUp)} → ${dstChain.name}`,
      description: 'You\'ll pick the source chain in the bot',
      input_message_content: {
        message_text:
          `⚡ *goBlink Transfer*\n\n` +
          `💸 ${formatAmount(amount!)} ${displaySymbol(tokenUp)} → ${dstChain.name}\n\n` +
          `Non-custodial · Send to a deposit address from any wallet.\n\n` +
          `[Start this transfer](https://t.me/goBlinkBot?start=${deepLink})`,
        parse_mode: 'Markdown' as const,
      },
      reply_markup: {
        inline_keyboard: [[
          { text: '⚡ Open goBlink', url: `https://t.me/goBlinkBot?start=${deepLink}` },
        ]],
      },
      thumbnail_url: 'https://goblink.io/icon-512.png',
    }], { cache_time: 30 });
    return;
  }

  // Token only — show all destination chains
  const [, amount, token] = tokenOnlyMatch!;
  const tokenUp = token!.toUpperCase();

  const results = allChains.slice(0, 10).map((chain: ChainConfig) => ({
    type: 'article' as const,
    id: `transfer-${chain.id}-${tokenUp}-${amount}`,
    title: `⚡ Send ${amount} ${displaySymbol(tokenUp)} → ${chain.name}`,
    description: 'You\'ll pick the source chain in the bot',
    input_message_content: {
      message_text:
        `⚡ *goBlink Transfer*\n\n` +
        `💸 ${formatAmount(amount!)} ${displaySymbol(tokenUp)} → ${chain.name}\n\n` +
        `Non-custodial · Send to a deposit address from any wallet.\n\n` +
        `[Start this transfer](https://t.me/goBlinkBot?start=t_${amount}_${tokenUp}_${chain.id})`,
      parse_mode: 'Markdown' as const,
    },
    reply_markup: {
      inline_keyboard: [[
        { text: '⚡ Open goBlink', url: `https://t.me/goBlinkBot?start=t_${amount}_${tokenUp}_${chain.id}` },
      ]],
    },
    thumbnail_url: 'https://goblink.io/icon-512.png',
  }));

  await ctx.answerInlineQuery(results, { cache_time: 30 });
}
