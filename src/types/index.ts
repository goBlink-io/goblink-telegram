import type { Context, SessionFlavor } from 'grammy';
import type { ChainId, ChainConfig, Token } from '@urban-blazer/goblink-sdk';

export interface SessionData {
  transferState?: TransferState;
  requestState?: RequestState;
  repeatTransfers?: TgTransfer[];
}

export type TransferStep =
  | 'src_chain'
  | 'src_token'
  | 'dst_chain'
  | 'dst_token'
  | 'amount'
  | 'recipient'
  | 'refund'
  | 'confirm'
  | 'done';

export interface TransferState {
  step: TransferStep;
  srcChain?: ChainId;
  srcToken?: string;
  dstChain?: ChainId;
  dstToken?: string;
  amount?: string;
  recipient?: string;
  refundAddress?: string;
  page: number;
  chains?: ChainConfig[];
  tokens?: Token[];
  lastMessageId?: number;
}

export type RequestStep =
  | 'chain'
  | 'token'
  | 'amount'
  | 'address'
  | 'memo'
  | 'done';

export interface RequestState {
  step: RequestStep;
  chain?: ChainId;
  token?: string;
  amount?: string;
  address?: string;
  memo?: string;
  page: number;
  chains?: ChainConfig[];
  tokens?: Token[];
  lastMessageId?: number;
}

export type BotContext = Context & SessionFlavor<SessionData>;

export interface TgUser {
  id: string;
  telegram_id: number;
  telegram_username?: string;
  first_name?: string;
  created_at: string;
  last_active_at: string;
}

export interface CreateTransferInput {
  user_id: string;
  chat_id: number;
  message_id?: number;
  source_chain: string;
  source_token: string;
  dest_chain: string;
  dest_token: string;
  amount: string;
  recipient: string;
  deposit_address: string;
  status: string;
}

export interface TgTransfer {
  id: string;
  user_id: string;
  chat_id: number;
  message_id?: number;
  source_chain: string;
  source_token: string;
  dest_chain: string;
  dest_token: string;
  amount: string;
  recipient: string;
  deposit_address: string;
  status: string;
  tx_hash?: string;
  explorer_url?: string;
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
