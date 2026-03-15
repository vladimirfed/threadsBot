import axios, { AxiosError } from 'axios';
import type { IThreadsPublisher } from '../core/interfaces.js';
import type { PublishResult, ThreadsContainerResponse } from '../types/index.js';
import { THREADS_MAX_LENGTH } from '../config/index.js';
import { ThreadsAPIError } from '../core/errors.js';
import { logger } from '../utils/logger.js';
import { truncate } from '../utils/string.js';

/**
 * Threads API publishing service.
 */
export class ThreadsService implements IThreadsPublisher {
  private readonly client;

  constructor(
    private readonly userId: string,
    private readonly accessToken: string
  ) {
    this.client = axios.create({
      baseURL: `https://graph.threads.net/v1.0/${userId}`,
      params: { access_token: accessToken },
    });
  }

  /**
   * Publishes text to Threads (create container + publish).
   * @param text - Post content (truncated to THREADS_MAX_LENGTH)
   * @returns Publish result with creation_id
   */
  async publish(text: string): Promise<PublishResult> {
    const content = truncate(String(text ?? ''), THREADS_MAX_LENGTH);
    if (text != null && content.length < text.length) {
      logger.warn(
        { max: THREADS_MAX_LENGTH, length: text.length },
        'Text truncated for Threads'
      );
    }

    try {
      const { data: container } =
        await this.client.post<ThreadsContainerResponse>('/threads', null, {
          params: { media_type: 'TEXT', text: content },
        });

      const creationId = container.id ?? container.creation_id;
      if (!creationId) throw new ThreadsAPIError('Failed to obtain creation_id');

      const { data: publishResult } = await this.client.post<PublishResult>(
        '/threads_publish',
        null,
        { params: { creation_id: creationId } }
      );

      return { ...publishResult, creation_id: creationId };
    } catch (error) {
      const err = error as AxiosError<{ error?: { message?: string } }>;
      const message =
        err.response?.data?.error?.message ?? (error as Error).message;
      logger.error({ err, message }, 'Threads API error');
      throw new ThreadsAPIError(`Threads Publish Failed: ${message}`, error);
    }
  }
}
