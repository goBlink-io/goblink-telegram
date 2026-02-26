import type { Context } from 'grammy';
import type { ConversationFlavor } from '@grammyjs/conversations';
import type { ChainId, TransferStatusValue } from '@urban-blazer/goblink-sdk';

export interface SessionData {
  transferState?: TransferState;
}

export interface TransferState {
  step: TransferStep;
  sourceChain?: ChainId;
  sourceToken?: string;
  destChain?: ChainId;
  destToken?: string;
  amount?: string;
  recipient?: string;
  refundAddress?: string;
}

export type TransferStep =
  | 'source_chain'
  | 'source_token'
  | 'dest_chain'
  | 'dest_token'
  | 'amount'
  | 'recipient'
  | 'refund_address'
  | 'confirm';

export type BotContext = ConversationFlavor<Context>;

export interface TgUser {
  id: string;
  telegram_id: number;
  username?: string;
  first_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTransferInput {
  user_id: string;
  telegram_id: number;
  chat_id: number;
  message_id?: number;
  source_chain: string;
  source_token: string;
  dest_chain: string;
  dest_token: string;
  amount: string;
  recipient: string;
  refund_address: string;
  deposit_address: string;
  deposit_amount: string;
  status: TransferStatusValue;
  expires_at: string;
  transfer_id: string;
}

export interface TgTransfer {
  id: string;
  user_id: string;
  telegram_id: number;
  chat_id: number;
  message_id?: number;
  source_chain: string;
  source_token: string;
  dest_chain: string;
  dest_token: string;
  amount: string;
  recipient: string;
  refund_address: string;
  deposit_address: string;
  deposit_amount: string;
  status: TransferStatusValue;
  tx_hash?: string;
  explorer_url?: string;
  transfer_id: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface TgAddressEntry {
  id: string;
  user_id: string;
  label: string;
  chain: string;
  address: string;
  created_at: string;
}
