import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const inputPath = path.join(__dirname, 'chatHistory.json');
const outputPath = path.join(__dirname, 'personalMessages.json');

interface ChatMessage {
  from?: string;
  text?: string | string[];
}

interface ChatHistory {
  messages?: ChatMessage[];
}

function getText(msg: ChatMessage): string {
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

async function main(): Promise<void> {
  const raw = await readFile(inputPath, 'utf8');
  const data = JSON.parse(raw) as ChatHistory;
  const messages = data.messages ?? [];

  const result = messages
    .filter((msg) => msg.from === 'Vladimir F')
    .map((msg) => getText(msg))
    .filter((text) => text.length >= 35)
    .map((text) => ({ text }))
    .slice(0, 50);

  await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`Done. Saved ${result.length} messages to personalMessages.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
