import type { BotContext } from '../types/index.js';
import { InlineKeyboard } from 'grammy';
import {
  createOrUpdateUser,
  ensureReferralCode,
  getReferralStats,
} from '../services/supabase.js';
import { formatAmount, htmlEsc } from '../utils/formatters.js';

/**
 * /referral — View your referral link and stats.
 */
export async function referralCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    const user = await createOrUpdateUser(from.id, from.username, from.first_name);
    const code = await ensureReferralCode(user.id);
    const stats = await getReferralStats(user.id);

    const link = `https://t.me/goBlinkBot?start=ref_${code}`;

    const lines = [
      `🔗 <b>Your Referral</b>`,
      ``,
      `📋 Code: <code>${htmlEsc(code)}</code>`,
      `🔗 Link: ${link}`,
      ``,
      `📊 <b>Stats</b>`,
      `👥 Referred: ${stats.referralCount} user${stats.referralCount !== 1 ? 's' : ''}`,
    ];

    if (stats.referralVolume > 0) {
      lines.push(`💰 Their volume: $${htmlEsc(formatAmount(stats.referralVolume.toFixed(2)))}`);
    }

    lines.push(
      ``,
      `Share your link — when someone starts goBlink through it, they're linked to you.`,
    );

    const kb = new InlineKeyboard()
      .switchInline('📤 Share in chat', `Join me on goBlink — move tokens across 12 chains instantly: ${link}`)
      .row()
      .url('🌐 goblink.io', 'https://goblink.io');

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    console.error('Referral command failed:', err);
    await ctx.reply('❌ Couldn\'t load referral info. Try again.');
  }
}
