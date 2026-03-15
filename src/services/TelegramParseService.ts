import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChatHistory, ChatMessage } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Extracts text from a single chat message (string or string[]).
 */
function getMessageText(msg: ChatMessage): string {
  const t = msg.text;
  if (typeof t === 'string') return t;
  if (Array.isArray(t)) {
    return t
      .filter((x): x is string => typeof x === 'string')
      .join(' ')
      .trim();
  }
  return '';
}

export interface TelegramParseOptions {
  /** Path to Telegram chat export JSON (e.g. chatHistory.json) */
  inputPath: string;
  /** Path to write personalMessages.json */
  outputPath: string;
  /** Filter messages from this sender name */
  senderName: string;
  /** Minimum character length for a message to be included */
  minLength?: number;
  /** Maximum number of messages to keep */
  maxMessages?: number;
}

/**
 * Parses Telegram chat export and extracts personal messages for style context.
 */
export class TelegramParseService {
  /**
   * Parses the chat export and writes filtered messages to output path.
   * @param options - Paths and filters
   */
  async extractPersonalMessages(options: TelegramParseOptions): Promise<number> {
    const {
      inputPath,
      outputPath,
      senderName,
      minLength = 35,
      maxMessages = 50,
    } = options;

    const raw = await readFile(inputPath, 'utf8');
    const data = JSON.parse(raw) as ChatHistory;
    const messages = data.messages ?? [];

    const result = messages
      .filter((msg) => msg.from === senderName)
      .map((msg) => getMessageText(msg))
      .filter((text) => text.length >= minLength)
      .map((text) => ({ text }))
      .slice(0, maxMessages);

    await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');
    logger.info(
      { count: result.length, outputPath: path.basename(outputPath) },
      'Personal messages extracted'
    );
    return result.length;
  }
}
