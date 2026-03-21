import { loadEnv } from '../config/index.js';
import { GeminiService, ThreadsService, PostCacheService } from '../services/index.js';
import { runBot, type RunBotDependencies } from './runBot.js';
import { scheduleDaily } from './scheduler.js';
import { logger } from '../utils/logger.js';
import { ConfigError } from '../core/errors.js';

function buildContainer(): RunBotDependencies {
  const env = loadEnv(true);
  return {
    aiProvider: new GeminiService(env.GEMINI_API_KEY!),
    threadsPublisher: new ThreadsService(env.THREADS_USER_ID!, env.THREADS_ACCESS_TOKEN!),
    cache: new PostCacheService(),
  };
}

const isRunOnce = Bun.argv.some((arg) => arg.includes('once'));

async function main(): Promise<void> {
  try {
    const deps = buildContainer();
    if (isRunOnce) {
      await runBot(deps);
      process.exit(0);
    } else {
      scheduleDaily(deps);
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
