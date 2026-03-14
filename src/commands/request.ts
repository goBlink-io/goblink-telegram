import type { BotContext } from '../types/index.js';
import { chainSelectKeyboard } from '../utils/keyboards.js';
import { getSDK } from '../services/goblink.js';
import { ACTIVE_CHAIN_IDS } from '../utils/filters.js';

/**
 * /request — start payment request flow
 */
export async function requestCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    const sdk = getSDK();
    const allChains = await sdk.getChains();
    const chains = allChains.filter(c => ACTIVE_CHAIN_IDS.has(c.id));

    ctx.session.requestState = {
      step: 'chain',
      page: 0,
      chains,
    };

    const msg = await ctx.reply(
      '💸 <b>Request Payment</b>\n\nWhich chain should you receive on?',
      {
        parse_mode: 'HTML',
        reply_markup: chainSelectKeyboard(chains, 0, 'req_chain'),
      },
    );

    ctx.session.requestState.lastMessageId = msg.message_id;
  } catch (err) {
    console.error('Request command failed:', err);
    await ctx.reply('❌ Something went wrong. Please try again or use /start to go back.');
  }
}
