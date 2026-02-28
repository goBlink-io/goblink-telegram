import type { BotContext } from '../types/index.js';
import { InlineKeyboard } from 'grammy';

/**
 * Detect goblink.io links in messages and render rich previews.
 *
 * Patterns:
 * - goblink.io/t/<id>     → Transfer link
 * - goblink.io/pay/<id>   → Payment request link
 */
export async function detectGoBlinkLinks(ctx: BotContext): Promise<boolean> {
  const text = ctx.message?.text ?? '';
  
  // Transfer link: goblink.io/t/<id>
  const transferMatch = text.match(/goblink\.io\/t\/([a-zA-Z0-9_-]+)/);
  if (transferMatch) {
    const id = transferMatch[1]!;
    const url = `https://goblink.io/t/${id}`;
    const kb = new InlineKeyboard()
      .url('⚡ Open Transfer', url)
      .row()
      .url('📱 Open in Bot', `https://t.me/goBlinkBot?start=link_${id}`);

    await ctx.reply(
      `⚡ <b>goBlink Transfer Link</b>\n\n` +
      `Someone shared a transfer. Tap below to view details and complete it.\n\n` +
      `Non-custodial — you send from your own wallet.`,
      { parse_mode: 'HTML', reply_markup: kb },
    );
    return true;
  }

  // Payment request link: goblink.io/pay/<id>
  const payMatch = text.match(/goblink\.io\/pay\/([a-zA-Z0-9_-]+)/);
  if (payMatch) {
    const id = payMatch[1]!;
    const url = `https://goblink.io/pay/${id}`;
    const kb = new InlineKeyboard()
      .url('💸 Pay Now', url)
      .row()
      .url('📱 Open in Bot', `https://t.me/goBlinkBot?start=pay_${id}`);

    await ctx.reply(
      `💸 <b>goBlink Payment Request</b>\n\n` +
      `Someone is requesting a payment. Tap below to pay from any chain.\n\n` +
      `Non-custodial — you send from your own wallet.`,
      { parse_mode: 'HTML', reply_markup: kb },
    );
    return true;
  }

  return false;
}
