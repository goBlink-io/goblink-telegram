import type { BotContext } from '../types/index.js';
import { mainMenuKeyboard } from '../utils/keyboards.js';
import { createOrUpdateUser, getUser } from '../services/supabase.js';

export async function startCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  let isNew = false;
  try {
    const existing = await getUser(from.id);
    isNew = !existing;
    await createOrUpdateUser(from.id, from.username, from.first_name);
  } catch (err) {
    console.error('Failed to upsert user:', err);
  }

  const name = from.first_name || 'there';

  if (isNew) {
    await ctx.reply(
      `⚡ *goBlink*\n\n` +
      `Hey ${name}! Welcome to goBlink — the fastest way to move tokens across chains.\n\n` +
      `🔄 Transfer between 12 chains\n` +
      `💸 Request payments via shareable links\n` +
      `📒 Save addresses for quick sends\n` +
      `💰 Live token prices\n\n` +
      `Non-custodial · 65+ tokens · Instant\n\n` +
      `Tap a button to get started:`,
      { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() },
    );
  } else {
    await ctx.reply(
      `⚡ *goBlink* — Move value anywhere, instantly.`,
      { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() },
    );
  }
}
