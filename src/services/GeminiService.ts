import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile } from 'node:fs/promises';
import type { IAIPostProvider } from '../core/interfaces.js';
import type { PersonalMessage } from '../types/index.js';
import { PROMPT, AI_CONFIG, PATH_CONFIG, TOPICS } from '../config/index.js';
import { AIProviderError } from '../core/errors.js';
import { logger } from '../utils/logger.js';
import { truncate } from '../utils/string.js';

async function loadJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function loadJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return await loadJson<T>(filePath);
  } catch (err) {
    const isEnoent =
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (isEnoent) return null;
    throw err;
  }
}

/**
 * Gemini-based AI post generation service.
 */
export class GeminiService implements IAIPostProvider {
  constructor(private readonly apiKey: string) {}

  /**
   * Picks a random topic from the configured TOPICS list (see config).
   * @throws AIProviderError if topics list is empty
   */
  async getRandomTopic(): Promise<string> {
    const list = [...TOPICS];
    if (!list.length) throw new AIProviderError('Topics list is empty');
    return list[Math.floor(Math.random() * list.length)] ?? '';
  }

  /**
   * Generates a Threads post using Gemini with style context from personal messages.
   * @returns Post text truncated to threadCharLimit
   */
  async generatePost(): Promise<string> {
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({ model: AI_CONFIG.model });
    const style = await this.getStyleContext();
    const topic = await this.getRandomTopic();

    const result = await model.generateContent(
      `${PROMPT}\n\nTopic: ${topic}\n\nStyle reference: ${style}`
    );
    const text = result.response.text().trim();
    const final = truncate(text, AI_CONFIG.threadCharLimit);

    if (text.length > AI_CONFIG.threadCharLimit) {
      logger.warn(
        { original: text.length, limit: AI_CONFIG.threadCharLimit },
        'Post truncated'
      );
    }
    return final;
  }

  /**
   * Loads style examples from personal messages JSON, or empty string if file is missing (e.g. in CI).
   */
  private async getStyleContext(): Promise<string> {
    type MessagesData = { messages?: unknown[] } | PersonalMessage[];
    const data = await loadJsonIfExists<MessagesData>(PATH_CONFIG.messages);
    if (data == null) {
      logger.info('No personalMessages.json found, using empty style context');
      return '';
    }
    const messages = (Array.isArray(data) ? data : (data.messages ?? []))
      .map((m: unknown) =>
        typeof m === 'string' ? m : (m as PersonalMessage)?.text
      )
      .filter(Boolean)
      .slice(0, AI_CONFIG.maxStyleExamples) as string[];
    return messages.join('\n\n---\n\n');
  }
}
