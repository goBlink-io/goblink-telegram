import type { BotContext } from '../types/index.js';
import { mainMenuKeyboard } from '../utils/keyboards.js';

export async function helpCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(
    `❓ *goBlink Bot — Help*\n\n` +
    `*Commands:*\n` +
    `/transfer — Start a cross-chain transfer\n` +
    `/price — View token prices\n` +
    `/price ETH — Look up a specific token\n` +
    `/history — View your transfer history\n` +
    `/addressbook — View saved addresses\n` +
    `/save <label> <chain> <address> — Save an address\n` +
    `/cancel — Cancel current transfer\n` +
    `/help — This message\n\n` +
    `*How transfers work:*\n` +
    `1\\. Pick source chain & token\n` +
    `2\\. Pick destination chain & token\n` +
    `3\\. Enter amount & recipient address\n` +
    `4\\. Confirm — you'll get a deposit address\n` +
    `5\\. Send tokens to that address from any wallet\n` +
    `6\\. Bot notifies you when the transfer completes\n\n` +
    `*Supported:* 12 chains, 65\\+ tokens\n` +
    `*Fees:* 0\\.35% under $5K, 0\\.10% $5K\\-$50K, 0\\.05% over $50K\n\n` +
    `[goblink\\.io](https://goblink.io) — Move value anywhere, instantly\\.`,
    { parse_mode: 'MarkdownV2', reply_markup: mainMenuKeyboard() },
  );
}
