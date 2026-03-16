import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile } from 'node:fs/promises';
import type { IAIPostProvider } from '../core/interfaces.js';
import { PROMPT, AI_CONFIG, PATH_CONFIG, TOPICS } from '../config/index.js';
import { AIProviderError } from '../core/errors.js';
import { logger } from '../utils/logger.js';
import { truncate } from '../utils/string.js';

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
   * Generates a Threads post using Gemini with style context from textStyle.txt.
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
   * Loads full content of textStyle.txt (persona and style context), or empty string if file is missing.
   */
  private async getStyleContext(): Promise<string> {
    try {
      return await readFile(PATH_CONFIG.textStyle, 'utf8');
    } catch (err) {
      const isEnoent =
        err instanceof Error &&
        'code' in err &&
        (err as NodeJS.ErrnoException).code === 'ENOENT';
      if (isEnoent) {
        logger.info('No textStyle.txt found, using empty style context');
        return '';
      }
      throw err;
    }
  }
}
