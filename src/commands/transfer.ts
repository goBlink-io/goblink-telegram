import type { BotContext } from '../types/index.js';

export async function transferCommand(ctx: BotContext): Promise<void> {
  await ctx.conversation.enter('transfer');
}
