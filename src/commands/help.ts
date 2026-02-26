import type { BotContext } from '../types/index.js';
import { InlineKeyboard } from 'grammy';

// --- Help sections ---

const HELP_OVERVIEW = `❓ *goBlink — Help Center*

Move any token across any chain\\. Non\\-custodial\\. Instant\\.

Pick a topic below:`;

const HELP_COMMANDS = `📋 *All Commands*

*Transfers*
/transfer — Start a cross\\-chain transfer
/request — Create a payment request link
/repeat — Repeat your last transfer
/history — View your recent transfers
/cancel — Cancel the current flow

*Prices & Tokens*
/price — Top token prices
/price ETH — Look up a specific token

*Address Book*
/addressbook — View saved addresses
/save \\<label\\> \\<chain\\> \\<address\\> — Save one

*Settings*
/default \\<chain\\> \\<token\\> — Set default source
/default — View current defaults
/default clear — Reset defaults

*Referrals*
/referral — Your referral link & stats
/invite — Same as /referral

*Info*
/commands — Quick command reference
/help — This help center
/start — Main menu

*Inline Mode*
Type in any chat:
\`@goBlinkBot 100 USDC from ethereum to solana\`
\`@goBlinkBot 100 USDC to solana\`
\`@goBlinkBot 100 USDC\``;

const HELP_TRANSFERS = `🔄 *How Transfers Work*

goBlink moves tokens between any supported chain\\. Here's how:

*Step by step:*
1️⃣ *Source chain & token* — Where are your tokens?
2️⃣ *Destination chain & token* — Where should they go?
3️⃣ *Amount* — Pick a preset or type a custom amount
4️⃣ *Recipient* — The address receiving the tokens
5️⃣ *Refund address* — Fallback if something fails
6️⃣ *Confirm* — Review the quote and approve

After confirming, you get a *deposit address*\\. Send the exact amount from any wallet\\. The bot tracks it and notifies you when complete\\.

*⏱️ Speed shortcuts:*
• /default solana USDC — skip steps 1\\-2 next time
• /repeat — redo your last transfer in one tap
• Type a token name during selection to search \\(e\\.g\\. "usdc"\\)
• Saved addresses auto\\-fill at recipient & refund steps
• Same\\-chain transfers skip the refund step

*📱 Inline mode:*
Type \`@goBlinkBot 100 USDC from ethereum to solana\` in any chat to pre\\-fill both chains and jump straight to entering the recipient\\.

⚠️ *Non\\-custodial* — goBlink never holds your private keys\\. Each transfer creates a unique deposit address that you send to from your own wallet\\.`;

const HELP_REQUESTS = `💸 *Payment Requests*

Create a shareable link so anyone can pay you from any chain\\.

*Steps:*
1️⃣ Pick your receiving chain
2️⃣ Pick the token \\(e\\.g\\. USDC, NEAR, SUI\\)
3️⃣ Enter the amount
4️⃣ Select your receiving address \\(saved or type new\\)
5️⃣ Add an optional memo \\(e\\.g\\. "For dinner"\\)

You get a *goblink\\.io/pay/…* link\\. Anyone who opens it can pay with *any token from any chain* — goBlink handles the conversion\\.

💡 *Use cases:*
• Split a bill — drop the link in a group chat
• Invoice a client — include a memo
• Collect payments — share on social media
• Receive crypto — without sharing your wallet publicly

The link expires after 7 days\\.`;

const HELP_ADDRESSES = `📒 *Address Book*

Save addresses to skip pasting them every time\\.

*Save an address:*
\`/save main solana 7xKp\\.\\.\\.3mNw\`
\`/save cex ethereum 0xABC\\.\\.\\.123\`
\`/save wallet near myname\\.near\`

Format: \`/save <label> <chain> <address>\`

*Manage:*
/addressbook — view all saved addresses with delete buttons

*Auto\\-fill:*
During transfers, saved addresses for the relevant chain appear as quick\\-select buttons\\. Works for both recipient and refund steps\\. One tap instead of copy\\-pasting\\.

*Supported chains for addresses:*
ethereum, solana, sui, near, base, arbitrum, polygon, bnb, optimism, tron, aptos, starknet`;

const HELP_FEES = `💰 *Fees & Pricing*

goBlink charges a small, transparent fee on each transfer:

📊 *Fee tiers:*
• Under $5,000 — *0\\.35%*
• $5,000 – $50,000 — *0\\.10%*
• Over $50,000 — *0\\.05%*

The fee is included in the quote shown before you confirm\\. No hidden charges\\. The exact breakdown \\(swap cost \\+ goBlink fee \\= total\\) is displayed at confirmation\\.

*Gas fees:*
Standard network gas is paid when you send tokens to the deposit address — same as any on\\-chain transaction\\.

/price — Check current token prices
/price ETH — Look up a specific token`;

