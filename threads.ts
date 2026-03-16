import 'dotenv/config';
import axios, { AxiosError } from 'axios';
import type { PublishResult, ThreadsContainerResponse } from './src/types/index.js';

const THREADS_MAX_LENGTH = 500;
const { THREADS_USER_ID, THREADS_ACCESS_TOKEN } = process.env;

const threadsClient = axios.create({
  baseURL: `https://graph.threads.net/v1.0/${THREADS_USER_ID}`,
  params: { access_token: THREADS_ACCESS_TOKEN },
});

export async function publishToThreads(text: string): Promise<PublishResult> {
  if (!THREADS_USER_ID || !THREADS_ACCESS_TOKEN) {
    throw new Error('Missing Threads credentials in .env');
  }

  const content = String(text ?? '').slice(0, THREADS_MAX_LENGTH);
  if (text != null && content.length < text.length) {
    console.warn(`Text truncated to ${THREADS_MAX_LENGTH} chars.`);
  }

  try {
    const { data: container } =
      await threadsClient.post<ThreadsContainerResponse>('/threads', null, {
        params: { media_type: 'TEXT', text: content },
      });

    const creationId = container.id ?? container.creation_id;
    if (!creationId) throw new Error('Failed to obtain creation_id');

    const { data: publishResult } = await threadsClient.post<PublishResult>(
      '/threads_publish',
      null,
      { params: { creation_id: creationId } }
    );

    return { ...publishResult, creation_id: creationId };
  } catch (error) {
    const err = error as AxiosError<{ error?: { message?: string } }>;
    const message =
      err.response?.data?.error?.message ?? (error as Error).message;
    console.error(`Threads API Error: ${message}`);
    throw new Error(`Threads Publish Failed: ${message}`);
  }
}
