import type { BotContext } from '../types/index.js';
import { createOrUpdateUser, setUserDefaults, getUserDefaults } from '../services/supabase.js';
import { displaySymbol } from '../utils/formatters.js';

const VALID_CHAINS = [
  'ethereum', 'solana', 'sui', 'near', 'base', 'arbitrum',
  'bnb', 'polygon', 'optimism', 'tron', 'aptos', 'starknet',
];

/**
 * /default [chain] [token] — set or view default source chain/token
 * 
 * /default              → show current defaults
 * /default solana USDC  → set defaults
 * /default clear        → clear defaults
 */
export async function defaultCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const parts = ctx.message?.text?.split(/\s+/).slice(1) ?? [];

  // Show current defaults
  if (parts.length === 0) {
    try {
      const defaults = await getUserDefaults(from.id);
      if (!defaults?.srcChain) {
        await ctx.reply(
          '⚙️ *Default Source*: not set\n\n' +
          'Set a default to skip the first 2 steps:\n' +
          '`/default solana USDC`\n' +
          '`/default near NEAR`\n' +
          '`/default clear` to reset',
          { parse_mode: 'Markdown' },
        );
      } else {
        const token = defaults.srcToken ? displaySymbol(defaults.srcToken) : 'any';
        await ctx.reply(
          `⚙️ *Default Source*: ${defaults.srcChain} / ${token}\n\n` +
          'Your /transfer will start at step 3 (destination).\n\n' +
          '`/default clear` to reset',
          { parse_mode: 'Markdown' },
        );
      }
    } catch {
      await ctx.reply('❌ Couldn\'t load settings. Try again.');
    }
    return;
  }

  // Clear defaults
  if (parts[0]!.toLowerCase() === 'clear') {
    try {
      await createOrUpdateUser(from.id, from.username, from.first_name);
      await setUserDefaults(from.id, {});
      await ctx.reply('✅ Defaults cleared. /transfer starts from scratch.');
    } catch {
      await ctx.reply('❌ Couldn\'t clear defaults. Try again.');
    }
    return;
  }

  // Set defaults
  const chain = parts[0]!.toLowerCase();
  const token = parts[1]?.toUpperCase();

  if (!VALID_CHAINS.includes(chain)) {
    await ctx.reply(`❌ Unknown chain "${chain}".\n\nValid: ${VALID_CHAINS.join(', ')}`);
    return;
  }

  if (!token) {
    await ctx.reply('Usage: `/default <chain> <token>`\n\nExample: `/default solana USDC`', { parse_mode: 'Markdown' });
    return;
  }

  try {
    await createOrUpdateUser(from.id, from.username, from.first_name);
    await setUserDefaults(from.id, { srcChain: chain, srcToken: token });
    await ctx.reply(
      `✅ Default set: *${chain}* / *${displaySymbol(token)}*\n\n` +
      'Your /transfer will now skip to destination chain.',
      { parse_mode: 'Markdown' },
    );
  } catch {
    await ctx.reply('❌ Couldn\'t save defaults. Try again.');
  }
}
