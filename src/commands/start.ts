import type { BotContext } from '../types/index.js';
import { mainMenuKeyboard } from '../utils/keyboards.js';
import { createOrUpdateUser, getUser } from '../services/supabase.js';
import { displaySymbol } from '../utils/formatters.js';

export async function startCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  let isNew = false;
  try {
    const existing = await getUser(from.id);
    isNew = !existing;
    await createOrUpdateUser(from.id, from.username, from.first_name);
  } catch (err) {
    console.error('Failed to upsert user:', err);
  }

  // Deep link: /start t_<amount>_<token>_<srcChain>_<dstChain>  (both chains)
  //        or: /start t_<amount>_<token>_<dstChain>            (destination only)
  const text = ctx.message?.text ?? '';
  const deepMatch4 = text.match(/\/start\s+t_(\d+(?:\.\d+)?)_(\w+)_(\w+)_(\w+)/);
  const deepMatch3 = !deepMatch4 ? text.match(/\/start\s+t_(\d+(?:\.\d+)?)_(\w+)_(\w+)/) : null;

  if (deepMatch4) {
    const [, amount, token, srcChain, dstChain] = deepMatch4;
    const { startTransferFlowPrefilled } = await import('../conversations/transfer.js');
    await startTransferFlowPrefilled(ctx, {
      amount: amount!,
      srcToken: token!.toUpperCase(),
      srcChain: srcChain!,
      dstChain: dstChain!,
    });
    return;
  }

  if (deepMatch3) {
    const [, amount, token, dstChain] = deepMatch3;
    const { startTransferFlowPrefilled } = await import('../conversations/transfer.js');
    await startTransferFlowPrefilled(ctx, {
      amount: amount!,
      dstToken: token!.toUpperCase(),
      dstChain: dstChain!,
    });
    return;
  }

  // Check for payment link: /start pay_<id>
  const payMatch = text.match(/\/start\s+pay_(\w+)/);
  if (payMatch) {
    // TODO: Handle payment request deep links
    await ctx.reply('💸 Payment request links coming soon! Use /transfer for now.', { reply_markup: mainMenuKeyboard() });
    return;
  }

  const name = from.first_name || 'there';

  if (isNew) {
    await ctx.reply(
      `⚡ *goBlink*\n\n` +
      `Hey ${name}! Welcome to goBlink — the fastest way to move tokens across chains.\n\n` +
      `🔄 Transfer between 12 chains\n` +
      `💸 Request payments via shareable links\n` +
      `📒 Save addresses for quick sends\n` +
      `💰 Live token prices\n\n` +
      `Non-custodial · 65+ tokens · Instant\n\n` +
      `Tap a button to get started:`,
      { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() },
    );
  } else {
    await ctx.reply(
      `⚡ *goBlink* — Move value anywhere, instantly.`,
      { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() },
    );
  }
}
