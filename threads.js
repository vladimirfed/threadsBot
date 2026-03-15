import 'dotenv/config';
import axios from 'axios';

const THREADS_MAX_LENGTH = 500;
const { THREADS_USER_ID, THREADS_ACCESS_TOKEN } = process.env;

// Create a pre-configured client to avoid repeating URLs and tokens
const threadsClient = axios.create({
  baseURL: `https://graph.threads.net/v1.0/${THREADS_USER_ID}`,
  params: { access_token: THREADS_ACCESS_TOKEN },
});

/**
 * Publishes a text post to Threads.
 * @param {string} text 
 */
export async function publishToThreads(text) {
  if (!THREADS_USER_ID || !THREADS_ACCESS_TOKEN) {
    throw new Error('Missing Threads credentials in .env');
  }

  // 1. Prepare and truncate text
  const content = String(text || '').slice(0, THREADS_MAX_LENGTH);
  if (content.length < text?.length) {
    console.warn(`Text truncated to ${THREADS_MAX_LENGTH} chars.`);
  }

  try {
    // 2. Create Media Container
    const { data: container } = await threadsClient.post('/threads', null, {
      params: { media_type: 'TEXT', text: content }
    });

    const creationId = container.id || container.creation_id;
    if (!creationId) throw new Error('Failed to obtain creation_id');

    // 3. Publish Container
    const { data: publishResult } = await threadsClient.post('/threads_publish', null, {
      params: { creation_id: creationId }
    });

    return { creation_id: creationId, ...publishResult };
    
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    console.error(`Threads API Error: ${message}`);
    throw new Error(`Threads Publish Failed: ${message}`);
  }
}