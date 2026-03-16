/**
 * Shared domain and API types for the Threads bot.
 */

/** Cached post before publishing */
export interface PostCache {
  topic: string;
  text: string;
}

/** Result of Threads API publish */
export interface PublishResult {
  creation_id: string;
  [key: string]: unknown;
}

/** Threads API container response */
export interface ThreadsContainerResponse {
  id?: string;
  creation_id?: string;
}

/** Gemini API error detail (e.g. RetryInfo) */
export interface GeminiErrorDetail {
  '@type'?: string;
  retryDelay?: string;
}

/** Gemini API error shape */
export interface GeminiError extends Error {
  errorDetails?: GeminiErrorDetail[];
}

/** Topic list: array or object of topics */
export type TopicsInput = string[] | Record<string, string>;
