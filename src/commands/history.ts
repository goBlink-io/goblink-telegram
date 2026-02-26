import type { BotContext } from '../types/index.js';
import { getUser, getUserTransfers } from '../services/supabase.js';
import { formatHistoryEntry } from '../utils/formatters.js';
import { mainMenuKeyboard } from '../utils/keyboards.js';

export async function historyCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    const user = await getUser(from.id);
    if (!user) {
      await ctx.reply('📋 No transfers yet. Start your first one!', {
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }
    const transfers = await getUserTransfers(user.id);

    if (transfers.length === 0) {
      await ctx.reply('📋 No transfers yet. Start your first one!', {
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    const lines = transfers.map((t) =>
      formatHistoryEntry(
        t.amount,
        t.source_token,
        t.source_chain,
        t.dest_chain,
        t.status,
        t.created_at,
        t.tx_hash,
      ),
    );

    await ctx.reply(`📋 Recent Transfers\n\n${lines.join('\n\n')}`, {
      reply_markup: mainMenuKeyboard(),
    });
  } catch (err) {
    console.error('Failed to fetch history:', err);
    await ctx.reply('Something went wrong. Please try again.');
  }
}
