# goBlink Telegram Bot — Build Specification

You are building a Telegram bot for goBlink, a cross-chain token transfer platform.
The bot lets users do cross-chain transfers directly in Telegram — no website needed.

## CRITICAL RULES

1. **Use `@urban-blazer/goblink-sdk`** for ALL token, quote, transfer, validation, and fee logic. Do NOT duplicate SDK functionality.
2. **NO references to NEAR, 1Click, Intents, Defuse, NEP-141** in any user-facing messages, logs, or code comments visible to users.
3. **grammY framework** — not telegraf, not node-telegram-bot-api.
4. **TypeScript strict mode** throughout.
5. The SDK is published on GitHub Packages. The `.npmrc` is already configured in this repo.

## Package Info

- **Name:** `goblink-telegram`
- **Runtime:** Node.js 22+, TypeScript
- **Framework:** grammY (https://grammy.dev/)
- **Database:** Supabase (Postgres)
- **Process manager:** PM2

## Architecture

The bot is a long-running Node.js process that receives Telegram updates via webhook (or long polling for dev).
It consumes `@urban-blazer/goblink-sdk` for all cross-chain transfer logic.

## Project Structure

```
src/
├── bot.ts                    # Bot init, middleware registration, error handling
├── config.ts                 # Environment variables, constants
├── index.ts                  # Entry point — start bot (webhook or polling based on NODE_ENV)
├── conversations/
│   └── transfer.ts           # Transfer wizard conversation (grammY conversations plugin)
├── commands/
│   ├── start.ts              # /start — main menu with inline keyboard
│   ├── transfer.ts           # /transfer — alias to start transfer wizard
│   ├── history.ts            # /history — show recent transfers
│   ├── price.ts              # /price <token> — quick price lookup
│   └── help.ts               # /help — usage guide
├── callbacks/
│   └── menu.ts               # Callback query handlers for inline keyboard buttons
├── services/
│   ├── goblink.ts            # SDK client singleton + helper methods
│   ├── status-poller.ts      # Background poller for active transfer statuses
│   └── supabase.ts           # Database operations (users, transfers, address book)
├── utils/
│   ├── keyboards.ts          # Inline keyboard builders (chain select, token select, confirm, etc.)
│   ├── formatters.ts         # Message text formatting (amounts, addresses, summaries)
│   └── rate-limiter.ts       # Per-user rate limiting
└── types/
    └── index.ts              # Shared types (SessionData, TransferState, etc.)
```

## Dependencies

```json
{
  "dependencies": {
    "@urban-blazer/goblink-sdk": "^0.1.0",
    "grammy": "^1.30.0",
    "@grammyjs/conversations": "^2.0.0",
    "@grammyjs/runner": "^2.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.19.0",
    "@types/node": "^22.0.0",
    "vitest": "^1.6.0"
  }
}
```

## npm Registry Configuration

Create `.npmrc` in the project root:
```
@urban-blazer:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

When running `npm install`, ensure `GITHUB_TOKEN` environment variable is set. Get it via `gh auth token`.

## Environment Variables (.env.example)

```env
# Telegram
TELEGRAM_BOT_TOKEN=           # From @BotFather
TELEGRAM_WEBHOOK_URL=         # https://tgbot.goblink.io/webhook (production only)
TELEGRAM_WEBHOOK_SECRET=      # Random string for webhook verification

# Supabase
SUPABASE_URL=                 # Supabase project URL
SUPABASE_SERVICE_KEY=         # Server-side service role key

# App
NODE_ENV=development          # development = long polling, production = webhook
LOG_LEVEL=info

# GitHub Packages (for SDK install)
GITHUB_TOKEN=                 # gh auth token
```

## Bot Initialization (src/bot.ts)

```typescript
import { Bot, session, Context } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import type { SessionData } from './types';

// Create bot with session + conversations
// Session stores: current transfer state, user preferences
// Use in-memory session for MVP (add Supabase adapter later for persistence)

// Middleware order:
// 1. Error handler (catch-all)
// 2. Rate limiter
// 3. Session
// 4. Conversations plugin
// 5. Transfer conversation registration
// 6. Command handlers
// 7. Callback query handlers
```

## Transfer Wizard (src/conversations/transfer.ts)

This is the core feature. Uses grammY conversations plugin for multi-step flow.

### Flow Steps:
1. **Select source chain** — inline keyboard with chain buttons (paginated, 9 per page + More/Back)
2. **Select source token** — filtered by selected chain
3. **Select destination chain** — exclude source chain from options
4. **Select destination token** — filtered by dest chain
5. **Enter amount** — user types amount or taps preset buttons ($50, $100, $500)
6. **Enter recipient address** — user types address, validate per dest chain using SDK
7. **Enter refund address** — user types refund address for source chain (or "same as recipient" if chains match)
8. **Confirmation screen** — show summary with fee breakdown, ask confirm/cancel
9. **Create transfer** — call SDK `createTransfer()`, show deposit address
10. **Status tracking** — register transfer for background polling

### Key Implementation Details:

- Use `conversation.waitFor('message:text')` for text inputs
- Use `conversation.waitForCallbackQuery()` for button clicks  
- Validate addresses using `sdk.validateAddress(chain, address)`
- Get quotes using `sdk.getQuote()`
- Create transfers using `sdk.createTransfer()`
- Calculate fees using `sdk.calculateFee(amount)`
- On confirmation, save transfer to Supabase `tg_transfers` table
- Show deposit address with copy-friendly formatting (monospace)

### Chain Selection Keyboard:
Show top chains first: Ethereum, Solana, Sui, Base, NEAR, Arbitrum, BNB, Polygon, Optimism
"More ▸" button shows remaining chains
"◂ Back" button goes to previous page/step

### Token Selection Keyboard:
Get tokens for selected chain via `sdk.getTokens({ chain })`
Show native token first, then stablecoins, then others
Limit to 9 per page with pagination

## Commands

### /start
Show welcome message + main menu:
```
⚡ goBlink — Move value anywhere, instantly.

26 chains. 65+ tokens. Zero complexity.

[🔄 New Transfer]  [📋 History]
[💰 Prices]        [❓ Help]
```

### /transfer
Start the transfer wizard conversation.

### /history
Query `tg_transfers` for user's recent transfers (last 10).
Format each as:
```
🔄 100 USDC (ETH → SOL) — ✅ Complete
   Feb 25, 2026 • TX: abc...def
```

### /price <token>
Quick price lookup. Use SDK to get a quote for `token → USDC` to derive price.
```
💰 ETH: $3,245.67
   24h: +2.3%
```
(If price data isn't available from SDK, just show the exchange rate from a $100 USDC quote)

### /help
Show usage guide with all commands and a brief explanation of how transfers work.

## Status Poller (src/services/status-poller.ts)

Background process that runs every 15 seconds:
1. Query `tg_transfers` WHERE status IN ('PENDING', 'DEPOSITED', 'PROCESSING')
2. For each, call `sdk.getTransferStatus(depositAddress)`
3. If status changed:
   a. Update database
   b. Edit the original status message in Telegram (or send new message)
   c. If SUCCESS: show completion message with explorer link
   d. If FAILED/REFUNDED: show error message

### Status Flow:
```
PENDING → (user deposits) → DEPOSITED → PROCESSING → SUCCESS
                                                    → FAILED
                                                    → REFUNDED
```

Use `bot.api.editMessageText()` to update the status message in-place.
Use `bot.api.sendMessage()` for final success/failure notification.

## Database (src/services/supabase.ts)

Initialize Supabase client with service role key.
Implement CRUD operations:

```typescript
// Users
createOrUpdateUser(telegramId: number, username?: string, firstName?: string): Promise<TgUser>
getUser(telegramId: number): Promise<TgUser | null>

// Transfers  
createTransfer(data: CreateTransferInput): Promise<TgTransfer>
updateTransferStatus(id: string, status: string, txHash?: string): Promise<void>
getActiveTransfers(): Promise<TgTransfer[]>  // status IN (PENDING, DEPOSITED, PROCESSING)
getUserTransfers(userId: string, limit?: number): Promise<TgTransfer[]>

// Address Book (Phase 2 — stub the interface)
saveAddress(userId: string, label: string, chain: string, address: string): Promise<void>
getAddresses(userId: string): Promise<TgAddressEntry[]>
```

**IMPORTANT:** Do NOT actually create the Supabase tables or run migrations. Just implement the service layer with the expected table schema. The tables will be created separately via Supabase migrations.

## Rate Limiter (src/utils/rate-limiter.ts)

Simple in-memory rate limiter:
- 5 transfers per hour per user
- 1 quote per 2 seconds per user
- Use Map<telegramId, timestamps[]>

## Message Formatting (src/utils/formatters.ts)

- Format amounts with proper decimals (no scientific notation)
- Truncate addresses: `0x1234...5678`
- Format fees: `Fee: 0.35% ($0.35)`
- Format time estimates: `~2 min`
- Use Telegram markdown v2 for formatting
- Escape special characters for MarkdownV2

## Keyboards (src/utils/keyboards.ts)

Build inline keyboards for:
- Main menu (2x2 grid)
- Chain selection (3 columns, paginated)
- Token selection (3 columns, paginated)
- Amount presets ($50, $100, $500, Custom)
- Confirmation (Confirm / Cancel)
- Transfer status (Track / New Transfer)

Use callback_data format: `action:param1:param2`
Examples: `chain:ethereum`, `token:usdc`, `amount:100`, `confirm:yes`, `page:chains:2`

## Error Handling

- Wrap all handlers in try/catch
- User-friendly error messages (never show stack traces)
- Log errors with context (user ID, step, input)
- On SDK errors, show "Something went wrong. Please try again."
- On validation errors, show specific message ("Invalid Solana address")
- On rate limit, show "Slow down! Try again in X seconds."

## Build & Run

### Development
```bash
GITHUB_TOKEN=$(gh auth token) npm install
cp .env.example .env  # fill in values
npm run dev  # tsx watch mode, long polling
```

### Production
```bash
npm run build  # tsc → dist/
npm start      # node dist/index.js (webhook mode)
```

### PM2 (ecosystem.config.js)
```javascript
module.exports = {
  apps: [{
    name: 'goblink-bot',
    script: 'dist/index.js',
    env: {
      NODE_ENV: 'production',
    },
    max_memory_restart: '200M',
    exp_backoff_restart_delay: 100,
  }]
};
```

## package.json scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

## .gitignore

```
node_modules/
dist/
.env
*.tgz
```

## README.md

Write a concise README with:
- What it is (goBlink Telegram bot)
- Setup instructions (env vars, npm install, dev/prod)
- Commands list
- Architecture overview
- No protocol internals mentioned

## What to Build NOW (MVP Scope)

Build everything listed above EXCEPT:
- ❌ Address book (Phase 2)
- ❌ Inline mode (Phase 2)
- ❌ /price command (Phase 2 — stub it with "Coming soon")
- ❌ Actual Supabase migrations (just the service layer)
- ❌ Webhook setup (use long polling for now, webhook is a config switch)

## DO

- Use the SDK for ALL transfer logic
- Type everything strictly
- Handle errors gracefully
- Make conversation flow resumable (if user sends random text mid-wizard, show current step again)
- Format messages beautifully with emojis
- Include "Cancel" option at every step
- Log important events (transfer created, status change, errors)

## DO NOT

- Duplicate SDK logic in the bot
- Use `any` type
- Skip error handling
- Expose internal protocol details to users
- Hardcode token lists or chain configs (get from SDK)
- Store sensitive data in session (addresses are fine, keys are not)
