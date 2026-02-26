import type { BotContext } from '../types/index.js';

export async function priceCommand(ctx: BotContext): Promise<void> {
  await ctx.reply('💰 Price lookup coming soon!');
}
