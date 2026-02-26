import type { BotContext } from '../types/index.js';
import { startTransferFlow } from '../conversations/transfer.js';

export async function transferCommand(ctx: BotContext): Promise<void> {
  await startTransferFlow(ctx);
}
