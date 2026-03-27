import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFile } from 'node:fs/promises';
import { Bot, type Context } from 'grammy';
import type { Update } from 'grammy/types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

import {
  PROMPT,
  AI_CONFIG,
  CONFIG,
  THREADS_MAX_LENGTH,
} from '../src/config/constants.js';
import { truncate } from '../src/utils/string.js';

interface WebhookEnv {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_ADMIN_ID: string;
  TELEGRAM_ADMIN_ID_2?: string;
  BOT_ACCESS_PASSWORD?: string;
  WEBHOOK_SECRET: string;
  GEMINI_API_KEY: string;
  THREADS_USER_ID: string;
  THREADS_ACCESS_TOKEN: string;
}

function loadWebhookEnv(): WebhookEnv {
  const {
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_ADMIN_ID,
    TELEGRAM_ADMIN_ID_2,
    BOT_ACCESS_PASSWORD,
    WEBHOOK_SECRET,
    GEMINI_API_KEY,
    THREADS_USER_ID,
    THREADS_ACCESS_TOKEN,
  } = process.env;

  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is required');
  if (!TELEGRAM_ADMIN_ID) throw new Error('TELEGRAM_ADMIN_ID is required');
  if (!WEBHOOK_SECRET) throw new Error('WEBHOOK_SECRET is required');
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required');
  if (!THREADS_USER_ID) throw new Error('THREADS_USER_ID is required');
  if (!THREADS_ACCESS_TOKEN) throw new Error('THREADS_ACCESS_TOKEN is required');

  return {
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_ADMIN_ID,
    TELEGRAM_ADMIN_ID_2,
    BOT_ACCESS_PASSWORD,
    WEBHOOK_SECRET,
    GEMINI_API_KEY,
    THREADS_USER_ID,
    THREADS_ACCESS_TOKEN,
  };
}

async function generatePost(apiKey: string, topic: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: AI_CONFIG.model });

  let style = '';
  try {
    style = await readFile(CONFIG.textStyle, 'utf-8');
  } catch {
    /* textStyle.txt missing on Vercel — expected */
  }

  const result = await model.generateContent(
    `${PROMPT}\n\nTopic: ${topic}\n\nStyle reference: ${style}`
  );
  return truncate(result.response.text().trim(), AI_CONFIG.threadCharLimit);
}

interface ThreadsContainerResponse {
  id?: string;
  creation_id?: string;
}

interface PublishResult {
  creation_id: string;
  [key: string]: unknown;
}

async function publishToThreads(
  userId: string,
  accessToken: string,
  text: string
): Promise<PublishResult> {
  const client = axios.create({
    baseURL: `https://graph.threads.net/v1.0/${userId}`,
    params: { access_token: accessToken },
  });

  const content = truncate(text, THREADS_MAX_LENGTH);

  const { data: container } = await client.post<ThreadsContainerResponse>(
    '/threads',
    null,
    { params: { media_type: 'TEXT', text: content } }
  );

  const creationId = container.id ?? container.creation_id;
  if (!creationId) throw new Error('Failed to obtain creation_id from Threads');

  const { data: publishResult } = await client.post<PublishResult>(
    '/threads_publish',
    null,
    { params: { creation_id: creationId } }
  );

  return { ...publishResult, creation_id: creationId };
}

const authenticatedUsers = new Set<number>();
let bot: Bot | undefined;

function getBot(): Bot {
  if (bot) return bot;

  const env = loadWebhookEnv();

  const adminIds = [Number(env.TELEGRAM_ADMIN_ID)];
  if (env.TELEGRAM_ADMIN_ID_2) adminIds.push(Number(env.TELEGRAM_ADMIN_ID_2));

  bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  bot.use(async (ctx: Context, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (adminIds.includes(userId) || authenticatedUsers.has(userId)) {
      await next();
      return;
    }

    const text =
      ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;

    if (text && env.BOT_ACCESS_PASSWORD && text.trim() === env.BOT_ACCESS_PASSWORD) {
      authenticatedUsers.add(userId);
      await ctx.reply('Доступ предоставлен. Отправь тему для поста.');
    }
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
        env.BOT_ACCESS_PASSWORD ? 'Для доступа введи пароль.' : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
  );

  bot.on('message:text', async (ctx) => {
    const topic = ctx.message.text;

    await ctx.reply(`Принято, генерирую пост на тему: «${topic}»...`);

    try {
      const text = await generatePost(env.GEMINI_API_KEY, topic);
      await ctx.reply(`Сгенерированный пост:\n\n${text}`);

      await ctx.reply('Публикую в Threads...');
      const result = await publishToThreads(
        env.THREADS_USER_ID,
        env.THREADS_ACCESS_TOKEN,
        text
      );

      await ctx.reply(`Опубликовано!\ncreation_id: ${result.creation_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.reply(`Ошибка: ${message}`);
      console.error('Webhook publish error:', error);
    }
  });

  return bot;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
  const expectedSecret = process.env.WEBHOOK_SECRET;

  if (!expectedSecret || secretHeader !== expectedSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const instance = getBot();
    await instance.init();
    await instance.handleUpdate(req.body as Update);
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  res.status(200).json({ ok: true });
}
