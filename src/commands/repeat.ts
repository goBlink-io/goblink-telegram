import type { BotContext, TransferState } from '../types/index.js';
import { InlineKeyboard } from 'grammy';
import { mainMenuKeyboard } from '../utils/keyboards.js';
import { getUser, getUserTransfers } from '../services/supabase.js';
import { displaySymbol, formatAmount, truncateAddr } from '../utils/formatters.js';

/**
 * /repeat — Pre-fill a new transfer with the same params as your last one.
 * User still has to confirm and send tokens manually — zero risk.
 */
export async function repeatCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    const user = await getUser(from.id);
    if (!user) {
      await ctx.reply('No transfer history yet. Use /transfer to start.', { reply_markup: mainMenuKeyboard() });
      return;
    }

    const transfers = await getUserTransfers(user.id, 5);
    if (transfers.length === 0) {
      await ctx.reply('No transfer history yet. Use /transfer to start.', { reply_markup: mainMenuKeyboard() });
      return;
    }

    if (transfers.length === 1) {
      // Single transfer — pre-fill directly
      const t = transfers[0]!;
      ctx.session.transferState = prefillState(t);
      await ctx.reply(
        `🔁 *Repeat last transfer:*\n\n` +
        `${formatAmount(t.amount)} ${displaySymbol(t.source_token)} (${t.source_chain}) → ${displaySymbol(t.dest_token)} (${t.dest_chain})\n` +
        `To: \`${truncateAddr(t.recipient)}\`\n\n` +
        `Fetching quote...`,
        { parse_mode: 'Markdown' },
      );

      // Jump straight to confirmation
      const { showConfirmation, getChainsCached } = await import('../conversations/transfer.js');
      const chains = await getChainsCached();
      await showConfirmation(ctx, ctx.session.transferState!, chains);
      return;
    }

    // Multiple transfers — let them pick
    const kb = new InlineKeyboard();
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i]!;
      const label = `${formatAmount(t.amount)} ${displaySymbol(t.source_token)} → ${displaySymbol(t.dest_token)} (${t.source_chain}→${t.dest_chain})`;
      kb.text(label, `repeat:${i}`).row();
    }
    kb.text('✖ Cancel', 'action:cancel');

    await ctx.reply('🔁 *Repeat which transfer?*\n\nPick one of your recent transfers:', {
      parse_mode: 'Markdown',
      reply_markup: kb,
    });

    // Store transfers in session for callback
    ctx.session.repeatTransfers = transfers;
  } catch (err) {
    console.error('Repeat command failed:', err);
    await ctx.reply('❌ Couldn\'t load transfer history. Try again.', { reply_markup: mainMenuKeyboard() });
  }
}

/**
 * Handle repeat:N callback
 */
export async function handleRepeatCallback(ctx: BotContext, data: string): Promise<void> {
  try { await ctx.answerCallbackQuery(); } catch {}

  const idx = parseInt(data.split(':')[1]!, 10);
  const transfers = ctx.session.repeatTransfers;

  if (!transfers || !transfers[idx]) {
    await ctx.reply('❌ Transfer not found. Use /repeat to try again.');
    return;
  }

  const t = transfers[idx]!;
  ctx.session.transferState = prefillState(t);
  ctx.session.repeatTransfers = undefined;

  await ctx.reply(
    `🔁 *Repeating:*\n` +
    `${formatAmount(t.amount)} ${displaySymbol(t.source_token)} (${t.source_chain}) → ${displaySymbol(t.dest_token)} (${t.dest_chain})\n` +
    `To: \`${truncateAddr(t.recipient)}\`\n\n` +
    `Fetching quote...`,
    { parse_mode: 'Markdown' },
  );

  const { showConfirmation, getChainsCached } = await import('../conversations/transfer.js');
  const chains = await getChainsCached();
  await showConfirmation(ctx, ctx.session.transferState!, chains);
}

function prefillState(t: {
  source_chain: string;
  source_token: string;
  dest_chain: string;
  dest_token: string;
  amount: string;
  recipient: string;
  deposit_address?: string;
}): TransferState {
  return {
    step: 'confirm',
    srcChain: t.source_chain as any,
    srcToken: t.source_token,
    dstChain: t.dest_chain as any,
    dstToken: t.dest_token,
    amount: t.amount,
    recipient: t.recipient,
    refundAddress: undefined, // Will be filled during confirmation
    page: 0,
  };
}
