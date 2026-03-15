import path from 'node:path';
import { PATH_CONFIG } from '../config/index.js';
import { TelegramParseService } from '../services/index.js';
import { logger } from '../utils/logger.js';

const DEFAULT_SENDER = 'Vladimir F';
const inputPath = path.join(PATH_CONFIG.dataDir, 'chatHistory.json');

/**
 * CLI script: extracts personal messages from Telegram chat export into personalMessages.json.
 * Usage: npm run extract-messages (or tsx src/scripts/extract-personal-messages.ts)
 */
async function main(): Promise<void> {
  const service = new TelegramParseService();
  const count = await service.extractPersonalMessages({
    inputPath,
    outputPath: PATH_CONFIG.messages,
    senderName: DEFAULT_SENDER,
    minLength: 35,
    maxMessages: 50,
  });
  logger.info(`Saved ${count} messages to personalMessages.json`);
}

main().catch((err) => {
  logger.error({ err }, 'Extract failed');
  process.exit(1);
});
