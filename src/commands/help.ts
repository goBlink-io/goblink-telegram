import type { BotContext } from '../types/index.js';
import { mainMenuKeyboard } from '../utils/keyboards.js';

export async function helpCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(
    `❓ *goBlink Bot — Help*\n\n` +
    `*Commands:*\n` +
    `/transfer — Start a cross\\-chain transfer\n` +
    `/request — Create a payment request link\n` +
    `/price — View token prices\n` +
    `/price ETH — Look up a specific token\n` +
    `/history — View your transfer history\n` +
    `/addressbook — View saved addresses\n` +
    `/save <label> <chain> <address> — Save an address\n` +
    `/default <chain> <token> — Set default source\n` +
    `/cancel — Cancel current flow\n` +
    `/help — This message\n\n` +
    `*How transfers work:*\n` +
    `1\\. Pick where your tokens are \\(or skip with /default\\)\n` +
    `2\\. Pick where they should go\n` +
    `3\\. Enter amount & recipient\n` +
    `4\\. Confirm — you'll get a deposit address\n` +
    `5\\. Send tokens from any wallet\n` +
    `6\\. Bot notifies you when it's done\n\n` +
    `💡 *Tip:* Type a token name during selection to search \\(e\\.g\\. "usdc"\\)\n\n` +
    `*Supported:* 12 chains, 65\\+ tokens\n` +
    `*Fees:* 0\\.35% under $5K, 0\\.10% $5K\\-$50K, 0\\.05% over $50K\n\n` +
    `[goblink\\.io](https://goblink.io) — Move value anywhere, instantly\\.`,
    { parse_mode: 'MarkdownV2', reply_markup: mainMenuKeyboard() },
  );
}
