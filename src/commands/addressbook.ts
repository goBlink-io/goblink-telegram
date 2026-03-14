import type { BotContext } from '../types/index.js';
import { getAddresses, saveAddress, deleteAddress } from '../services/supabase.js';
import { getUser, createOrUpdateUser } from '../services/supabase.js';
import { InlineKeyboard } from 'grammy';
import { htmlEsc } from '../utils/formatters.js';
import { normalizeChainId } from '../utils/filters.js';

/**
 * /addressbook — list saved addresses
 */
export async function addressBookCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    const user = await getUser(from.id);
    if (!user) {
      await ctx.reply('📒 No saved addresses yet.\n\nUse /save to add one:\n<code>/save &lt;label&gt; &lt;chain&gt; &lt;address&gt;</code>', { parse_mode: 'HTML' });
      return;
    }

    const addresses = await getAddresses(user.id);
    if (addresses.length === 0) {
      await ctx.reply('📒 No saved addresses yet.\n\nUse /save to add one:\n<code>/save &lt;label&gt; &lt;chain&gt; &lt;address&gt;</code>', { parse_mode: 'HTML' });
      return;
    }

    const lines = ['📒 <b>Address Book</b>\n'];
    const kb = new InlineKeyboard();

    for (const entry of addresses) {
      const shortAddr = entry.address.length > 20
        ? `${entry.address.slice(0, 8)}...${entry.address.slice(-6)}`
        : entry.address;
      lines.push(`<b>${htmlEsc(entry.label)}</b> (${htmlEsc(entry.chain)})\n<code>${htmlEsc(entry.address)}</code>`);
      lines.push('');
      kb.text(`❌ ${entry.label} (${entry.chain})`, `addr_del:${entry.id}`).row();
    }

    kb.text('« Back to Menu', 'menu:main').row();

    lines.push(`<i>${addresses.length} address${addresses.length === 1 ? '' : 'es'} saved</i>`);

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    console.error('Address book failed:', err);
    await ctx.reply('❌ Something went wrong. Please try again or use /start to go back.');
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
      '📒 <b>Save Address</b>\n\n' +
      'Usage: <code>/save &lt;label&gt; &lt;chain&gt; &lt;address&gt;</code>\n\n' +
      'Examples:\n' +
      '<code>/save MyWallet solana 7xKp...3mNw</code>\n' +
      '<code>/save CEX ethereum 0xABC...123</code>\n' +
      '<code>/save Urban near urbanblazr.near</code>\n\n' +
      'Chains: ethereum, solana, sui, near, base, arbitrum, polygon, bnb, optimism, tron, aptos, starknet',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const label = parts[0]!;
  const chain = normalizeChainId(parts[1]!);
  const address = parts[2]!;

  // Validate chain
  const validChains = ['ethereum', 'solana', 'sui', 'near', 'base', 'arbitrum', 'bnb', 'bsc', 'polygon', 'optimism', 'tron', 'aptos', 'starknet'];
  if (!validChains.includes(chain)) {
    await ctx.reply(`Invalid chain "${chain}".\n\nValid chains: ${validChains.join(', ')}`);
    return;
  }

  try {
    const user = await createOrUpdateUser(from.id, from.username, from.first_name);
    await saveAddress(user.id, label, chain, address);
    await ctx.reply(`✅ Saved <b>${htmlEsc(label)}</b> (${htmlEsc(chain)})\n<code>${htmlEsc(address)}</code>`, { parse_mode: 'HTML' });
  } catch (err: any) {
    if (err?.message?.includes('duplicate') || err?.message?.includes('unique')) {
      await ctx.reply('This address is already saved for this chain.');
    } else {
      console.error('Save address failed:', err);
      await ctx.reply('❌ Something went wrong. Please try again or use /start to go back.');
    }
  }
}

/**
 * Handle address deletion callback
 */
export async function handleAddressDeleteCallback(ctx: BotContext, addressId: string): Promise<void> {
  try { await ctx.answerCallbackQuery(); } catch {}

  const from = ctx.from;
  if (!from) return;

  try {
    const user = await getUser(from.id);
    if (!user) {
      await ctx.reply('❌ User not found. Use /start first.');
      return;
    }
    await deleteAddress(addressId, user.id);
    await ctx.editMessageText('✅ Address deleted.\n\nUse /addressbook to see remaining addresses.');
  } catch (err) {
    console.error('Delete address failed:', err);
    await ctx.reply('❌ Couldn\'t delete that address. Try again or use /addressbook.');
  }
}
