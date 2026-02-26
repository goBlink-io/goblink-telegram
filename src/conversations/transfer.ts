/**
 * Transfer flow — state machine approach (no grammY conversations plugin).
 * Each step handles its own callback queries and advances the state.
 */
import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../types/index.js';
import type { ChainId, ChainConfig, Token } from '@urban-blazer/goblink-sdk';
import { getSDK } from '../services/goblink.js';
import {
  chainSelectKeyboard,
  tokenSelectKeyboard,
  amountKeyboard,
  confirmKeyboard,
  transferStatusKeyboard,
  mainMenuKeyboard,
  sortChains,
  sortTokens,
} from '../utils/keyboards.js';
import {
  formatTransferSummary,
  formatDepositMessage,
  displaySymbol,
} from '../utils/formatters.js';
import {
  checkTransferLimit,
  checkQuoteLimit,
  formatRetryAfter,
} from '../utils/rate-limiter.js';
import { isActiveChain, filterTokensBySymbol } from '../utils/filters.js';
import { createOrUpdateUser, createTransfer, getUser, getAddresses } from '../services/supabase.js';

export type TransferStep =
  | 'src_chain'
  | 'src_token'
  | 'dst_chain'
  | 'dst_token'
  | 'amount'
  | 'recipient'
  | 'refund'
  | 'confirm'
  | 'done';

export interface TransferState {
  step: TransferStep;
  srcChain?: ChainId;
  srcToken?: string;
  dstChain?: ChainId;
  dstToken?: string;
  amount?: string;
  recipient?: string;
  refundAddress?: string;
  page: number;
  chains?: ChainConfig[];
  tokens?: Token[];
  lastMessageId?: number;
}

function newTransferState(): TransferState {
  return { step: 'src_chain', page: 0 };
}

// --- Step labels (Fix #1: step counter + Fix #3: human-friendly wording) ---
const STEP_LABELS: Record<TransferStep, { num: number; total: number; label: string }> = {
  src_chain:  { num: 1, total: 6, label: 'Send from' },
  src_token:  { num: 2, total: 6, label: 'Select token' },
  dst_chain:  { num: 3, total: 6, label: 'Send to' },
  dst_token:  { num: 4, total: 6, label: 'Select token' },
  amount:     { num: 5, total: 6, label: 'Amount' },
  recipient:  { num: 5, total: 6, label: 'Recipient' },
  refund:     { num: 5, total: 6, label: 'Refund address' },
  confirm:    { num: 6, total: 6, label: 'Confirm' },
  done:       { num: 6, total: 6, label: 'Done' },
};

function stepHeader(step: TransferStep): string {
  const s = STEP_LABELS[step];
  const bar = '●'.repeat(s.num) + '○'.repeat(s.total - s.num);
  return `${bar}  Step ${s.num}/${s.total} · ${s.label}`;
}

/** Fire typing indicator — best-effort, non-blocking */
function sendTyping(ctx: BotContext): void {
  ctx.replyWithChatAction('typing').catch(() => {});
}

// --- Cached data ---
let cachedChains: ChainConfig[] | null = null;
let chainsCacheTime = 0;
const CHAINS_TTL = 300_000; // 5 min

async function getChains(): Promise<ChainConfig[]> {
  if (cachedChains && Date.now() - chainsCacheTime < CHAINS_TTL) return cachedChains;
  const sdk = getSDK();
  const all = sdk.getChains();
  cachedChains = all.filter((c) => isActiveChain(c.id));
  chainsCacheTime = Date.now();
  return cachedChains;
}

async function getTokensForChain(chain: ChainId): Promise<Token[]> {
  const sdk = getSDK();
  const all = await sdk.getTokens({ chain });
  return filterTokensBySymbol(all);
}

