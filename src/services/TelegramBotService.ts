import { Bot, type Context } from 'grammy';
import type { IAIPostProvider, IThreadsPublisher } from '../core/interfaces.js';
import { logger } from '../utils/logger.js';

export interface TelegramBotConfig {
  botToken: string;
  adminIds: number[];
  accessPassword?: string;
}

export interface TelegramBotDependencies {
  aiProvider: IAIPostProvider;
  threadsPublisher: IThreadsPublisher;
}

const authenticatedUsers = new Set<number>();

/**
 * Creates a configured Bot instance with auth guard (multi-admin + password) and all handlers.
 * Reusable for both polling (TelegramBotService) and webhook (api/webhook.ts).
 */
export function createTelegramBot(
  config: TelegramBotConfig,
  deps: TelegramBotDependencies
): Bot {
  const bot = new Bot(config.botToken);

  bot.use(async (ctx: Context, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (config.adminIds.includes(userId) || authenticatedUsers.has(userId)) {
      await next();
      return;
    }

    const text =
      ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;

    if (text && config.accessPassword && text.trim() === config.accessPassword) {
      authenticatedUsers.add(userId);
      await ctx.reply('Доступ предоставлен. Отправь тему для поста.');
      logger.info({ userId }, 'User authenticated via password');
      return;
    }

    logger.warn({ userId }, 'Unauthorized access attempt');
  });

  bot.command('start', (ctx) =>
    ctx.reply(
      'Threads Admin Bot активен.\n\nОтправь мне тему — я сгенерирую пост и опубликую в Threads.'
    )
  );

  bot.command('help', (ctx) =>
    ctx.reply(
      [
        'Команды:',
        '/start — проверить, что бот работает',
        '/help — это сообщение',
        '',
        'Отправь текст — это будет тема для генерации поста.',
        config.accessPassword ? 'Для доступа введи пароль.' : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
  );

  bot.on('message:text', async (ctx) => {
    const topic = ctx.message.text;

    await ctx.reply(`Принято, генерирую пост на тему: «${topic}»...`);
    logger.info({ topic }, 'Telegram bot: generating post');

    try {
      const text = await deps.aiProvider.generatePost(topic);
      await ctx.reply(`Сгенерированный пост:\n\n${text}`);
      logger.info({ topic, textLength: text.length }, 'Telegram bot: post generated');

      await ctx.reply('Публикую в Threads...');
      const result = await deps.threadsPublisher.publish(text);

      await ctx.reply(`Опубликовано!\ncreation_id: ${result.creation_id}`);
      logger.info(
        { topic, creationId: result.creation_id },
        'Telegram bot: published successfully'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.reply(`Ошибка: ${message}`);
      logger.error({ err: error, topic }, 'Telegram bot: publish failed');
    }
  });

  return bot;
}

/**
 * Wrapper for long-polling mode (local dev / standalone process).
 */
export class TelegramBotService {
  private readonly bot: Bot;

  constructor(config: TelegramBotConfig, deps: TelegramBotDependencies) {
    this.bot = createTelegramBot(config, deps);
  }

  async start(): Promise<void> {
    logger.info('Starting Telegram admin bot (long polling)...');
    this.bot.start({
      onStart: () => logger.info('Telegram admin bot is running'),
    });
  }

  stop(): void {
    this.bot.stop();
    logger.info('Telegram admin bot stopped');
  }
}
