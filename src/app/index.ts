import { loadEnv } from '../config/index.js';
import {
  GeminiService,
  ThreadsService,
  PostCacheService,
  TelegramBotService,
} from '../services/index.js';
import type {
  TelegramBotConfig,
  TelegramBotDependencies,
} from '../services/index.js';
import { runBot, type RunBotDependencies } from './runBot.js';
import { scheduleDaily } from './scheduler.js';
import { logger } from '../utils/logger.js';
import { ConfigError } from '../core/errors.js';

interface AppContainer {
  runBotDeps: RunBotDependencies;
  telegramBot: TelegramBotService | null;
}

function buildContainer(): AppContainer {
  const env = loadEnv(true);

  const aiProvider = new GeminiService(env.GEMINI_API_KEY!);
  const threadsPublisher = new ThreadsService(
    env.THREADS_USER_ID!,
    env.THREADS_ACCESS_TOKEN!
  );
  const cache = new PostCacheService();

  let telegramBot: TelegramBotService | null = null;

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_ID) {
    const adminIds = [Number(env.TELEGRAM_ADMIN_ID)];
    if (env.TELEGRAM_ADMIN_ID_2) adminIds.push(Number(env.TELEGRAM_ADMIN_ID_2));

    const botConfig: TelegramBotConfig = {
      botToken: env.TELEGRAM_BOT_TOKEN,
      adminIds,
      accessPassword: env.BOT_ACCESS_PASSWORD,
    };
    const botDeps: TelegramBotDependencies = { aiProvider, threadsPublisher };
    telegramBot = new TelegramBotService(botConfig, botDeps);
  }

  return {
    runBotDeps: { aiProvider, threadsPublisher, cache },
    telegramBot,
  };
}

const isRunOnce = Bun.argv.some((arg) => arg.includes('once'));
const isBotOnly = Bun.argv.some((arg) => arg.includes('bot'));

async function main(): Promise<void> {
  try {
    const { runBotDeps, telegramBot } = buildContainer();

    if (isRunOnce) {
      await runBot(runBotDeps);
      process.exit(0);
    }

    if (isBotOnly) {
      if (!telegramBot) {
        throw new ConfigError(
          'TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_ID are required for --bot mode'
        );
      }
      await telegramBot.start();
      return;
    }

    scheduleDaily(runBotDeps);

    if (telegramBot) {
      await telegramBot.start();
    } else {
      logger.info('Telegram bot credentials not set, skipping bot startup');
    }
  } catch (err) {
    if (err instanceof ConfigError) {
      logger.error({ err: err.message }, 'Configuration error');
    } else {
      logger.error({ err }, 'Fatal error');
    }
    process.exit(1);
  }
}

main();
