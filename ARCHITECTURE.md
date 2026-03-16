# Threads Bot — Architecture

This document describes the project structure, data flow, and design decisions after the Clean Architecture refactor.

---

## Folder Structure

```
src/
├── config/           # Configuration and environment
│   ├── env.ts        # Zod-based env validation (loadEnv)
│   ├── constants.ts  # PROMPT, AI_CONFIG, PATH_CONFIG, THREADS_MAX_LENGTH
│   └── index.ts
├── types/            # Shared TypeScript types and interfaces
│   └── index.ts      # PostCache, PublishResult, ThreadsContainerResponse, etc.
├── core/             # Reusable logic and contracts
│   ├── errors.ts     # AppError, ConfigError, AIProviderError, ThreadsAPIError
│   ├── interfaces.ts # IAIPostProvider, IThreadsPublisher, IPostCacheStore
│   └── index.ts
├── utils/            # Helpers
│   ├── logger.ts     # Pino-based structured logger
│   ├── delay.ts      # Promise-based delay
│   ├── string.ts     # truncate, padStart
│   └── index.ts
├── services/         # Business logic (one concern per module)
│   ├── GeminiService.ts      # AI post generation (implements IAIPostProvider)
│   ├── ThreadsService.ts     # Threads API publish (implements IThreadsPublisher)
│   ├── PostCacheService.ts   # File-based post cache (implements IPostCacheStore)
│   └── index.ts
├── app/              # Application entry and orchestration
│   ├── runBot.ts     # runBot(deps) — one publish cycle with DI
│   ├── scheduler.ts  # scheduleDaily(deps) — node-cron daily run
│   └── index.ts      # buildContainer(), main(), CLI (once vs scheduled)
└── index.ts          # Entry point (imports app)
```

- **config**: Single place for env (Zod) and constants. No business logic.
- **types**: All shared interfaces and types; used by config, core, services, and app.
- **core**: Interfaces (ports) and shared errors. No framework or I/O details.
- **utils**: Pure helpers (logging, delay, string). No business rules.
- **services**: Implementations of core interfaces; contain all I/O and external APIs.
- **app**: Composes services via DI, runs the bot once or on a schedule.

---

## Data Flow

1. **Entry** (`src/index.ts`)  
   Imports `src/app/index.ts`, which loads env, builds the DI container, and runs either:
   - **Once**: `runBot(deps)` then exit.
   - **Scheduled**: `scheduleDaily(deps)` (node-cron, one run per day at a random time).

2. **Container** (`buildContainer()` in `app/index.ts`)  
   - Reads env via `loadEnv(true)` (Zod; throws if required vars missing).  
   - Instantiates:
     - `GeminiService(apiKey)` → `IAIPostProvider`
     - `ThreadsService(userId, accessToken)` → `IThreadsPublisher`
     - `PostCacheService()` → `IPostCacheStore`  
   - Returns `RunBotDependencies` passed into `runBot` and `scheduleDaily`.

3. **Run cycle** (`runBot(deps)`)  
   - `cache.get()`: use cached post if any.  
   - If none: `aiProvider.getRandomTopic()` + `aiProvider.generatePost()` → new post.  
   - `threadsPublisher.publish(post.text)`.  
   - On success: `cache.set(null)`. On failure: `cache.set(post)` and rethrow.

4. **Scheduler** (`scheduleDaily(deps)`)  
   - Picks random hour/minute, builds cron expression.  
   - Schedules one run of `runBot(deps)`.  
   - After run, stops the task and calls `scheduleDaily(deps)` again (next day).

5. **Logging**  
   All `console.*` usage is replaced by a Pino logger from `utils/logger`.  
   Errors are logged with context; app entry catches `ConfigError` and other failures and exits with code 1.

---

## Rationale

- **Clean Architecture**: App and core depend on interfaces; services implement them. Config and types are shared; no business logic in config or utils.
- **SOLID**:  
  - **S**ingle responsibility: one service per concern (Gemini, Threads, cache).  
  - **O**pen/closed: new AI or publisher = new class implementing the same interface.  
  - **L**iskov: implementations are substitutable (e.g. another cache store).  
  - **I**nterface segregation: small contracts (e.g. `IAIPostProvider`, `IThreadsPublisher`).  
  - **D**ependency inversion: `runBot` and scheduler depend on abstractions (interfaces), not concrete classes.
- **Dependency injection**: Container built in `app/index.ts`; `runBot` and `scheduleDaily` receive `RunBotDependencies`. No global state; easy to test with mocks.
- **Error handling**: Custom errors in `core/errors.ts`; services throw them; app layer logs and exits. No silent swallows.
- **Structured logging**: Pino with optional pretty-print in development; JSON in production; single logger instance from `utils/logger`.

---

## Adding a New Provider (e.g. Switch from Gemini to Claude)

1. **Implement the port**  
   In `core/interfaces.ts` the AI provider is already abstracted as `IAIPostProvider`:
   - `getRandomTopic(): Promise<string>`
   - `generatePost(): Promise<string>`

2. **Create a new service**  
   e.g. `src/services/ClaudeService.ts` that implements `IAIPostProvider`:
   - Use your Claude SDK/API in `getRandomTopic` and `generatePost` (same prompt/style logic as in `GeminiService`, or shared via a small helper if you extract it).
   - Depend only on config (e.g. `CLAUDE_API_KEY`) and types; no dependency on `GeminiService`.

3. **Wire in the container**  
   In `src/app/index.ts`, inside `buildContainer()`:
   - Read env for Claude (e.g. `CLAUDE_API_KEY`).
   - Replace:
     - `aiProvider: new GeminiService(env.GEMINI_API_KEY!)`
     - with:
     - `aiProvider: new ClaudeService(env.CLAUDE_API_KEY!)`
   - Optionally support both via env (e.g. `AI_PROVIDER=gemini|claude`) and branch when instantiating.

4. **Config**  
   Add any new env vars to `src/config/env.ts` (Zod schema) and, if needed, new constants in `src/config/constants.ts` (e.g. model name, limits). No changes are required in `runBot` or scheduler; they only depend on `IAIPostProvider`.

---

## Scripts

- **Bot (scheduled)**: `npm run dev` or `npm start` (after `npm run build`).
- **Bot (single run)**: `npm run dev:once` or `npm run once`.

**Style context**: Place `data/textStyle.txt` with your persona and style description. Its full content is passed to Gemini as "Style reference" in the prompt.

---

## Environment Variables

Validated in `src/config/env.ts` (Zod). Required for the main bot:

- `GEMINI_API_KEY`
- `THREADS_USER_ID`
- `THREADS_ACCESS_TOKEN`

Optional: `NODE_ENV`, `LOG_LEVEL`. For extract script only, env validation can be run with `strict: false` if you don’t have API keys.
