import type { Context } from 'grammy';
import type { Conversation } from '@grammyjs/conversations';
import type { BotContext } from '../types/index.js';
import type { ChainId, ChainConfig, Token, QuoteResponse } from '@urban-blazer/goblink-sdk';
import { getSDK } from '../services/goblink.js';
import {
  chainSelectKeyboard,
  tokenSelectKeyboard,
  amountKeyboard,
  confirmKeyboard,
  transferStatusKeyboard,
  sortChains,
  sortTokens,
} from '../utils/keyboards.js';
import {
  formatTransferSummary,
  formatDepositMessage,
  truncateAddr,
} from '../utils/formatters.js';
import {
  checkTransferLimit,
  checkQuoteLimit,
  formatRetryAfter,
} from '../utils/rate-limiter.js';
import { createOrUpdateUser, createTransfer } from '../services/supabase.js';

type TransferConversation = Conversation<BotContext, Context>;

// --- Helpers to wait for callback matching a prefix ---

async function waitForChainSelection(
  conversation: TransferConversation,
  ctx: Context,
  chains: ChainConfig[],
  prefix: string,
  prompt: string,
): Promise<ChainId | null> {
  const sorted = sortChains(chains);
  let page = 0;

  await ctx.reply(prompt, {
    reply_markup: chainSelectKeyboard(sorted, page, prefix),
  });

  while (true) {
    const resp = await conversation.wait({
      maxMilliseconds: 300_000,
    });

    if (resp.callbackQuery?.data) {
      const data = resp.callbackQuery.data;
      await resp.answerCallbackQuery();

      if (data === 'action:cancel') return null;

      if (data.startsWith(`page:${prefix}:`)) {
        page = parseInt(data.split(':')[2]!, 10);
        await resp.editMessageReplyMarkup({
          reply_markup: chainSelectKeyboard(sorted, page, prefix),
        });
        continue;
      }

      if (data.startsWith(`${prefix}:`)) {
        return data.split(':')[1] as ChainId;
      }
    }

    if (resp.message?.text === '/cancel') return null;

    await resp.reply('Please tap a chain button above, or /cancel to stop.');
  }
}

async function waitForTokenSelection(
  conversation: TransferConversation,
  ctx: Context,
  chain: ChainId,
  nativeSymbol: string,
  prefix: string,
  prompt: string,
): Promise<string | null> {
  const sdk = getSDK();
  const tokens = await conversation.external(() => sdk.getTokens({ chain }));
  const sorted = sortTokens(tokens, nativeSymbol);
  let page = 0;

  await ctx.reply(prompt, {
    reply_markup: tokenSelectKeyboard(sorted, page, prefix),
  });

  while (true) {
    const resp = await conversation.wait({
      maxMilliseconds: 300_000,
    });

    if (resp.callbackQuery?.data) {
      const data = resp.callbackQuery.data;
      await resp.answerCallbackQuery();

      if (data === 'action:cancel') return null;

      if (data.startsWith(`page:${prefix}:`)) {
        page = parseInt(data.split(':')[2]!, 10);
        await resp.editMessageReplyMarkup({
          reply_markup: tokenSelectKeyboard(sorted, page, prefix),
        });
        continue;
      }

      if (data.startsWith(`${prefix}:`)) {
        return data.split(':')[1]!;
      }
    }

    if (resp.message?.text === '/cancel') return null;

    await resp.reply('Please tap a token button above, or /cancel to stop.');
  }
}

// --- Main transfer conversation ---

