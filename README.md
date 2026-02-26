# goBlink Telegram Bot

Telegram bot for goBlink — cross-chain token transfers directly in Telegram. 26 chains, 65+ tokens, zero complexity.

## Setup

### Prerequisites

- Node.js 22+
- GitHub token with `read:packages` scope (for SDK install)

### Install

```bash
GITHUB_TOKEN=$(gh auth token) npm install
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY
```

### Development

```bash
npm run dev
```

Uses long polling — no webhook setup needed.

### Production

```bash
npm run build
npm start        # or: pm2 start ecosystem.config.cjs
```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Main menu |
| `/transfer` | Start a cross-chain transfer |
| `/history` | View recent transfers |
| `/price` | Token price lookup (coming soon) |
| `/help` | Usage guide |

## Architecture

```
src/
├── bot.ts                 # Bot init, middleware, error handling
├── config.ts              # Environment variables
├── index.ts               # Entry point (polling or webhook)
├── conversations/
│   └── transfer.ts        # Multi-step transfer wizard
├── commands/               # Command handlers
├── callbacks/              # Inline keyboard callback handlers
├── services/
│   ├── goblink.ts         # SDK client singleton
│   ├── status-poller.ts   # Background transfer status polling
│   └── supabase.ts        # Database operations
├── utils/
│   ├── keyboards.ts       # Inline keyboard builders
│   ├── formatters.ts      # Message formatting
│   └── rate-limiter.ts    # Per-user rate limiting
└── types/
    └── index.ts           # Shared TypeScript types
```

Transfer logic is handled entirely by `@urban-blazer/goblink-sdk`. The bot provides the Telegram UX layer.
