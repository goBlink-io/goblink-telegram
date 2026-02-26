import type { BotContext } from '../types/index.js';
import { InlineKeyboard } from 'grammy';

/** Commands that contain private data — redirect to DM */
const PRIVATE_COMMANDS = new Set([
  'history', 'addressbook', 'addresses', 'save', 'default', 'repeat',
]);

/**
 * Check if we're in a group chat.
 */
export function isGroup(ctx: BotContext): boolean {
  const type = ctx.chat?.type;
  return type === 'group' || type === 'supergroup';
}

/**
 * For private commands in group chats, redirect to DM.
 * Returns true if the command was intercepted (caller should return early).
 */
export async function guardPrivateCommand(ctx: BotContext): Promise<boolean> {
  if (!isGroup(ctx)) return false;

  const text = ctx.message?.text ?? '';
  // Extract command name, stripping @botname suffix
  const cmdMatch = text.match(/^\/(\w+)/);
  if (!cmdMatch) return false;

  const cmd = cmdMatch[1]!.split('@')[0]!.toLowerCase();
  if (!PRIVATE_COMMANDS.has(cmd)) return false;

  const kb = new InlineKeyboard()
    .url('📩 Open DM', 'https://t.me/goBlinkBot');

  await ctx.reply(
    `🔒 /${cmd} contains private data. Use it in our DM:`,
    { reply_markup: kb },
  );
  return true;
}

/**
 * Send a message to user's DM from a group context.
 * Returns true if successful, false if bot can't DM the user.
 */
export async function sendToDM(
  ctx: BotContext,
  text: string,
  options?: { parse_mode?: string; reply_markup?: any },
): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) return false;

  try {
    await ctx.api.sendMessage(userId, text, options as any);
    return true;
  } catch {
    // User hasn't started the bot — can't DM
    return false;
  }
}

/**
 * Notify in group that details were sent to DM, with fallback if DM fails.
 */
export async function notifyDMSent(ctx: BotContext, what: string): Promise<void> {
  const name = ctx.from?.first_name ?? 'there';
  await ctx.reply(
    `📩 ${name}, I sent your ${what} via DM.`,
    { reply_markup: new InlineKeyboard().url('Open DM', 'https://t.me/goBlinkBot') },
  );
}

export async function notifyDMFailed(ctx: BotContext): Promise<void> {
  await ctx.reply(
    `❌ I can't DM you yet. Please start the bot first:`,
    { reply_markup: new InlineKeyboard().url('Start @goBlinkBot', 'https://t.me/goBlinkBot?start=from_group') },
  );
}