// --- Send/edit step message (edits in-place when possible) ---
async function sendStep(ctx: BotContext, state: TransferState, text: string, markup: unknown): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  if (state.lastMessageId) {
    try {
      await ctx.api.editMessageText(chatId, state.lastMessageId, text, {
        reply_markup: markup as any,
      });
      return; // Successfully edited in-place
    } catch {
      // Edit failed (message too old, deleted, or type mismatch) — send new
    }
  }

  const msg = await ctx.reply(text, { reply_markup: markup as any });
  state.lastMessageId = msg.message_id;
}

// --- Start transfer flow ---
export async function startTransferFlow(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const limit = checkTransferLimit(from.id);
  if (!limit.allowed) {
    await ctx.reply(`⏳ Slow down! Try again in ${formatRetryAfter(limit.retryAfterMs)}.`);
    return;
  }

  const state = newTransferState();
  ctx.session.transferState = state;

  sendTyping(ctx);
  const chains = await getChains();
  state.chains = chains;

  await sendStep(ctx, state, `${stepHeader('src_chain')}\n\n🔗 Where are your tokens now?`, chainSelectKeyboard(sortChains(chains), 0, 'src_chain'));
}

// --- Handle all transfer-related callbacks ---
export async function handleTransferCallback(ctx: BotContext, data: string): Promise<void> {
  const state = ctx.session.transferState;
  if (!state) {
    await ctx.reply('No active transfer. Use /transfer to start.');
    return;
  }

  try { await ctx.answerCallbackQuery(); } catch { /* stale */ }

  const chains = state.chains ?? await getChains();

  // --- Cancel --- (Fix #5: menu keyboard on cancel)
  if (data === 'action:cancel') {
    ctx.session.transferState = undefined;
    await ctx.reply('Transfer cancelled.', { reply_markup: mainMenuKeyboard() });
    return;
  }

  // --- Back to chains (from token selection) ---
  if (data === 'action:back_to_chains') {
    if (state.step === 'src_token') {
      state.step = 'src_chain';
      state.srcChain = undefined;
      state.page = 0;
      await sendStep(ctx, state, `${stepHeader('src_chain')}\n\n🔗 Where are your tokens now?`, chainSelectKeyboard(sortChains(chains), 0, 'src_chain'));
    } else if (state.step === 'dst_token') {
      state.step = 'dst_chain';
      state.dstChain = undefined;
      state.page = 0;
      const destChains = chains.filter((c) => c.id !== state.srcChain);
      await sendStep(ctx, state, `${stepHeader('dst_chain')}\n\n🎯 Where should they go?`, chainSelectKeyboard(sortChains(destChains), 0, 'dst_chain'));
    }
    return;
  }

  // --- Pagination ---
  if (data.startsWith('page:')) {
    const parts = data.split(':');
    const page = parseInt(parts[parts.length - 1]!, 10);
    state.page = page;

    if (state.step === 'src_chain') {
      await sendStep(ctx, state, `${stepHeader('src_chain')}\n\n🔗 Where are your tokens now?`, chainSelectKeyboard(sortChains(chains), page, 'src_chain'));
    } else if (state.step === 'src_token' && state.tokens) {
      const chainConfig = chains.find((c) => c.id === state.srcChain)!;
      const sorted = sortTokens(state.tokens, chainConfig.nativeToken);
      await sendStep(ctx, state, `${stepHeader('src_token')}\n\n💎 Select token on ${chainConfig.name}:`, tokenSelectKeyboard(sorted, page, 'src_token'));
    } else if (state.step === 'dst_chain') {
      const destChains = chains.filter((c) => c.id !== state.srcChain);
      await sendStep(ctx, state, `${stepHeader('dst_chain')}\n\n🎯 Where should they go?`, chainSelectKeyboard(sortChains(destChains), page, 'dst_chain'));
    } else if (state.step === 'dst_token' && state.tokens) {
      const chainConfig = chains.find((c) => c.id === state.dstChain)!;
      const sorted = sortTokens(state.tokens, chainConfig.nativeToken);
      await sendStep(ctx, state, `${stepHeader('dst_token')}\n\n💎 Select token on ${chainConfig.name}:`, tokenSelectKeyboard(sorted, page, 'dst_token'));
    }
    return;
  }

  // --- Source chain selected ---
  if (data.startsWith('src_chain:') && state.step === 'src_chain') {
    const chainId = data.split(':')[1] as ChainId;
    state.srcChain = chainId;
    state.step = 'src_token';
    state.page = 0;

    sendTyping(ctx);
    const chainConfig = chains.find((c) => c.id === chainId)!;
    const tokens = await getTokensForChain(chainId);
    state.tokens = tokens;
    const sorted = sortTokens(tokens, chainConfig.nativeToken);
    await sendStep(ctx, state, `${stepHeader('src_token')}\n\n💎 Which token on ${chainConfig.name}?`, tokenSelectKeyboard(sorted, 0, 'src_token'));
    return;
  }

  // --- Source token selected ---
  if (data.startsWith('src_token:') && state.step === 'src_token') {
    state.srcToken = data.split(':')[1]!;
    state.step = 'dst_chain';
    state.page = 0;
    state.tokens = undefined;

    const destChains = chains.filter((c) => c.id !== state.srcChain);
    await sendStep(ctx, state, `${stepHeader('dst_chain')}\n\n🎯 Where should they go?`, chainSelectKeyboard(sortChains(destChains), 0, 'dst_chain'));
    return;
  }

  // --- Dest chain selected ---
  if (data.startsWith('dst_chain:') && state.step === 'dst_chain') {
    const chainId = data.split(':')[1] as ChainId;
    state.dstChain = chainId;
    state.step = 'dst_token';
    state.page = 0;

    sendTyping(ctx);
    const chainConfig = chains.find((c) => c.id === chainId)!;
    const tokens = await getTokensForChain(chainId);
    state.tokens = tokens;
    const sorted = sortTokens(tokens, chainConfig.nativeToken);
    await sendStep(ctx, state, `${stepHeader('dst_token')}\n\n💎 Which token on ${chainConfig.name}?`, tokenSelectKeyboard(sorted, 0, 'dst_token'));
    return;
  }

  // --- Dest token selected ---
  if (data.startsWith('dst_token:') && state.step === 'dst_token') {
    state.dstToken = data.split(':')[1]!;
    state.step = 'amount';
    state.tokens = undefined;

    // Look up source token price for smart presets
    let price: number | undefined;
    try {
      const srcTokens = await getTokensForChain(state.srcChain!);
      const tokenInfo = srcTokens.find((t) => t.symbol === state.srcToken);
      price = tokenInfo?.price;
    } catch { /* ignore */ }

    await sendStep(ctx, state, `${stepHeader('amount')}\n\n💵 How much ${displaySymbol(state.srcToken!)} to send?`, amountKeyboard(state.srcToken!, price));
    return;
  }

  // --- Amount presets ---
  if (data.startsWith('amount:') && state.step === 'amount') {
    if (data === 'amount:custom') {
      await ctx.reply(`Type the amount of ${displaySymbol(state.srcToken!)} to send:`);
      return;
    }
    state.amount = data.split(':')[1]!;
    state.step = 'recipient';
    await promptRecipient(ctx, state, chains);
    return;
  }

  // --- Saved address selected ---
  if (data.startsWith('saved_addr:') && state.step === 'recipient') {
    state.recipient = data.split(':').slice(1).join(':'); // address might contain colons
    await handleRecipientSet(ctx, state, chains);
    return;
  }

  // --- Retry quote ---
  if (data === 'confirm:retry' && state.step === 'confirm') {
    await showConfirmation(ctx, state, chains);
    return;
  }

  // --- Confirm ---
  if (data === 'confirm:yes' && state.step === 'confirm') {
    state.step = 'done';
    await executeTransfer(ctx, state, chains);
    ctx.session.transferState = undefined;
    return;
  }

  if (data === 'confirm:no' && state.step === 'confirm') {
    ctx.session.transferState = undefined;
    await ctx.reply('Transfer cancelled.', { reply_markup: mainMenuKeyboard() });
    return;
  }
}

