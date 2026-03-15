import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Creates a structured logger instance.
 * Uses pretty printing in development and JSON in production.
 * @param name - Logger name (e.g. module or app name)
 * @returns Pino logger instance
 */
export function createLogger(name: string): pino.Logger {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
    ...(isDev && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    }),
  });
}

/** Default app logger */
export const logger = createLogger('threads-bot');
