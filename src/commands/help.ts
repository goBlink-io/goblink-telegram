import type { BotContext } from '../types/index.js';
import { InlineKeyboard } from 'grammy';
import { mainMenuKeyboard } from '../utils/keyboards.js';

// --- Help sections ---

const HELP_OVERVIEW = `❓ *goBlink — Help Center*

Move any token across any chain\\. Non\\-custodial\\. Instant\\.

Pick a topic below, or browse the commands:`;

const HELP_COMMANDS = `📋 *All Commands*

*Transfers*
/transfer — Start a cross\\-chain transfer
/request — Create a payment request link
/history — View your recent transfers
/cancel — Cancel the current flow

*Prices & Tokens*
/price — Top token prices
/price ETH — Look up a specific token

*Address Book*
/addressbook — View saved addresses
/save \\<label\\> \\<chain\\> \\<address\\> — Save one

*Quick Actions*
/repeat — Repeat your last transfer
/default \\<chain\\> \\<token\\> — Set default source
/default clear — Reset defaults

*Inline Mode*
Type \`@goBlinkBot 100 USDC to solana\` in any chat to share a transfer link\\.

/help — This help center
/start — Main menu`;

const HELP_TRANSFERS = `🔄 *How Transfers Work*

goBlink moves tokens between any supported chain\\. Here's how:

*Step by step:*
1️⃣ *Choose source* — Where are your tokens now?
2️⃣ *Choose destination* — Where should they go?
3️⃣ *Amount* — How much to send \\(pick a preset or type custom\\)
4️⃣ *Recipient* — The address that receives the tokens
5️⃣ *Refund address* — Where to return tokens if something fails
6️⃣ *Confirm* — Review the quote and approve

After confirming, you'll get a *deposit address*\\. Send the exact amount from any wallet\\. The bot tracks the transfer and notifies you when it's complete\\.

💡 *Tips:*
• Type a token name to search \\(e\\.g\\. "usdc"\\) instead of scrolling
• Use /default to skip the first 2 steps
• /repeat re\\-does your last transfer in one tap
• Save addresses with /save so you don't retype them
• Same\\-chain transfers auto\\-set the refund address
• Use inline mode: \`@goBlinkBot 100 USDC to solana\` in any chat

⚠️ *goBlink is non\\-custodial* — we never hold your private keys\\. Each transfer generates a unique deposit address\\.`;

const HELP_REQUESTS = `💸 *Payment Requests*

Create a shareable link so anyone can pay you from any chain\\.

*How it works:*
1️⃣ Pick the chain you want to receive on
2️⃣ Pick the token \\(e\\.g\\. USDC, NEAR, SUI\\)
3️⃣ Enter the amount
4️⃣ Select your receiving address \\(or type one\\)
5️⃣ Add an optional memo \\(e\\.g\\. "For dinner"\\)

You'll get a short *goblink\\.io/pay/…* link\\. Anyone who opens it can pay with *any token from any chain* — the recipient \\(you\\) gets exactly what you requested\\.

💡 *Use cases:*
• Split a bill — send the link in a group chat
• Invoice a client — include a memo
• Collect payments — share on social media

The link expires after 7 days\\.`;

const HELP_ADDRESSES = `📒 *Address Book*

Save addresses so you don't have to paste them every time\\.

*Save:*
\`/save main solana 7xKp\\.\\.\\.3mNw\`
\`/save cex ethereum 0xABC\\.\\.\\.123\`
\`/save wallet near myname\\.near\`

*View & delete:*
/addressbook — lists all saved addresses with delete buttons

*Auto\\-fill:*
When you reach the recipient or refund step, saved addresses for that chain appear as quick\\-select buttons\\. One tap instead of pasting\\.

*Supported chains:*
ethereum, solana, sui, near, base, arbitrum, polygon, bnb, optimism, tron, aptos, starknet`;

