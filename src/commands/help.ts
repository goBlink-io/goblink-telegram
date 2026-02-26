import type { BotContext } from '../types/index.js';

const HELP_TEXT = `❓ goBlink Help

How it works:
1. Pick source chain & token
2. Pick destination chain & token
3. Enter amount
4. Enter recipient address
5. Confirm & deposit
6. Done! We notify you when complete.

Commands:
/start — Main menu
/transfer — Start a new transfer
/history — View recent transfers
/price — Token price lookup (coming soon)
/help — This message

Need support? Contact @goBlink_support`;

export async function helpCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(HELP_TEXT);
}
