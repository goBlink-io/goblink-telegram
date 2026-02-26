import { config } from './config.js';
import { createBot } from './bot.js';
import { startStatusPoller, stopStatusPoller } from './services/status-poller.js';

async function main(): Promise<void> {
  const bot = createBot();

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down...');
    stopStatusPoller();
    bot.stop();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  // Start status poller
  startStatusPoller(bot);

  if (config.isProduction && config.webhookUrl) {
    // Production: webhook mode
    console.log(`Starting webhook at ${config.webhookUrl}`);
    await bot.api.setWebhook(config.webhookUrl, {
      secret_token: config.webhookSecret || undefined,
    });
    // In production, use a web framework to handle webhook posts.
    // For MVP, fall through to polling.
    console.log('Webhook set. Use a web server to handle incoming updates.');
    console.log('Falling back to long polling for now...');
    bot.start({
      onStart: () => console.log('Bot started (polling, webhook set)'),
    });
  } else {
    // Development: long polling
    console.log('Starting bot with long polling...');
    bot.start({
      onStart: () => console.log('Bot started (long polling)'),
    });
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
