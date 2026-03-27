import type { PostCache, PublishResult } from '../types/index.js';

/**
 * Contract for an AI post generation provider (e.g. Gemini, Claude).
 * Allows swapping providers without changing app logic.
 */
export interface IAIPostProvider {
  /** Returns a random topic from the configured list */
  getRandomTopic(): Promise<string>;
  /** Generates post text. Uses the provided topic or picks a random one. */
  generatePost(topic?: string): Promise<string>;
}

/**
 * Contract for publishing content to Threads.
 */
export interface IThreadsPublisher {
  /** Publishes text to Threads and returns the creation id */
  publish(text: string): Promise<PublishResult>;
}

/**
 * Contract for reading/writing the post cache (e.g. file-based).
 */
export interface IPostCacheStore {
  get(): Promise<PostCache | null>;
  set(data: PostCache | null): Promise<void>;
}
