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
        telegram_username: username,
        first_name: firstName,
        last_active_at: new Date().toISOString(),
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
  userId: string,
  limit = 10,
): Promise<TgTransfer[]> {
  const db = getSupabase();
  const { data, error } = await db
    .from('tg_transfers')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error)
    throw new Error(`Failed to get user transfers: ${error.message}`);
  return (data as TgTransfer[]) ?? [];
}

// --- Address Book ---

export async function saveAddress(
  userId: string,
  label: string,
  chain: string,
  address: string,
): Promise<void> {
  const db = getSupabase();
  const { error } = await db.from('tg_address_book').insert({
    user_id: userId,
    label,
    chain,
    address,
  });
  if (error) throw new Error(`Failed to save address: ${error.message}`);
}

export async function getAddresses(
  userId: string,
): Promise<TgAddressEntry[]> {
  const db = getSupabase();
  const { data, error } = await db
    .from('tg_address_book')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to get addresses: ${error.message}`);
  return (data as TgAddressEntry[]) ?? [];
}

export async function deleteAddress(id: string, userId?: string): Promise<void> {
  const db = getSupabase();
  let query = db.from('tg_address_book').delete().eq('id', id);
  if (userId) query = query.eq('user_id', userId);
  const { error } = await query;
  if (error) throw new Error(`Failed to delete address: ${error.message}`);
}

// --- Referrals ---

function generateReferralCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Ensure user has a referral code, generate one if missing */
export async function ensureReferralCode(userId: string): Promise<string> {
  const db = getSupabase();

  // Check if already has one
  const { data: user } = await db.from('tg_users').select('referral_code').eq('id', userId).single();
  if (user?.referral_code) return user.referral_code;

  // Generate and save (retry on collision)
  for (let i = 0; i < 3; i++) {
    const code = generateReferralCode();
    const { error } = await db.from('tg_users').update({ referral_code: code }).eq('id', userId);
    if (!error) return code;
  }
  throw new Error('Failed to generate referral code');
}

/** Look up a user by referral code */
export async function getUserByReferralCode(code: string): Promise<TgUser | null> {
  const db = getSupabase();
  const { data, error } = await db
    .from('tg_users')
    .select()
    .eq('referral_code', code.toLowerCase())
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(`Referral lookup failed: ${error.message}`);
  return (data as TgUser) ?? null;
}

/** Set referred_by on a user (only if not already set) */
export async function setReferredBy(userId: string, referrerId: string): Promise<boolean> {
  if (userId === referrerId) return false; // Can't refer yourself
  const db = getSupabase();
  const { data } = await db.from('tg_users').select('referred_by').eq('id', userId).single();
  if (data?.referred_by) return false; // Already referred

  const { error } = await db.from('tg_users').update({ referred_by: referrerId }).eq('id', userId);
  return !error;
}

/** Get referral stats for a user */
export async function getReferralStats(userId: string): Promise<{
  referralCount: number;
  referralVolume: number;
}> {
  const db = getSupabase();

  // Count users referred
  const { count } = await db
    .from('tg_users')
    .select('*', { count: 'exact', head: true })
    .eq('referred_by', userId);

  // Sum transfer volume from referred users
  const { data: referredUsers } = await db
    .from('tg_users')
    .select('id')
    .eq('referred_by', userId);

  let referralVolume = 0;
  if (referredUsers && referredUsers.length > 0) {
    const ids = referredUsers.map(u => u.id);
    const { data: transfers } = await db
      .from('tg_transfers')
      .select('amount')
      .in('user_id', ids)
      .eq('status', 'SUCCESS');

    if (transfers) {
      referralVolume = transfers.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
    }
  }

  return {
    referralCount: count ?? 0,
    referralVolume,
  };
}

// --- User Settings ---

export interface UserDefaults {
  srcChain?: string;
  srcToken?: string;
}

export async function getUserDefaults(telegramId: number): Promise<UserDefaults | null> {
  const user = await getUser(telegramId);
  if (!user) return null;
  const settings = (user as any).settings;
  if (!settings || typeof settings !== 'object') return null;
  return settings.defaults ?? null;
}

export async function setUserDefaults(telegramId: number, defaults: UserDefaults): Promise<void> {
  const db = getSupabase();
  const user = await getUser(telegramId);
  if (!user) return;

  const settings = typeof (user as any).settings === 'object' ? { ...(user as any).settings } : {};
  settings.defaults = defaults;

  const { error } = await db.from('tg_users').update({ settings }).eq('id', user.id);
  if (error) throw new Error(`Failed to update user settings: ${error.message}`);
}
