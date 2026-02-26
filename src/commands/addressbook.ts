import type { BotContext } from '../types/index.js';
import { getAddresses, saveAddress, deleteAddress } from '../services/supabase.js';
import { getUser, createOrUpdateUser } from '../services/supabase.js';
import { InlineKeyboard } from 'grammy';

/**
 * /addressbook — list saved addresses
 */
export async function addressBookCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    const user = await getUser(from.id);
    if (!user) {
      await ctx.reply('📒 No saved addresses yet.\n\nUse /save to add one:\n`/save <label> <chain> <address>`', { parse_mode: 'Markdown' });
      return;
    }

    const addresses = await getAddresses(user.id);
    if (addresses.length === 0) {
      await ctx.reply('📒 No saved addresses yet.\n\nUse /save to add one:\n`/save <label> <chain> <address>`', { parse_mode: 'Markdown' });
      return;
    }

    const lines = ['📒 *Address Book*\n'];
    const kb = new InlineKeyboard();

    for (const entry of addresses) {
      const shortAddr = entry.address.length > 20
        ? `${entry.address.slice(0, 8)}...${entry.address.slice(-6)}`
        : entry.address;
      lines.push(`*${entry.label}* (${entry.chain})\n\`${entry.address}\``);
      lines.push('');
      kb.text(`❌ ${entry.label} (${entry.chain})`, `addr_del:${entry.id}`).row();
    }

    kb.text('« Back to Menu', 'menu:main').row();

    lines.push(`_${addresses.length} address${addresses.length === 1 ? '' : 'es'} saved_`);

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'Markdown',
      reply_markup: kb,
    });
  } catch (err) {
    console.error('Address book failed:', err);
    await ctx.reply('Something went wrong. Try again.');
  }
}

/**
 * /save <label> <chain> <address> — save a new address
 */
export async function saveAddressCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const parts = ctx.message?.text?.split(/\s+/).slice(1) ?? [];

  if (parts.length < 3) {
    await ctx.reply(
      '📒 *Save Address*\n\n' +
      'Usage: `/save <label> <chain> <address>`\n\n' +
      'Examples:\n' +
      '`/save MyWallet solana 7xKp...3mNw`\n' +
      '`/save CEX ethereum 0xABC...123`\n' +
      '`/save Urban near urbanblazr.near`\n\n' +
      'Chains: ethereum, solana, sui, near, base, arbitrum, polygon, bnb, optimism, tron, aptos, starknet',
      { parse_mode: 'Markdown' },
    );
    return;
  }

  const label = parts[0]!;
  const chain = parts[1]!.toLowerCase();
  const address = parts[2]!;

  // Validate chain
  const validChains = ['ethereum', 'solana', 'sui', 'near', 'base', 'arbitrum', 'bnb', 'polygon', 'optimism', 'tron', 'aptos', 'starknet'];
  if (!validChains.includes(chain)) {
    await ctx.reply(`Invalid chain "${chain}".\n\nValid chains: ${validChains.join(', ')}`);
    return;
  }

  try {
    const user = await createOrUpdateUser(from.id, from.username, from.first_name);
    await saveAddress(user.id, label, chain, address);
    await ctx.reply(`✅ Saved *${label}* (${chain})\n\`${address}\``, { parse_mode: 'Markdown' });
  } catch (err: any) {
    if (err?.message?.includes('duplicate') || err?.message?.includes('unique')) {
      await ctx.reply('This address is already saved for this chain.');
    } else {
      console.error('Save address failed:', err);
      await ctx.reply('Something went wrong. Try again.');
    }
  }
}

/**
 * Handle address deletion callback
 */
export async function handleAddressDeleteCallback(ctx: BotContext, addressId: string): Promise<void> {
  try { await ctx.answerCallbackQuery(); } catch {}

  try {
    await deleteAddress(addressId);
    await ctx.editMessageText('✅ Address deleted.\n\nUse /addressbook to see remaining addresses.');
  } catch (err) {
    console.error('Delete address failed:', err);
    await ctx.reply('Failed to delete. Try again.');
  }
}
