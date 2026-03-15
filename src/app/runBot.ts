import type { IAIPostProvider, IThreadsPublisher, IPostCacheStore } from '../core/interfaces.js';
import type { PublishResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface RunBotDependencies {
  aiProvider: IAIPostProvider;
  threadsPublisher: IThreadsPublisher;
  cache: IPostCacheStore;
}

/**
 * Runs one bot cycle: use or create cached post, publish to Threads, clear cache on success.
 * @param deps - Injected services (AI provider, Threads publisher, cache)
 * @returns Publish result with creation_id
 */
export async function runBot(deps: RunBotDependencies): Promise<PublishResult> {
  const { aiProvider, threadsPublisher, cache } = deps;

  let post = await cache.get();

  if (post) {
    logger.info({ topic: post.topic }, 'Using cached post');
  } else {
    const topic = await aiProvider.getRandomTopic();
    const text = await aiProvider.generatePost();
    post = { topic, text };
    logger.info({ topic }, 'Generated new post');
  }

  try {
    const result = await threadsPublisher.publish(post.text);
    await cache.set(null);
    logger.info({ creation_id: result.creation_id }, 'Published successfully');
    return result;
  } catch (err) {
    await cache.set(post);
    logger.error({ err, topic: post.topic }, 'Publish failed; post saved to cache');
    throw err;
  }
}
