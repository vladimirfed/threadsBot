import 'dotenv/config';
import cron from 'node-cron';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { getRandomTopic, generatePost } from './ai.js';
import { publishToThreads } from './threads.js';

const CACHE_FILE = './data/post-cache.json';
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

/** Cache Helpers */
async function getCache() {
  try {
    return JSON.parse(await readFile(CACHE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function updateCache(data = null) {
  try {
    if (data) await writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
    else await unlink(CACHE_FILE);
  } catch {} // Ignore if file doesn't exist during unlink
}

/** * Main Logic: Resolves content (cache or AI), then publishes.
 */
export async function runBot() {
  let post = await getCache();
  
  if (post) {
    console.log(`[Cache] Found pending post: "${post.topic}"`);
  } else {
    const topic = await getRandomTopic();
    const text = await generatePost(topic);
    post = { topic, text };
    console.log(`[AI] Generated: "${topic}"`);
  }

  try {
    const result = await publishToThreads(post.text);
    await updateCache(null); // Clear cache on success
    console.log('✅ Published successfully:', result.creation_id);
    return result;
  } catch (err) {
    await updateCache(post); // Save/Keep in cache on failure
    console.error('❌ Publication failed. Content saved to cache:', err.message);
    throw err;
  }
}

/** Schedule: Starts a random delay at 14:00 */
function scheduleDaily() {
  cron.schedule('0 14 * * *', () => {
    const delay = Math.floor(Math.random() * THREE_HOURS_MS);
    console.log(`🕒 Post scheduled in ${Math.round(delay / 60000)} mins.`);
    setTimeout(() => runBot().catch(console.error), delay);
  });
  console.log('📅 Bot active: Posting daily between 14:00 and 17:00');
}

const isRunOnce = process.argv.some(arg => arg.includes('once'));

try {
  isRunOnce ? await runBot() : scheduleDaily();
} catch (err) {
  console.error('Fatal Error:', err);
  process.exit(1);
}