// --- Handle text messages during transfer flow ---
export async function handleTransferText(ctx: BotContext): Promise<boolean> {
  const state = ctx.session.transferState;
  if (!state) return false;

  const text = ctx.message?.text?.trim();
  if (!text) return false;

  if (text === '/cancel') {
    ctx.session.transferState = undefined;
    await ctx.reply('Transfer cancelled.', { reply_markup: mainMenuKeyboard() });
    return true;
  }

  const chains = state.chains ?? await getChains();
  const sdk = getSDK();

  // --- Amount input ---
  if (state.step === 'amount') {
    const parsed = parseFloat(text);
    if (isNaN(parsed) || parsed <= 0) {
      await ctx.reply('Please enter a valid positive number.');
      return true;
    }
    state.amount = text;
    state.step = 'recipient';
    await promptRecipient(ctx, state, chains);
    return true;
  }

  // --- Recipient address ---
  if (state.step === 'recipient') {
    const valid = sdk.validateAddress(state.dstChain!, text);
    if (!valid) {
      const destConfig = chains.find((c) => c.id === state.dstChain)!;
      await ctx.reply(`Invalid ${destConfig.name} address. Please try again.`);
      return true;
    }
    state.recipient = text;
    await handleRecipientSet(ctx, state, chains);
    return true;
  }

  // --- Refund address ---
  if (state.step === 'refund') {
    const valid = sdk.validateAddress(state.srcChain!, text);
    if (!valid) {
      const srcConfig = chains.find((c) => c.id === state.srcChain)!;
      await ctx.reply(`Invalid ${srcConfig.name} address. Please try again.`);
      return true;
    }
    state.refundAddress = text;
    state.step = 'confirm';
    await showConfirmation(ctx, state, chains);
    return true;
  }

  return false;
}

