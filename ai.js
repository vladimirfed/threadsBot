import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile } from 'node:fs/promises';
import { CONFIG, PROMPT } from './ai-config.js';

// --- Helpers ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const loadJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

/** Extract retry delay from Gemini error or fallback to 7s */
function getDelay(err) {
  const retryInfo = err.errorDetails?.find(d => d['@type']?.includes('RetryInfo'));
  const match = err.message?.match(/retry in ([\d.]+)s/i);
  const seconds = retryInfo?.retryDelay?.replace('s', '') || match?.[1] || 7;
  return Math.ceil(seconds * 1000);
}

// --- Logic ---
export async function getRandomTopic() {
  const topics = await loadJson(CONFIG.paths.topics);
  const list = Array.isArray(topics) ? topics : Object.values(topics);
  if (!list.length) throw new Error('Topics list is empty');
  return list[Math.floor(Math.random() * list.length)];
}

async function getStyleContext() {
  const data = await loadJson(CONFIG.paths.messages);
  const messages = (Array.isArray(data) ? data : data.messages || [])
    .map(m => typeof m === 'string' ? m : m?.text)
    .filter(Boolean)
    .slice(0, CONFIG.maxStyleExamples);
  
  return messages.join('\n\n---\n\n');
}

export async function generatePost() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: CONFIG.model });
  const style = await getStyleContext();
  const topic = await getRandomTopic();

  const result = await model.generateContent(PROMPT + `\n\nTopic: ${topic}\n\nStyle reference: ${style}`);
  const text = result.response.text().trim();

  return text.length > CONFIG.threadCharLimit 
    ? text.slice(0, CONFIG.threadCharLimit) 
    : text;
}
