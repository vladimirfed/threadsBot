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
    const text = await generatePost();
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
  const hour = Math.floor(Math.random() * 23); // 0-23
  const minute = Math.floor(Math.random() * 60); // 0-59
  const cronExpression = `${minute} ${hour} * * *`; 
  
  console.log(`📅 Следующий пост запланирован на ${hour}:${minute.toString().padStart(2, '0')}`);

  const task = cron.schedule(cronExpression, async () => {
    try {
      await runBot();
    } catch (err) {
      console.error('Ошибка при выполнении запланированного поста:', err);
    } finally {
      task.stop();
      scheduleDaily(); 
    }
  });
}

const isRunOnce = process.argv.some(arg => arg.includes('once'));

try {
  isRunOnce ? await runBot() : scheduleDaily();
} catch (err) {
  console.error('Fatal Error:', err);
  process.exit(1);
}