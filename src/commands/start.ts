import type { BotContext } from '../types/index.js';
import { mainMenuKeyboard } from '../utils/keyboards.js';
import { createOrUpdateUser } from '../services/supabase.js';

export async function startCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    await createOrUpdateUser(from.id, from.username, from.first_name);
  } catch (err) {
    console.error('Failed to upsert user:', err);
  }

  await ctx.reply(
    `⚡ goBlink — Move value anywhere, instantly.\n\n26 chains. 65+ tokens. Zero complexity.`,
    { reply_markup: mainMenuKeyboard() },
  );
}
