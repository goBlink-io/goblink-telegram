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

  // From group redirect — show welcome with context
  if (text.includes('from_group')) {
    await ctx.reply(
      `⚡ *goBlink*\n\n` +
      `You're all set! You can now use goBlink in groups and here in DM.\n\n` +
      `Private commands like /history, /addressbook, and /default work here.\n` +
      `Transfers and prices work in both groups and DM.`,
      { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() },
    );
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
  const chatType = ctx.chat?.type;
  const inGroup = chatType === 'group' || chatType === 'supergroup';

  if (inGroup) {
    const { InlineKeyboard } = await import('grammy');
    const kb = new InlineKeyboard()
      .text('🔄 New Transfer', 'action:transfer')
      .text('💸 Request Payment', 'action:request')
      .row()
      .text('💰 Prices', 'action:prices')
      .text('❓ Help', 'action:help')
      .row()
      .url('📩 Open DM', 'https://t.me/goBlinkBot');

    await ctx.reply(
      `⚡ *goBlink* — Move value anywhere, instantly.\n\n` +
      `Use me here or in DM. Private commands (history, addresses) work in DM only.`,
      { parse_mode: 'Markdown', reply_markup: kb },
    );
    return;
  }

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