const HELP_FEES = `💰 *Fees & Pricing*

goBlink charges a small fee on each transfer:

📊 *Fee tiers:*
• Under $5,000 — *0\\.35%*
• $5,000 \\- $50,000 — *0\\.10%*
• Over $50,000 — *0\\.05%*

Minimum fee floor: 0\\.05%

The fee is included in the quote you see before confirming\\. No hidden charges\\. The exact breakdown \\(swap cost \\+ goBlink fee \\= total\\) is shown at confirmation\\.

Network gas fees are paid by you when sending to the deposit address \\(standard chain gas\\)\\.

/price — Check current token prices`;

const HELP_CHAINS = `🔗 *Supported Chains*

goBlink supports 12 chains:

• Aptos
• Arbitrum
• Base
• BNB Chain
• Ethereum
• NEAR
• Optimism
• Polygon
• Solana
• Starknet
• Sui
• Tron

You can transfer *any supported token* between *any combination* of these chains\\. The cross\\-chain routing is handled automatically\\.

65\\+ tokens available across all chains\\.
Use /price to see what's available\\.`;

const HELP_FAQ = `🤔 *FAQ*

*Is goBlink custodial?*
No\\. We never hold your private keys or funds\\. Each transfer creates a unique deposit address — you send from your own wallet\\.

*What if my transfer fails?*
Tokens are returned to your refund address\\. The bot will notify you of the status\\.

*How long do transfers take?*
Usually 30\\-90 seconds depending on the chains involved\\. You'll see an estimate before confirming\\.

*Can I cancel after confirming?*
Not after you've sent tokens to the deposit address\\. Before sending — just don't deposit and the address expires\\.

*Why do I need a refund address?*
If the cross\\-chain swap can't complete \\(e\\.g\\. extreme price movement\\), tokens are returned to this address on the source chain\\.

*Is there a minimum amount?*
There's no fixed minimum, but very small amounts may not have available routes\\. The bot will tell you if no route is found\\.

*Does goBlink work in group chats?*
Yes\\! Add @goBlinkBot to any group\\. Transfers, prices, help, and payment requests work in groups\\. Deposit addresses are sent to your DM for privacy\\. Private commands \\(history, addresses, settings\\) redirect to DM\\.

*How do payment request links work?*
The link encodes what you're requesting\\. Anyone who opens it can pay from any token on any chain — the protocol handles the conversion\\.

*Where can I get more help?*
Visit [goblink\\.io](https://goblink.io) or reach out via the bot's Report an Issue option\\.`;

// --- Section map ---

const SECTIONS: Record<string, string> = {
  'help:commands': HELP_COMMANDS,
  'help:transfers': HELP_TRANSFERS,
  'help:requests': HELP_REQUESTS,
  'help:addresses': HELP_ADDRESSES,
  'help:fees': HELP_FEES,
  'help:chains': HELP_CHAINS,
  'help:faq': HELP_FAQ,
};

function helpMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 Commands', 'help:commands')
    .text('🔄 Transfers', 'help:transfers')
    .row()
    .text('💸 Requests', 'help:requests')
    .text('📒 Addresses', 'help:addresses')
    .row()
    .text('💰 Fees', 'help:fees')
    .text('🔗 Chains', 'help:chains')
    .row()
    .text('🤔 FAQ', 'help:faq')
    .row()
    .text('« Back to Menu', 'menu:main');
}

function sectionBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('◂ Help Topics', 'help:overview')
    .text('« Menu', 'menu:main');
}

/**
 * /help — show help center overview
 */
export async function helpCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(HELP_OVERVIEW, {
    parse_mode: 'MarkdownV2',
    reply_markup: helpMenuKeyboard(),
  });
}

/**
 * Handle help section callbacks
 */
export async function handleHelpCallback(ctx: BotContext, data: string): Promise<void> {
  try { await ctx.answerCallbackQuery(); } catch {}

  if (data === 'help:overview') {
    await ctx.reply(HELP_OVERVIEW, {
      parse_mode: 'MarkdownV2',
      reply_markup: helpMenuKeyboard(),
    });
    return;
  }

  const content = SECTIONS[data];
  if (content) {
    await ctx.reply(content, {
      parse_mode: 'MarkdownV2',
      reply_markup: sectionBackKeyboard(),
    });
  }
}