// --- Show confirmation ---
async function showConfirmation(ctx: BotContext, state: TransferState, chains: ChainConfig[]): Promise<void> {
  const sdk = getSDK();
  const quoteLimit = checkQuoteLimit(ctx.from!.id);
  if (!quoteLimit.allowed) {
    await ctx.reply(`⏳ Slow down! Try again in ${formatRetryAfter(quoteLimit.retryAfterMs)}.`);
    return;
  }

  sendTyping(ctx);

  try {
    const quote = await sdk.getQuote({
      from: { chain: state.srcChain!, token: state.srcToken! },
      to: { chain: state.dstChain!, token: state.dstToken! },
      amount: state.amount!,
      recipient: state.recipient!,
      refundAddress: state.refundAddress!,
    });

    const srcConfig = chains.find((c) => c.id === state.srcChain)!;
    const dstConfig = chains.find((c) => c.id === state.dstChain)!;

    const summary = formatTransferSummary(
      state.amount!, state.srcToken!, state.dstToken!,
      srcConfig.name, dstConfig.name,
      state.recipient!, state.refundAddress!,
      quote,
    );

    await ctx.reply(`${stepHeader('confirm')}\n\n${summary}\n\nConfirm this transfer?`, {
      reply_markup: confirmKeyboard(),
    });
  } catch (err: any) {
    console.error('Quote failed:', err);
    // Fix #4: keep state — let user retry instead of wiping progress
    const retryKb = new InlineKeyboard()
      .text('🔄 Retry Quote', 'confirm:retry')
      .text('✖ Cancel', 'action:cancel');
    const errMsg = err?.message?.includes('No route')
      ? 'No route found for this pair/amount. Try a different token or amount.'
      : err?.message?.includes('timeout') || err?.message?.includes('ETIMEDOUT')
      ? 'Quote server timed out. Tap Retry.'
      : 'Couldn\'t get a quote right now. Tap Retry or cancel.';
    await ctx.reply(`❌ ${errMsg}`, { reply_markup: retryKb });
  }
}

