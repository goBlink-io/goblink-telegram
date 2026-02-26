import type { BotContext } from '../types/index.js';
import { historyCommand } from '../commands/history.js';
import { helpCommand } from '../commands/help.js';
import { priceCommand } from '../commands/price.js';

export async function menuCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  await ctx.answerCallbackQuery();

  switch (data) {
    case 'action:transfer':
      await ctx.conversation.enter('transfer');
      break;
    case 'action:history':
      await historyCommand(ctx);
      break;
    case 'action:prices':
      await priceCommand(ctx);
      break;
    case 'action:help':
      await helpCommand(ctx);
      break;
    case 'action:cancel':
      await ctx.reply('Cancelled.');
      break;
    default:
      break;
  }
}
