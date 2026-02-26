import { Bot } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import type { BotContext } from './types/index.js';
import { config } from './config.js';
import { startCommand } from './commands/start.js';
import { transferCommand } from './commands/transfer.js';
import { historyCommand } from './commands/history.js';
import { priceCommand } from './commands/price.js';
import { helpCommand } from './commands/help.js';
import { menuCallback } from './callbacks/menu.js';
import { transferConversation } from './conversations/transfer.js';

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.telegramBotToken);

  // Error handler
  bot.catch((err) => {
    console.error('Bot error:', err.error);
    console.error('Update that caused error:', JSON.stringify(err.ctx.update));
  });

  // Conversations plugin (must come before createConversation)
  bot.use(conversations());

  // Register transfer conversation
  bot.use(createConversation(transferConversation, 'transfer'));

  // Commands
  bot.command('start', startCommand);
  bot.command('transfer', transferCommand);
  bot.command('history', historyCommand);
  bot.command('price', priceCommand);
  bot.command('help', helpCommand);

  // Callback queries for menu buttons
  bot.on('callback_query:data', menuCallback);

  return bot;
}
