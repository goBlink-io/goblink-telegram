import type { BotContext } from '../types/index.js';
import { mainMenuKeyboard } from '../utils/keyboards.js';
import { createOrUpdateUser, getUser } from '../services/supabase.js';
import { displaySymbol, htmlEsc } from '../utils/formatters.js';

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

  // Referral deep link: /start ref_<code>
  const refMatch = text.match(/\/start\s+ref_([a-z0-9]+)/i);
  if (refMatch) {
    const code = refMatch[1]!.toLowerCase();
    try {
      const { getUserByReferralCode, setReferredBy } = await import('../services/supabase.js');
      const referrer = await getUserByReferralCode(code);
      if (referrer && referrer.telegram_id !== from.id) {
        const user = await createOrUpdateUser(from.id, from.username, from.first_name);
        const wasSet = await setReferredBy(user.id, referrer.id);
        if (wasSet) {
          console.log(`Referral: user ${from.id} referred by ${referrer.telegram_id} (code: ${code})`);
        }
      }
    } catch (err) {
      console.error('Referral tracking failed:', err);
    }
    // Continue to normal start flow (don't return — show welcome)
  }

  // From group redirect — show welcome with context
  if (text.includes('from_group')) {
    await ctx.reply(
      `⚡ <b>goBlink</b>\n\n` +
      `You're all set! You can now use goBlink in groups and here in DM.\n\n` +
      `Private commands like /history, /addressbook, and /default work here.\n` +
      `Transfers and prices work in both groups and DM.`,
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() },
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
      `⚡ <b>goBlink</b> — Move value anywhere, instantly.\n\n` +
      `Use me here or in DM. Private commands (history, addresses) work in DM only.`,
      { parse_mode: 'HTML', reply_markup: kb },
    );
    return;
  }

  if (isNew) {
    await ctx.reply(
      `⚡ <b>goBlink</b>\n\n` +
      `Hey ${htmlEsc(name)}! Welcome to goBlink — the fastest way to move tokens across chains.\n\n` +
      `🔄 Cross-chain transfers across 12 chains\n` +
      `💸 Payment requests via shareable links\n` +
      `📒 Address book with auto-fill\n` +
      `💰 Live token prices\n` +
      `🔁 Repeat transfers in one tap\n` +
      `🔗 Referral program — /referral\n\n` +
      `Non-custodial · 65+ tokens · Works in groups\n\n` +
      `Tap a button to get started:`,
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() },
    );
  } else {
    await ctx.reply(
      `⚡ <b>goBlink</b> — Move value anywhere, instantly.`,
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() },
    );
  }
}