export async function transferConversation(
  conversation: TransferConversation,
  ctx: Context,
): Promise<void> {
  const from = ctx.from;
  if (!from) {
    await ctx.reply('Could not identify you. Please try again.');
    return;
  }

  // Rate limit check
  const limit = checkTransferLimit(from.id);
  if (!limit.allowed) {
    await ctx.reply(
      `⏳ Slow down! Try again in ${formatRetryAfter(limit.retryAfterMs)}.`,
    );
    return;
  }

  const sdk = getSDK();
  const chains = await conversation.external(() => sdk.getChains());

  // Step 1: Source chain
  const sourceChain = await waitForChainSelection(
    conversation,
    ctx,
    chains,
    'src_chain',
    '🔗 Select source chain:',
  );
  if (!sourceChain) {
    await ctx.reply('Transfer cancelled.');
    return;
  }

  const sourceChainConfig = chains.find((c) => c.id === sourceChain)!;

  // Step 2: Source token
  const sourceToken = await waitForTokenSelection(
    conversation,
    ctx,
    sourceChain,
    sourceChainConfig.nativeToken,
    'src_token',
    `💎 Select token on ${sourceChainConfig.name}:`,
  );
  if (!sourceToken) {
    await ctx.reply('Transfer cancelled.');
    return;
  }

  // Step 3: Destination chain (exclude source)
  const destChains = chains.filter((c) => c.id !== sourceChain);
  const destChain = await waitForChainSelection(
    conversation,
    ctx,
    destChains,
    'dst_chain',
    '🎯 Select destination chain:',
  );
  if (!destChain) {
    await ctx.reply('Transfer cancelled.');
    return;
  }

  const destChainConfig = chains.find((c) => c.id === destChain)!;

  // Step 4: Destination token
  const destToken = await waitForTokenSelection(
    conversation,
    ctx,
    destChain,
    destChainConfig.nativeToken,
    'dst_token',
    `💎 Select token on ${destChainConfig.name}:`,
  );
  if (!destToken) {
    await ctx.reply('Transfer cancelled.');
    return;
  }

  // Step 5: Amount
  await ctx.reply(
    `💵 Enter amount of ${sourceToken} to send (or pick a preset):`,
    { reply_markup: amountKeyboard() },
  );

  let amount: string | null = null;
  let waitingForCustom = false;

  while (!amount) {
    const resp = await conversation.wait({ maxMilliseconds: 300_000 });

    if (resp.callbackQuery?.data) {
      const data = resp.callbackQuery.data;
      await resp.answerCallbackQuery();

      if (data === 'action:cancel') {
        await ctx.reply('Transfer cancelled.');
        return;
      }

      if (data === 'amount:custom') {
        waitingForCustom = true;
        await resp.reply(`Type the amount of ${sourceToken} to send:`);
        continue;
      }

      if (data.startsWith('amount:')) {
        amount = data.split(':')[1]!;
      }
    } else if (resp.message?.text) {
      if (resp.message.text === '/cancel') {
        await ctx.reply('Transfer cancelled.');
        return;
      }
      if (waitingForCustom || /^\d+(\.\d+)?$/.test(resp.message.text)) {
        const parsed = parseFloat(resp.message.text);
        if (isNaN(parsed) || parsed <= 0) {
          await resp.reply('Please enter a valid positive number.');
          continue;
        }
        amount = resp.message.text;
      } else {
        await resp.reply('Tap a preset button or type a number, or /cancel.');
      }
    }
  }

  // Step 6: Recipient address
  await ctx.reply(
    `📬 Enter the recipient address on ${destChainConfig.name}:`,
  );

  let recipient: string | null = null;
  while (!recipient) {
    const resp = await conversation.waitFor('message:text', {
      otherwise: (c) => c.reply('Please send a text address.'),
    });

    if (resp.message.text === '/cancel') {
      await ctx.reply('Transfer cancelled.');
      return;
    }

    const addr = resp.message.text.trim();
    const valid = await conversation.external(() =>
      sdk.validateAddress(destChain, addr),
    );
    if (!valid) {
      await resp.reply(
        `Invalid ${destChainConfig.name} address. Please try again.`,
      );
      continue;
    }
    recipient = addr;
  }

  // Step 7: Refund address
  let refundAddress: string;
  if (sourceChain === destChain) {
    refundAddress = recipient;
    await ctx.reply(`Refund address set to recipient (same chain).`);
  } else {
    await ctx.reply(
      `🔙 Enter refund address on ${sourceChainConfig.name} (in case of failure):`,
    );

    let refund: string | null = null;
    while (!refund) {
      const resp = await conversation.waitFor('message:text', {
        otherwise: (c) => c.reply('Please send a text address.'),
      });

      if (resp.message.text === '/cancel') {
        await ctx.reply('Transfer cancelled.');
        return;
      }

      const addr = resp.message.text.trim();
      const valid = await conversation.external(() =>
        sdk.validateAddress(sourceChain, addr),
      );
      if (!valid) {
        await resp.reply(
          `Invalid ${sourceChainConfig.name} address. Please try again.`,
        );
        continue;
      }
      refund = addr;
    }
    refundAddress = refund;
  }

  // Step 8: Get quote & show confirmation
  const quoteLimit = checkQuoteLimit(from.id);
  if (!quoteLimit.allowed) {
    await ctx.reply(
      `⏳ Slow down! Try again in ${formatRetryAfter(quoteLimit.retryAfterMs)}.`,
    );
    return;
  }

  let quote: QuoteResponse;
  try {
    quote = await conversation.external(() =>
      sdk.getQuote({
        from: { chain: sourceChain, token: sourceToken },
        to: { chain: destChain, token: destToken },
        amount,
        recipient,
        refundAddress,
      }),
    );
  } catch (err) {
    console.error('Quote failed:', err);
    await ctx.reply('Something went wrong getting a quote. Please try again.');
    return;
  }

  const summary = formatTransferSummary(
    amount,
    sourceToken,
    destToken,
    sourceChainConfig.name,
    destChainConfig.name,
    recipient,
    refundAddress,
    quote,
  );

  await ctx.reply(`${summary}\n\nConfirm this transfer?`, {
    reply_markup: confirmKeyboard(),
  });

  // Wait for confirm/cancel
  while (true) {
    const resp = await conversation.wait({ maxMilliseconds: 300_000 });

    if (resp.callbackQuery?.data) {
      await resp.answerCallbackQuery();

      if (resp.callbackQuery.data === 'confirm:no') {
        await ctx.reply('Transfer cancelled.');
        return;
      }

      if (resp.callbackQuery.data === 'confirm:yes') {
        break;
      }
    }

    if (resp.message?.text === '/cancel') {
      await ctx.reply('Transfer cancelled.');
      return;
    }
  }

  // Step 9: Create transfer
  try {
    const transfer = await conversation.external(() =>
      sdk.createTransfer({
        from: { chain: sourceChain, token: sourceToken },
        to: { chain: destChain, token: destToken },
        amount,
        recipient,
        refundAddress,
      }),
    );

    const depositMsg = formatDepositMessage(
      transfer.depositAddress,
      transfer.depositAmount,
      sourceToken,
      sourceChainConfig.name,
      transfer.expiresAt,
    );

    const sentMsg = await ctx.reply(depositMsg, {
      parse_mode: 'Markdown',
      reply_markup: transferStatusKeyboard(),
    });

    // Save to database
    try {
      const user = await conversation.external(() =>
        createOrUpdateUser(from.id, from.username, from.first_name),
      );

      await conversation.external(() =>
        createTransfer({
          user_id: user.id,
          telegram_id: from.id,
          chat_id: ctx.chat?.id ?? from.id,
          message_id: sentMsg.message_id,
          source_chain: sourceChain,
          source_token: sourceToken,
          dest_chain: destChain,
          dest_token: destToken,
          amount,
          recipient,
          refund_address: refundAddress,
          deposit_address: transfer.depositAddress,
          deposit_amount: transfer.depositAmount,
          status: 'PENDING',
          expires_at: transfer.expiresAt,
          transfer_id: transfer.id,
        }),
      );
    } catch (err) {
      console.error('Failed to save transfer to DB:', err);
    }

    console.log(
      `Transfer created: ${transfer.id} by user ${from.id} — ${amount} ${sourceToken} (${sourceChain}) → ${destToken} (${destChain})`,
    );
  } catch (err) {
    console.error('Transfer creation failed:', err);
    await ctx.reply('Something went wrong creating the transfer. Please try again.');
  }
}
