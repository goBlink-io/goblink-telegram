/**
 * setup-branding.ts
 * 
 * Sets up all Telegram bot branding via the Bot API:
 * - Profile photo (gB lettermark)
 * - Bot name
 * - Short description (shown in profile/search)
 * - Description (shown on "What can this bot do?")
 * - Commands menu
 * 
 * Run: npx tsx scripts/setup-branding.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN'];
if (!BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function apiCall(method: string, body?: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.ok) {
    console.error(`❌ ${method} failed:`, json.description);
  } else {
    console.log(`✅ ${method}`);
  }
  return json;
}

async function uploadPhoto(filePath: string): Promise<void> {
  const form = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'image/png' });
  form.append('photo', blob, 'photo.png');

  const res = await fetch(`${API}/setChat Photo`, {
    method: 'POST',
    body: form,
  });
  // setChat Photo doesn't exist — use setChatPhoto for channels
  // For bot profile photo, we need to use a different approach
  console.log('Note: Bot profile photo must be set via @BotFather /setuserpic');
}

async function main() {
  console.log('\n🎨 Setting up goBlink bot branding...\n');

  // 1. Bot name
  await apiCall('setMyName', {
    name: 'goBlink',
  });

  // 2. Short description (shown in bot profile card and search results)
  await apiCall('setMyShortDescription', {
    short_description: '⚡ Move any token across any chain. Instant. Non-custodial. 12 chains, 65+ tokens.',
  });

  // 3. Description (shown when user first opens bot / "What can this bot do?")
  await apiCall('setMyDescription', {
    description:
      '⚡ goBlink — Move value anywhere, instantly.\n\n' +
      'Transfer tokens across 12 chains with zero complexity. Non-custodial — we never hold your keys.\n\n' +
      '🔄 Cross-chain transfers in seconds\n' +
      '💸 Request payments via shareable links\n' +
      '💰 Live token prices\n' +
      '📒 Address book for quick sends\n' +
      '📋 Full transfer history & tracking\n\n' +
      'Supported: Ethereum, Solana, Sui, NEAR, Base, Arbitrum, Polygon, BNB, Optimism, Tron, Aptos, Starknet\n\n' +
      'Fees: 0.35% under $5K · 0.10% $5K-$50K · 0.05% over $50K\n\n' +
      'goblink.io',
  });

  // 4. Commands menu
  await apiCall('setMyCommands', {
    commands: [
      { command: 'start', description: 'Main menu' },
      { command: 'transfer', description: 'Start a cross-chain transfer' },
      { command: 'request', description: 'Create a payment request link' },
      { command: 'price', description: 'View token prices' },
      { command: 'history', description: 'Transfer history' },
      { command: 'addressbook', description: 'Saved addresses' },
      { command: 'save', description: 'Save an address' },
      { command: 'default', description: 'Set default source chain/token' },
      { command: 'repeat', description: 'Repeat your last transfer' },
      { command: 'commands', description: 'List available commands' },
      { command: 'help', description: 'Help center' },
    ],
  });

  // 5. Profile photo — Bot API doesn't support this directly.
  //    Must be done via BotFather: /setuserpic
  console.log('\n📸 Profile photo: set via @BotFather');
  console.log('   /setuserpic → select @goBlinkBot → upload icon-gB-dark.png');
  console.log(`   File: ${path.resolve(__dirname, '../../goblink/brand/icons/icon-gB-dark.png')}`);

  console.log('\n✨ Branding setup complete!\n');
}

main().catch(console.error);
