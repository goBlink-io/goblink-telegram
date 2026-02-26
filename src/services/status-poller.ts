import type { Bot } from 'grammy';
import type { BotContext } from '../types/index.js';
import { getSDK } from './goblink.js';
import { getActiveTransfers, updateTransferStatus } from './supabase.js';
import { statusEmoji, truncateAddr } from '../utils/formatters.js';
import { transferStatusKeyboard } from '../utils/keyboards.js';

const POLL_INTERVAL_MS = 15_000;
let timer: ReturnType<typeof setInterval> | null = null;

export function startStatusPoller(bot: Bot<BotContext>): void {
  if (timer) return;

  timer = setInterval(() => {
    pollStatuses(bot).catch((err) => {
      console.error('Status poller error:', err);
    });
  }, POLL_INTERVAL_MS);

  console.log('Status poller started (every 15s)');
}

export function stopStatusPoller(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('Status poller stopped');
  }
}

async function pollStatuses(bot: Bot<BotContext>): Promise<void> {
  const sdk = getSDK();
  let transfers;
  try {
    transfers = await getActiveTransfers();
  } catch (err) {
    console.error('Failed to fetch active transfers:', err);
    return;
  }

  for (const transfer of transfers) {
    try {
      const status = await sdk.getTransferStatus(transfer.deposit_address);

      if (status.status === transfer.status) continue;

      // Status changed — update database
      await updateTransferStatus(
        transfer.id,
        status.status,
        status.txHash,
        status.explorerUrl,
      );

      console.log(
        `Transfer ${transfer.id} status: ${transfer.status} → ${status.status}`,
      );

      // Notify user
      const emoji = statusEmoji(status.status);

      if (status.status === 'SUCCESS') {
        let msg = `${emoji} Transfer complete!\n\n`;
        msg += `${transfer.amount} ${transfer.source_token} (${transfer.source_chain}) → ${transfer.dest_token} (${transfer.dest_chain})`;
        if (status.explorerUrl) {
          msg += `\n\n🔗 Explorer: ${status.explorerUrl}`;
        } else if (status.txHash) {
          msg += `\n\nTX: ${truncateAddr(status.txHash)}`;
        }

        await bot.api.sendMessage(transfer.chat_id, msg, {
          reply_markup: transferStatusKeyboard(),
        });
      } else if (
        status.status === 'FAILED' ||
        status.status === 'REFUNDED' ||
        status.status === 'EXPIRED'
      ) {
        const label =
          status.status === 'REFUNDED'
            ? 'Transfer refunded'
            : status.status === 'EXPIRED'
              ? 'Transfer expired'
              : 'Transfer failed';

        let msg = `${emoji} ${label}.\n\n`;
        msg += `${transfer.amount} ${transfer.source_token} (${transfer.source_chain} → ${transfer.dest_chain})`;
        if (status.status === 'REFUNDED') {
          msg += `\n\nFunds have been returned to your refund address.`;
        }

        await bot.api.sendMessage(transfer.chat_id, msg, {
          reply_markup: transferStatusKeyboard(),
        });
      } else {
        // PROCESSING or DEPOSITED — edit original message if possible
        if (transfer.message_id) {
          try {
            await bot.api.editMessageText(
              transfer.chat_id,
              transfer.message_id,
              `${emoji} Status: ${status.status}\n\nYour transfer is being processed...`,
            );
          } catch {
            // Message might be too old to edit
          }
        }
      }
    } catch (err) {
      console.error(
        `Failed to poll status for transfer ${transfer.id}:`,
        err,
      );
    }
  }
}
