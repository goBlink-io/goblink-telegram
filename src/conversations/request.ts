import type { BotContext } from '../types/index.js';
import { GoBlink } from '@urban-blazer/goblink-sdk';
import type { ChainId, Token } from '@urban-blazer/goblink-sdk';
import { ACTIVE_CHAIN_IDS, HIDDEN_TOKEN_SYMBOLS } from '../utils/filters.js';
import { chainSelectKeyboard, tokenSelectKeyboard, amountKeyboard, mainMenuKeyboard } from '../utils/keyboards.js';
import { InlineKeyboard } from 'grammy';
import { getAddresses, getUser } from '../services/supabase.js';
import { displaySymbol } from '../utils/formatters.js';

const sdk = new GoBlink();

type RequestStepName = 'chain' | 'token' | 'amount' | 'address' | 'memo' | 'done';

const REQ_STEP_LABELS: Record<RequestStepName, { num: number; total: number; label: string }> = {
  chain:   { num: 1, total: 5, label: 'Receive on' },
  token:   { num: 2, total: 5, label: 'Select token' },
  amount:  { num: 3, total: 5, label: 'Amount' },
  address: { num: 4, total: 5, label: 'Your address' },
  memo:    { num: 4, total: 5, label: 'Memo' },
  done:    { num: 5, total: 5, label: 'Done' },
};

function reqStepHeader(step: RequestStepName): string {
  const s = REQ_STEP_LABELS[step];
  const bar = '●'.repeat(s.num) + '○'.repeat(s.total - s.num);
  return `${bar}  Step ${s.num}/${s.total} · ${s.label}`;
}

function sendTyping(ctx: BotContext): void {
  ctx.replyWithChatAction('typing').catch(() => {});
}



async function getTokensForChain(chain: ChainId): Promise<Token[]> {
  const all = await sdk.getTokens({ chain });
  return all.filter((t: Token) => !HIDDEN_TOKEN_SYMBOLS.has(t.symbol));
}

// --- Helpers ---

