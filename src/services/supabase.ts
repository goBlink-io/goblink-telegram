import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import type {
  TgUser,
  TgTransfer,
  TgAddressEntry,
  CreateTransferInput,
} from '../types/index.js';

let client: SupabaseClient;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceKey);
  }
  return client;
}

// --- Users ---

export async function createOrUpdateUser(
  telegramId: number,
  username?: string,
  firstName?: string,
): Promise<TgUser> {
  const db = getSupabase();
  const { data, error } = await db
    .from('tg_users')
    .upsert(
      {
        telegram_id: telegramId,
        username,
        first_name: firstName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'telegram_id' },
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert user: ${error.message}`);
  return data as TgUser;
}

export async function getUser(telegramId: number): Promise<TgUser | null> {
  const db = getSupabase();
  const { data, error } = await db
    .from('tg_users')
    .select()
    .eq('telegram_id', telegramId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get user: ${error.message}`);
  }
  return (data as TgUser) ?? null;
}

// --- Transfers ---

export async function createTransfer(
  input: CreateTransferInput,
): Promise<TgTransfer> {
  const db = getSupabase();
  const { data, error } = await db
    .from('tg_transfers')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(`Failed to create transfer: ${error.message}`);
  return data as TgTransfer;
}

export async function updateTransferStatus(
  id: string,
  status: string,
  txHash?: string,
  explorerUrl?: string,
): Promise<void> {
  const db = getSupabase();
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (txHash) update['tx_hash'] = txHash;
  if (explorerUrl) update['explorer_url'] = explorerUrl;

  const { error } = await db.from('tg_transfers').update(update).eq('id', id);
  if (error)
    throw new Error(`Failed to update transfer status: ${error.message}`);
}

export async function getActiveTransfers(): Promise<TgTransfer[]> {
  const db = getSupabase();
  const { data, error } = await db
    .from('tg_transfers')
    .select()
    .in('status', ['PENDING', 'DEPOSITED', 'PROCESSING']);

  if (error)
    throw new Error(`Failed to get active transfers: ${error.message}`);
  return (data as TgTransfer[]) ?? [];
}

export async function getUserTransfers(
  telegramId: number,
  limit = 10,
): Promise<TgTransfer[]> {
  const db = getSupabase();
  const { data, error } = await db
    .from('tg_transfers')
    .select()
    .eq('telegram_id', telegramId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error)
    throw new Error(`Failed to get user transfers: ${error.message}`);
  return (data as TgTransfer[]) ?? [];
}

// --- Address Book (Phase 2 stubs) ---

export async function saveAddress(
  _userId: string,
  _label: string,
  _chain: string,
  _address: string,
): Promise<void> {
  // Phase 2
}

export async function getAddresses(
  _userId: string,
): Promise<TgAddressEntry[]> {
  // Phase 2
  return [];
}
