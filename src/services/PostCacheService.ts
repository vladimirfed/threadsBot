import { unlink } from 'node:fs/promises';
import type { PostCache } from '../types/index.js';
import type { IPostCacheStore } from '../core/interfaces.js';
import { PATH_CONFIG } from '../config/index.js';
import { logger } from '../utils/logger.js';

const CACHE_FILE = PATH_CONFIG.postCache;

/**
 * File-based implementation of post cache storage.
 */
export class PostCacheService implements IPostCacheStore {
  /**
   * Reads the cached post from disk, if any.
   * @returns Cached post or null if missing/invalid
   */
  async get(): Promise<PostCache | null> {
    try {
      const file = Bun.file(CACHE_FILE);
      if (!(await file.exists())) return null;
      const raw = await file.text();
      return JSON.parse(raw) as PostCache;
    } catch {
      return null;
    }
  }

  /**
   * Writes the cache to disk or removes the file when data is null.
   * @param data - Post to cache, or null to clear
   */
  async set(data: PostCache | null): Promise<void> {
    try {
      if (data) {
        await Bun.write(CACHE_FILE, JSON.stringify(data, null, 2));
        logger.debug({ topic: data.topic }, 'Cache updated');
      } else {
        await unlink(CACHE_FILE).catch(() => {});
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to update cache');
    }
  }
}