const HELP_CHAINS = `🔗 *Supported Chains*

goBlink supports *12 chains*:

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

Transfer *any supported token* between *any combination* of these chains\\. Cross\\-chain routing is fully automatic\\.

*65\\+ tokens* available across all chains\\.
Use /price to browse what's available\\.`;

const HELP_REFERRALS = `🔗 *Referrals*

Share goBlink and track who you bring in\\.

*Get your link:*
/referral — shows your unique referral code, shareable link, and stats

*How it works:*
1️⃣ Share your link: \`t\\.me/goBlinkBot?start=ref\\_<code>\`
2️⃣ When someone opens it and starts the bot, they're linked to you
3️⃣ Your /referral stats update: referred users and their transfer volume

*Share easily:*
The /referral command includes a "Share in chat" button that lets you forward your invite to any Telegram chat\\.

💡 Tip: Drop your referral link in group chats, social media, or DMs\\. Every user who starts goBlink through it counts\\.`;

const HELP_GROUPS = `👥 *Group Chats*

Add @goBlinkBot to any Telegram group\\!

*Works in groups:*
• /transfer — full transfer flow
• /request — payment request links
• /price — token prices
• /help — help center
• /commands — quick command reference
• /referral — your referral link

*DM only \\(private data\\):*
• /history — transfer history
• /addressbook — saved addresses
• /save — save an address
• /default — default source settings
• /repeat — repeat last transfer

These redirect you to DM with a single tap\\.

*Privacy:*
Deposit addresses are always sent to your DM — never posted in the group\\. The group just sees "✅ Transfer created\\! Check your DM\\."

*Text input:*
When the bot asks for an address in a group, reply to the bot's message so it can see your response\\.

*Inline mode:*
Works everywhere — type \`@goBlinkBot 100 USDC to solana\` in any chat to share a transfer card\\.`;

const HELP_FAQ = `🤔 *FAQ*

*Is goBlink custodial?*
No\\. We never hold your private keys or funds\\. Each transfer creates a unique deposit address — you send from your own wallet\\.

*What if my transfer fails?*
Tokens are returned to your refund address\\. The bot notifies you of the outcome\\.

*How long do transfers take?*
Usually 30–90 seconds depending on the chains\\. You'll see an estimate before confirming\\.

*Can I cancel after confirming?*
Not after you've sent tokens to the deposit address\\. Before sending — just don't deposit and the address expires\\.

*Why do I need a refund address?*
If the cross\\-chain swap can't complete \\(e\\.g\\. extreme price movement\\), tokens are returned here on the source chain\\.

*Is there a minimum amount?*
No fixed minimum, but very small amounts may not have available routes\\. The bot tells you if no route is found\\.

*Does goBlink work in group chats?*
Yes\\. Add @goBlinkBot to any group\\. Transfers, prices, and requests work in groups\\. Private data \\(history, addresses\\) stays in DM\\.

*How does inline mode work?*
Type \`@goBlinkBot 100 USDC from ethereum to solana\` in any chat\\. It creates a shareable card with a deep link\\. Tapping it opens the bot with everything pre\\-filled\\. No funds move until someone actually sends to the deposit address\\.

*How do payment request links work?*
The link encodes what you're requesting\\. Anyone who opens it can pay from any token on any chain — goBlink handles the cross\\-chain conversion\\.

*How do referrals work?*
Use /referral to get your link\\. Share it — when someone starts the bot through your link, they're linked to you\\. Your stats show how many users you've referred and their total transfer volume\\.

*Can I use goBlink from any wallet?*
Yes\\. goBlink doesn't connect to your wallet\\. You just send tokens to a deposit address — works from any wallet, exchange, or app that can send on\\-chain transactions\\.

*Where can I get more help?*
Visit [goblink\\.io](https://goblink.io) or report an issue through the bot\\.`;

// --- Section map ---

const SECTIONS: Record<string, string> = {
  'help:commands': HELP_COMMANDS,
  'help:transfers': HELP_TRANSFERS,
  'help:requests': HELP_REQUESTS,
  'help:addresses': HELP_ADDRESSES,
  'help:fees': HELP_FEES,
  'help:chains': HELP_CHAINS,
  'help:referrals': HELP_REFERRALS,
  'help:groups': HELP_GROUPS,
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
    .text('🎁 Referrals', 'help:referrals')
    .text('👥 Groups', 'help:groups')
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
