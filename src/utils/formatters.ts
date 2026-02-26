import type { FeeInfo, QuoteResponse } from '@urban-blazer/goblink-sdk';

// --- MarkdownV2 escaping ---

const MD2_SPECIAL = /([_*[\]()~`>#+\-=|{}.!\\])/g;

export function escMd2(text: string): string {
  return text.replace(MD2_SPECIAL, '\\$1');
}

// --- Amount formatting ---

export function formatAmount(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  if (num >= 1) return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return num.toFixed(8).replace(/0+$/, '').replace(/\.$/, '.0');
}

// --- Address truncation ---

export function truncateAddr(address: string, start = 6, end = 4): string {
  if (address.length <= start + end + 3) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

// --- Fee formatting ---

export function formatFee(fee: FeeInfo, amountUsd?: number): string {
  const pct = `${fee.percent}%`;
  if (amountUsd !== undefined) {
    const feeUsd = (amountUsd * fee.bps) / 10_000;
    return `Fee: ${pct} ($${feeUsd.toFixed(2)})`;
  }
  return `Fee: ${pct}`;
}

// --- Time estimate ---

export function formatTime(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const mins = Math.round(seconds / 60);
  return `~${mins} min`;
}

// --- Status emoji ---

export function statusEmoji(status: string): string {
  switch (status) {
    case 'PENDING':
      return '⏳';
    case 'DEPOSITED':
      return '📥';
    case 'PROCESSING':
      return '⚙️';
    case 'SUCCESS':
      return '✅';
    case 'FAILED':
      return '❌';
    case 'REFUNDED':
      return '↩️';
    case 'EXPIRED':
      return '⏰';
    default:
      return '❓';
  }
}

// --- Transfer summary (plain text, no markdown) ---

export function formatTransferSummary(
  amount: string,
  sourceToken: string,
  destToken: string,
  sourceChain: string,
  destChain: string,
  recipient: string,
  refundAddress: string,
  quote: QuoteResponse,
): string {
  const lines = [
    `📦 Transfer Summary`,
    ``,
    `Send: ${formatAmount(amount)} ${sourceToken} (${sourceChain})`,
    `Receive: ~${formatAmount(quote.amountOut)} ${destToken} (${destChain})`,
    `Rate: 1 ${sourceToken} = ${quote.rate} ${destToken}`,
    `${formatFee(quote.fee)}`,
    `Est. time: ${formatTime(quote.estimatedTime)}`,
    ``,
    `To: ${truncateAddr(recipient)}`,
    `Refund: ${truncateAddr(refundAddress)}`,
  ];
  return lines.join('\n');
}

// --- Deposit instructions ---

export function formatDepositMessage(
  depositAddress: string,
  depositAmount: string,
  sourceToken: string,
  sourceChain: string,
  expiresAt: string,
): string {
  const expiry = new Date(expiresAt);
  const mins = Math.max(0, Math.round((expiry.getTime() - Date.now()) / 60_000));
  const lines = [
    `✅ Transfer created!`,
    ``,
    `Send exactly:`,
    `\`${depositAmount} ${sourceToken}\``,
    ``,
    `To this ${sourceChain} address:`,
    `\`${depositAddress}\``,
    ``,
    `⏰ Expires in ~${mins} minutes`,
    ``,
    `I'll notify you when the transfer completes.`,
  ];
  return lines.join('\n');
}

// --- History entry ---

export function formatHistoryEntry(
  amount: string,
  sourceToken: string,
  sourceChain: string,
  destChain: string,
  status: string,
  createdAt: string,
  txHash?: string,
): string {
  const date = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const emoji = statusEmoji(status);
  let line = `${emoji} ${formatAmount(amount)} ${sourceToken} (${sourceChain} → ${destChain}) — ${status}`;
  line += `\n   ${date}`;
  if (txHash) {
    line += ` • TX: ${truncateAddr(txHash)}`;
  }
  return line;
}
