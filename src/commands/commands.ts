import type { BotContext } from '../types/index.js';
import { InlineKeyboard } from 'grammy';

/**
 * /commands — Quick reference of available commands.
 * In groups: shows only group-compatible commands.
 * In DM: shows all commands.
 */
export async function commandsCommand(ctx: BotContext): Promise<void> {
  const chatType = ctx.chat?.type;
  const inGroup = chatType === 'group' || chatType === 'supergroup';

  if (inGroup) {
    const kb = new InlineKeyboard()
      .text('🔄 Transfer', 'action:transfer')
      .text('💸 Request', 'action:request')
      .row()
      .text('💰 Prices', 'action:prices')
      .text('❓ Help', 'action:help')
      .row()
      .url('📩 More in DM', 'https://t.me/goBlinkBot');

    await ctx.reply(
      `⚡ *goBlink — Group Commands*\n\n` +
      `/transfer — Cross-chain token transfer\n` +
      `/request — Create a payment request link\n` +
      `/price — Token prices\n` +
      `/price ETH — Look up a specific token\n` +
      `/help — Full help center\n` +
      `/commands — This list\n\n` +
      `📩 *DM-only:* /history, /addressbook, /save, /default, /repeat\n\n` +
      `🔗 /referral — Your referral link & stats\n\n` +
      `💡 *Inline:* Type \`@goBlinkBot 100 USDC from ethereum to solana\` anywhere`,
      { parse_mode: 'Markdown', reply_markup: kb },
    );
  } else {
    await ctx.reply(
      `⚡ *goBlink — All Commands*\n\n` +
      `*Transfers*\n` +
      `/transfer — Cross-chain token transfer\n` +
      `/request — Create a payment request link\n` +
      `/repeat — Repeat your last transfer\n\n` +
      `*Info*\n` +
      `/price — Token prices\n` +
      `/history — Transfer history\n\n` +
      `*Address Book*\n` +
      `/addressbook — View saved addresses\n` +
      `/save <label> <chain> <address>\n\n` +
      `*Settings & Referrals*\n` +
      `/default <chain> <token> — Set default source\n` +
      `/referral — Your referral link & stats\n\n` +
      `/help — Full help center\n` +
      `/commands — This list\n\n` +
      `💡 *Inline:* Type \`@goBlinkBot 100 USDC to solana\` in any chat`,
      { parse_mode: 'Markdown' },
    );
  }
}