function encodePaymentRequest(data: {
  recipient: string;
  toChain: string;
  toToken: string;
  amount: string;
  memo?: string;
  name?: string;
  createdAt: number;
}): string {
  const json = JSON.stringify(data);
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generatePaymentUrl(data: Parameters<typeof encodePaymentRequest>[0]): string {
  return `https://goblink.io/pay/${encodePaymentRequest(data)}`;
}

async function shortenPaymentUrl(data: {
  recipient: string;
  toChain: string;
  toToken: string;
  amount: string;
  memo?: string;
  name?: string;
}): Promise<string | null> {
  try {
    const res = await fetch('https://goblink.io/api/pay/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const json = await res.json() as { url?: string };
    return json.url ?? null;
  } catch {
    return null;
  }
}

async function editMessage(ctx: BotContext, text: string, keyboard?: InlineKeyboard): Promise<void> {
  const msgId = ctx.session.requestState?.lastMessageId;
  if (!msgId) return;
  try {
    await ctx.api.editMessageText(ctx.chat!.id, msgId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch {
    // Message unchanged or deleted — ignore
  }
}

// --- Start ---

export async function startRequestFlow(ctx: BotContext): Promise<void> {
  try {
    sendTyping(ctx);
    const allChains = await sdk.getChains();
    const chains = allChains.filter(c => ACTIVE_CHAIN_IDS.has(c.id));

    ctx.session.requestState = {
      step: 'chain',
      page: 0,
      chains,
    };

    const msg = await ctx.reply(
      `${reqStepHeader('chain')}\n\n💸 Which chain should you receive on?`,
      {
        reply_markup: chainSelectKeyboard(chains, 0, 'req_chain'),
      },
    );

    ctx.session.requestState.lastMessageId = msg.message_id;
  } catch (err) {
    console.error('Request flow start failed:', err);
    await ctx.reply('Something went wrong. Try again.');
  }
}

// --- Callback Handler ---

export async function handleRequestCallback(ctx: BotContext, data: string): Promise<void> {
  try { await ctx.answerCallbackQuery(); } catch {}

  const state = ctx.session.requestState;
  if (!state) return;

  // Chain selected
  if (data.startsWith('req_chain:')) {
    const chainId = data.split(':')[1]!;
    state.chain = chainId as any;
    state.step = 'token';
    state.page = 0;

    try {
      sendTyping(ctx);
      const tokens = await getTokensForChain(chainId as ChainId);
      state.tokens = tokens;

      const chainName = state.chains?.find(c => c.id === chainId)?.name ?? chainId;
      await editMessage(
        ctx,
        `${reqStepHeader('token')}\n\n🔗 Chain: *${chainName}*\n\nWhich token do you want to receive?`,
        tokenSelectKeyboard(tokens, 0, 'req_token'),
      );
    } catch (err) {
      console.error('Failed to fetch tokens:', err);
      await editMessage(ctx, 'Failed to load tokens. Try again with /request');
      ctx.session.requestState = undefined;
    }
    return;
  }

  // Token selected
  if (data.startsWith('req_token:')) {
    const symbol = data.split(':')[1]!;
    state.token = symbol;
    state.step = 'amount';

    const chainName = state.chains?.find(c => c.id === state.chain)?.name ?? state.chain;
    const price = state.tokens?.find(t => t.symbol === symbol)?.price;

    await editMessage(
      ctx,
      `${reqStepHeader('amount')}\n\n🔗 *${chainName}* · 💰 *${displaySymbol(symbol)}*\n\nHow much ${displaySymbol(symbol)} do you want to request?`,
      amountKeyboard(symbol, price),
    );
    return;
  }

  // Amount preset selected
  if (data.startsWith('amount:')) {
    const amount = data.split(':')[1]!;
    if (amount === 'custom') {
      const chainName = state.chains?.find(c => c.id === state.chain)?.name ?? state.chain;
      await editMessage(
        ctx,
        `${reqStepHeader('amount')}\n\n🔗 *${chainName}* · 💰 *${displaySymbol(state.token!)}*\n\nType the amount of ${displaySymbol(state.token!)} to request:`,
        new InlineKeyboard().text('◂ Back', 'req_back_tokens').row().text('✖ Cancel', 'action:cancel'),
      );
      // step stays 'amount' so text handler picks it up
      return;
    }
    await handleAmountInput(ctx, amount);
    return;
  }

  // Saved address selected
  if (data.startsWith('req_addr:')) {
    const address = data.split(':').slice(1).join(':'); // address may contain ':'
    state.address = address;
    state.step = 'memo';
    await showMemoStep(ctx);
    return;
  }

  // Skip memo
  if (data === 'req_skip_memo') {
    state.memo = undefined;
    state.step = 'done';
    await generateAndShowLink(ctx);
    return;
  }

  // Back to chains
  if (data === 'req_back_chains') {
    state.step = 'chain';
    state.page = 0;
    state.chain = undefined;
    state.token = undefined;
    state.amount = undefined;
    state.address = undefined;
    await editMessage(
      ctx,
      `${reqStepHeader('chain')}\n\n💸 Which chain should you receive on?`,
      chainSelectKeyboard(state.chains ?? [], 0, 'req_chain'),
    );
    return;
  }

  // Back to tokens
  if (data === 'req_back_tokens') {
    state.step = 'token';
    state.page = 0;
    state.token = undefined;
    state.amount = undefined;
    state.address = undefined;
    const chainName = state.chains?.find(c => c.id === state.chain)?.name ?? state.chain;
    await editMessage(
      ctx,
      `${reqStepHeader('token')}\n\n🔗 *${chainName}*\n\nWhich token do you want to receive?`,
      tokenSelectKeyboard(state.tokens ?? [], 0, 'req_token'),
    );
    return;
  }

  // Pagination
  if (data.startsWith('page:req_chain:')) {
    const page = parseInt(data.split(':')[2]!, 10);
    state.page = page;
    await editMessage(
      ctx,
      `${reqStepHeader('chain')}\n\n💸 Which chain should you receive on?`,
      chainSelectKeyboard(state.chains ?? [], page, 'req_chain'),
    );
    return;
  }

  if (data.startsWith('page:req_token:')) {
    const page = parseInt(data.split(':')[2]!, 10);
    state.page = page;
    const chainName = state.chains?.find(c => c.id === state.chain)?.name ?? state.chain;
    await editMessage(
      ctx,
      `${reqStepHeader('token')}\n\n🔗 *${chainName}*\n\nWhich token do you want to receive?`,
      tokenSelectKeyboard(state.tokens ?? [], page, 'req_token'),
    );
    return;
  }

  // Cancel (Fix #5: show menu after cancel)
  if (data === 'action:cancel') {
    ctx.session.requestState = undefined;
    await editMessage(ctx, '✖ Payment request cancelled.\n\nUse /start to return to menu.');
    return;
  }
}

// --- Text Handler (for custom amount, address, memo) ---

export async function handleRequestText(ctx: BotContext): Promise<boolean> {
  const state = ctx.session.requestState;
  if (!state) return false;

  const text = ctx.message?.text?.trim();
  if (!text) return false;

  if (state.step === 'amount') {
    // Delete user's text message to keep chat clean
    try { await ctx.deleteMessage(); } catch {}
    await handleAmountInput(ctx, text);
    return true;
  }

  if (state.step === 'address') {
    try { await ctx.deleteMessage(); } catch {}
    state.address = text;
    state.step = 'memo';
    await showMemoStep(ctx);
    return true;
  }

  if (state.step === 'memo') {
    try { await ctx.deleteMessage(); } catch {}
    state.memo = text;
    state.step = 'done';
    await generateAndShowLink(ctx);
    return true;
  }

  return false;
}

// --- Internal Steps ---

async function handleAmountInput(ctx: BotContext, amount: string): Promise<void> {
  const state = ctx.session.requestState;
  if (!state) return;

  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    // Don't change state — let them retry
    return;
  }

  state.amount = amount;
  state.step = 'address';

  // Check for saved addresses on this chain
  const from = ctx.from;
  if (from) {
    try {
      const user = await getUser(from.id);
      if (user) {
        const saved = await getAddresses(user.id);
        const chainAddresses = saved.filter(
          a => a.chain.toLowerCase() === (state.chains?.find(c => c.id === state.chain)?.name ?? '').toLowerCase()
        );

        if (chainAddresses.length > 0) {
          const chainName = state.chains?.find(c => c.id === state.chain)?.name ?? state.chain;
          const kb = new InlineKeyboard();
          for (const entry of chainAddresses) {
            const shortAddr = entry.address.length > 20
              ? `${entry.address.slice(0, 8)}...${entry.address.slice(-6)}`
              : entry.address;
            kb.text(`📒 ${entry.label} (${shortAddr})`, `req_addr:${entry.address}`).row();
          }
          kb.text('◂ Back', 'req_back_tokens').row();

          await editMessage(
            ctx,
            `${reqStepHeader('address')}\n\n🔗 *${chainName}* · 💰 *${state.amount} ${displaySymbol(state.token!)}*\n\nSelect a saved address or type your receiving address:`,
            kb,
          );
          return;
        }
      }
    } catch {}
  }

  // No saved addresses — just ask for input
  const chainName = state.chains?.find(c => c.id === state.chain)?.name ?? state.chain;
  const kb = new InlineKeyboard().text('◂ Back', 'req_back_tokens').row();
  await editMessage(
    ctx,
    `${reqStepHeader('address')}\n\n🔗 *${chainName}* · 💰 *${state.amount} ${displaySymbol(state.token!)}*\n\nType your receiving address on ${chainName}:`,
    kb,
  );
}

async function showMemoStep(ctx: BotContext): Promise<void> {
  const state = ctx.session.requestState;
  if (!state) return;

  const chainName = state.chains?.find(c => c.id === state.chain)?.name ?? state.chain;
  const shortAddr = state.address && state.address.length > 20
    ? `${state.address.slice(0, 8)}...${state.address.slice(-6)}`
    : state.address;

  const kb = new InlineKeyboard()
    .text('Skip — no memo', 'req_skip_memo')
    .row()
    .text('◂ Back', 'req_back_tokens');

  await editMessage(
    ctx,
    `${reqStepHeader('memo')}\n\n🔗 *${chainName}* · 💰 *${state.amount} ${displaySymbol(state.token!)}*\n📬 *${shortAddr}*\n\nAdd a memo/note? (e.g. "For dinner" or "Invoice #42")\n\nOr tap Skip:`,
    kb,
  );
}

async function generateAndShowLink(ctx: BotContext): Promise<void> {
  const state = ctx.session.requestState;
  if (!state || !state.chain || !state.token || !state.amount || !state.address) return;

  const chainName = state.chains?.find(c => c.id === state.chain)?.name ?? state.chain;
  const name = ctx.from?.first_name ?? ctx.from?.username;

  const normalizedToken = displaySymbol(state.token);

  const payData = {
    recipient: state.address,
    toChain: state.chain,
    toToken: normalizedToken,
    amount: state.amount,
    memo: state.memo,
    name: name,
  };

  // Try short URL first, fall back to encoded long URL
  const url = await shortenPaymentUrl(payData)
    ?? generatePaymentUrl({ ...payData, createdAt: Date.now() });

  const shortAddr = state.address.length > 20
    ? `${state.address.slice(0, 8)}...${state.address.slice(-6)}`
    : state.address;

  const lines = [
    '✅ *Payment Request Created*\n',
    `🔗 Chain: *${chainName}*`,
    `💰 Amount: *${state.amount} ${displaySymbol(state.token!)}*`,
    `📬 To: \`${shortAddr}\``,
  ];
  if (state.memo) {
    lines.push(`📝 Memo: _${state.memo}_`);
  }
  lines.push('');
  lines.push(`Share this link — anyone can pay from any chain:\n${url}`);

  const kb = new InlineKeyboard()
    .text('💸 New Request', 'action:request')
    .text('« Menu', 'menu:main');

  await editMessage(ctx, lines.join('\n'), kb);

  // Clear state
  ctx.session.requestState = undefined;
}
