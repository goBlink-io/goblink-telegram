import { Bot, session } from 'grammy';
import type { BotContext, SessionData } from './types/index.js';
import { config } from './config.js';
import { startCommand } from './commands/start.js';
import { historyCommand } from './commands/history.js';
import { priceCommand, handlePriceCallback } from './commands/price.js';
import { helpCommand, handleHelpCallback } from './commands/help.js';
import { addressBookCommand, saveAddressCommand, handleAddressDeleteCallback } from './commands/addressbook.js';
import { startTransferFlow, handleTransferCallback, handleTransferText } from './conversations/transfer.js';
import { defaultCommand } from './commands/default.js';
import { startRequestFlow, handleRequestCallback, handleRequestText } from './conversations/request.js';

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.telegramBotToken);

  // Error handler
  bot.catch((err) => {
    console.error('Bot error:', err.error);
    console.error('Update that caused error:', JSON.stringify(err.ctx.update));
  });

  // Session (in-memory for MVP)
  bot.use(session({ initial: (): SessionData => ({}) }));

  // Commands
  bot.command('start', startCommand);
  bot.command('transfer', async (ctx) => { await startTransferFlow(ctx); });
  bot.command('history', historyCommand);
  bot.command('price', priceCommand);
  bot.command('help', helpCommand);
  bot.command('addressbook', addressBookCommand);
  bot.command('addresses', addressBookCommand);
  bot.command('save', saveAddressCommand);
  bot.command('default', defaultCommand);
  bot.command('request', async (ctx) => { await startRequestFlow(ctx); });
  bot.command('cancel', async (ctx) => {
    ctx.session.transferState = undefined;
    ctx.session.requestState = undefined;
    const { mainMenuKeyboard } = await import('./utils/keyboards.js');
    await ctx.reply('Cancelled.', { reply_markup: mainMenuKeyboard() });
  });

  // Callback queries — transfer flow first, then menu
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    // Request payment flow callbacks
    if (
      data.startsWith('req_chain:') ||
      data.startsWith('req_token:') ||
      data.startsWith('req_addr:') ||
      data === 'req_skip_memo' ||
      data === 'req_back_chains' ||
      data === 'req_back_tokens' ||
      data.startsWith('page:req_chain:') ||
      data.startsWith('page:req_token:')
    ) {
      await handleRequestCallback(ctx, data);
      return;
    }

    // Request flow also handles amount: and cancel when in request state
    if (data.startsWith('amount:') && ctx.session.requestState?.step === 'amount') {
      await handleRequestCallback(ctx, data);
      return;
    }
    if (data === 'action:cancel' && ctx.session.requestState) {
      await handleRequestCallback(ctx, data);
      return;
    }

    // Transfer flow callbacks
    if (
      data.startsWith('src_chain:') ||
      data.startsWith('src_token:') ||
      data.startsWith('dst_chain:') ||
      data.startsWith('dst_token:') ||
      data.startsWith('amount:') ||
      data.startsWith('confirm:') ||
      data.startsWith('refund_addr:') ||
      data === 'refund:custom' ||
      data.startsWith('page:') ||
      data === 'action:back_to_chains' ||
      data === 'action:cancel'
    ) {
      await handleTransferCallback(ctx, data);
      return;
    }

    // Price callbacks
    if (data.startsWith('price:')) {
      const symbol = data.split(':')[1]!;
      await handlePriceCallback(ctx, symbol);
      return;
    }

    // Address book delete
    if (data.startsWith('addr_del:')) {
      const id = data.split(':')[1]!;
      await handleAddressDeleteCallback(ctx, id);
      return;
    }

    // Help section callbacks
    if (data.startsWith('help:')) {
      await handleHelpCallback(ctx, data);
      return;
    }

    // Menu callbacks
    if (data === 'action:request') {
      try { await ctx.answerCallbackQuery(); } catch {}
      await startRequestFlow(ctx);
      return;
    }
    if (data === 'action:transfer') {
      await startTransferFlow(ctx);
      return;
    }
    if (data === 'action:history') {
      try { await ctx.answerCallbackQuery(); } catch {}
      await historyCommand(ctx);
      return;
    }
    if (data === 'action:prices') {
      try { await ctx.answerCallbackQuery(); } catch {}
      await priceCommand(ctx);
      return;
    }
    if (data === 'action:addressbook') {
      try { await ctx.answerCallbackQuery(); } catch {}
      await addressBookCommand(ctx);
      return;
    }
    if (data === 'menu:main') {
      try { await ctx.answerCallbackQuery(); } catch {}
      await startCommand(ctx);
      return;
    }
    if (data === 'action:help') {
      try { await ctx.answerCallbackQuery(); } catch {}
      await helpCommand(ctx);
      return;
    }

    try { await ctx.answerCallbackQuery(); } catch {}
  });

  // Text messages — handle active flow inputs
  bot.on('message:text', async (ctx) => {
    // Request flow first (check if active)
    if (ctx.session.requestState) {
      const handled = await handleRequestText(ctx);
      if (handled) return;
    }
    // Transfer flow
    const handled = await handleTransferText(ctx);
    if (!handled) {
      // Not in any flow — ignore
    }
  });

  return bot;
}
