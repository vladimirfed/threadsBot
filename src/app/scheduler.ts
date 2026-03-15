import cron from 'node-cron';
import type { RunBotDependencies } from './runBot.js';
import { runBot } from './runBot.js';
import { logger } from '../utils/logger.js';
import { padStart } from '../utils/string.js';

/**
 * Schedules runBot to run once per day at a random time, then reschedules.
 * @param deps - Dependencies for runBot
 */
export function scheduleDaily(deps: RunBotDependencies): void {
  const hour = Math.floor(Math.random() * 24);
  const minute = Math.floor(Math.random() * 60);
  const cronExpression = `${minute} ${hour} * * *`;

  logger.info(
    { next: `${padStart(hour, 2)}:${padStart(minute, 2)}` },
    'Next post scheduled'
  );

  const task = cron.schedule(cronExpression, async () => {
    try {
      await runBot(deps);
    } catch (err) {
      logger.error({ err }, 'Scheduled run failed');
    } finally {
      task.stop();
      scheduleDaily(deps);
    }
  });
}
