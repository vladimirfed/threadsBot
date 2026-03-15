/**
 * Base application error with optional code and cause.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Thrown when environment or configuration is invalid.
 */
export class ConfigError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'CONFIG_ERROR', cause);
    this.name = 'ConfigError';
  }
}

/**
 * Thrown when AI provider (e.g. Gemini) fails.
 */
export class AIProviderError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'AI_PROVIDER_ERROR', cause);
    this.name = 'AIProviderError';
  }
}

/**
 * Thrown when Threads API fails.
 */
export class ThreadsAPIError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'THREADS_API_ERROR', cause);
    this.name = 'ThreadsAPIError';
  }
}
