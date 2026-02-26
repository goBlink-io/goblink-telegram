import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  webhookUrl: process.env['TELEGRAM_WEBHOOK_URL'] ?? '',
  webhookSecret: process.env['TELEGRAM_WEBHOOK_SECRET'] ?? '',

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_KEY'),

  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  logLevel: process.env['LOG_LEVEL'] ?? 'info',

  isProduction: process.env['NODE_ENV'] === 'production',
} as const;
