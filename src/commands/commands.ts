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
      `⚡ <b>goBlink — Group Commands</b>\n\n` +
      `/transfer@goBlinkBot — Cross-chain transfer\n` +
      `/request@goBlinkBot — Payment request link\n` +
      `/price@goBlinkBot — All token prices\n` +
      `/price@goBlinkBot ETH — Specific token price\n` +
      `/referral@goBlinkBot — Your referral link\n` +
      `/help@goBlinkBot — Full help center\n` +
      `/commands@goBlinkBot — This list\n\n` +
      `📩 <b>DM-only:</b> /history, /addressbook, /save, /default, /repeat\n\n` +
      `💡 <b>Inline:</b> Type <code>@goBlinkBot 100 USDC from ethereum to solana</code> anywhere`,
      { parse_mode: 'HTML', reply_markup: kb },
    );
  } else {
    await ctx.reply(
      `⚡ <b>goBlink — All Commands</b>\n\n` +
      `<b>Transfers</b>\n` +
      `/transfer — Cross-chain token transfer\n` +
      `/request — Create a payment request link\n` +
      `/repeat — Repeat your last transfer\n\n` +
      `<b>Info</b>\n` +
      `/price — Token prices\n` +
      `/history — Transfer history\n\n` +
      `<b>Address Book</b>\n` +
      `/addressbook — View saved addresses\n` +
      `/save &lt;label&gt; &lt;chain&gt; &lt;address&gt;\n\n` +
      `<b>Settings &amp; Referrals</b>\n` +
      `/default &lt;chain&gt; &lt;token&gt; — Set default source\n` +
      `/referral — Your referral link &amp; stats\n\n` +
      `/help — Full help center\n` +
      `/commands — This list\n\n` +
      `💡 <b>Inline:</b> Type <code>@goBlinkBot 100 USDC to solana</code> in any chat`,
      { parse_mode: 'HTML' },
    );
  }
}
