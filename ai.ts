import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile } from 'node:fs/promises';
import { CONFIG, PROMPT, TOPICS } from './ai-config.js';
import type { PersonalMessage } from './types.js';

const loadJson = async <T>(filePath: string): Promise<T> =>
  JSON.parse(await readFile(filePath, 'utf8')) as T;

export async function getRandomTopic(): Promise<string> {
  const list = [...TOPICS];
  if (!list.length) throw new Error('Topics list is empty');
  return list[Math.floor(Math.random() * list.length)] ?? '';
}

async function getStyleContext(): Promise<string> {
  type MessagesData = { messages?: unknown[] } | PersonalMessage[];
  const data = await loadJson<MessagesData>(CONFIG.paths.messages);
  const messages = (Array.isArray(data) ? data : (data.messages ?? []))
    .map((m: unknown) =>
      typeof m === 'string' ? m : (m as PersonalMessage)?.text
    )
    .filter(Boolean)
    .slice(0, CONFIG.maxStyleExamples) as string[];
  return messages.join('\n\n---\n\n');
}

export async function generatePost(): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: CONFIG.model });
  const style = await getStyleContext();
  const topic = await getRandomTopic();

  const result = await model.generateContent(
    PROMPT + `\n\nTopic: ${topic}\n\nStyle reference: ${style}`
  );
  const text = result.response.text().trim();

  return text.length > CONFIG.threadCharLimit
    ? text.slice(0, CONFIG.threadCharLimit)
    : text;
}