// --- Execute transfer ---
async function executeTransfer(ctx: BotContext, state: TransferState, chains: ChainConfig[]): Promise<void> {
  const sdk = getSDK();
  const from = ctx.from!;

  sendTyping(ctx);
  try {
    const transfer = await sdk.createTransfer({
      from: { chain: state.srcChain!, token: state.srcToken! },
      to: { chain: state.dstChain!, token: state.dstToken! },
      amount: state.amount!,
      recipient: state.recipient!,
      refundAddress: state.refundAddress!,
    });

    const srcConfig = chains.find((c) => c.id === state.srcChain)!;

    const depositMsg = formatDepositMessage(
      transfer.depositAddress,
      transfer.depositAmount,
      state.srcToken!,
      srcConfig.name,
      transfer.expiresAt,
    );

    const sentMsg = await ctx.reply(depositMsg, {
      parse_mode: 'Markdown',
      reply_markup: transferStatusKeyboard(),
    });

    // Save to DB
    try {
      const user = await createOrUpdateUser(from.id, from.username, from.first_name);
      await createTransfer({
        user_id: user.id,
        chat_id: ctx.chat?.id ?? from.id,
        message_id: sentMsg.message_id,
        source_chain: state.srcChain!,
        source_token: state.srcToken!,
        dest_chain: state.dstChain!,
        dest_token: state.dstToken!,
        amount: state.amount!,
        recipient: state.recipient!,
        deposit_address: transfer.depositAddress,
        status: 'PENDING',
      });
    } catch (err) {
      console.error('Failed to save transfer to DB:', err);
    }

    console.log(
      `Transfer created: ${transfer.id} by user ${from.id} — ${state.amount} ${state.srcToken} (${state.srcChain}) → ${state.dstToken} (${state.dstChain})`,
    );
  } catch (err) {
    console.error('Transfer creation failed:', err);
    await ctx.reply('Something went wrong creating the transfer. Please try again.', { reply_markup: mainMenuKeyboard() });
  }
}

// --- Prompt for recipient address (with saved addresses) ---
async function promptRecipient(ctx: BotContext, state: TransferState, chains: ChainConfig[]): Promise<void> {
  const destConfig = chains.find((c) => c.id === state.dstChain)!;
  const from = ctx.from ?? ctx.callbackQuery?.from;
  const header = `${stepHeader('recipient')}\n\n`;
  if (!from) {
    await ctx.reply(`${header}📬 Who's receiving? Enter a ${destConfig.name} address:`);
    return;
  }

  // Look up saved addresses for the destination chain
  try {
    const user = await getUser(from.id);
    if (user) {
      const addresses = await getAddresses(user.id);
      const chainAddresses = addresses.filter((a) => a.chain === state.dstChain);

      if (chainAddresses.length > 0) {
        const kb = new InlineKeyboard();
        for (const addr of chainAddresses) {
          const short = addr.address.length > 20
            ? `${addr.address.slice(0, 6)}...${addr.address.slice(-4)}`
            : addr.address;
          kb.text(`📒 ${addr.label} (${short})`, `saved_addr:${addr.address}`).row();
        }
        kb.text('✖ Cancel', 'action:cancel');

        await ctx.reply(
          `${header}📬 Who's receiving on ${destConfig.name}? Pick a saved address or type one:`,
          { reply_markup: kb },
        );
        return;
      }
    }
  } catch { /* ignore, fall through to plain prompt */ }

  await ctx.reply(`${header}📬 Who's receiving? Enter a ${destConfig.name} address:`);
}

// --- Handle recipient being set (advance to refund or confirm) ---
async function handleRecipientSet(ctx: BotContext, state: TransferState, chains: ChainConfig[]): Promise<void> {
  if (state.srcChain === state.dstChain) {
    state.refundAddress = state.recipient;
    state.step = 'confirm';
    await showConfirmation(ctx, state, chains);
  } else {
    state.step = 'refund';
    const srcConfig = chains.find((c) => c.id === state.srcChain)!;
    await ctx.reply(`${stepHeader('refund')}\n\n🔙 Enter your ${srcConfig.name} address for refunds (if anything goes wrong):`);
  }
}
