/**
 * One-time script to register the webhook URL with Telegram Bot API.
 *
 * Usage:
 *   bun scripts/set-webhook.ts <VERCEL_URL>
 *
 * Example:
 *   bun scripts/set-webhook.ts https://my-app.vercel.app
 *
 * Required env vars: TELEGRAM_BOT_TOKEN, WEBHOOK_SECRET
 */

interface TelegramSetWebhookResponse {
  ok: boolean;
  result?: boolean;
  description?: string;
}

async function main(): Promise<void> {
  const vercelUrl = Bun.argv[2];

  if (!vercelUrl) {
    console.error('Usage: bun scripts/set-webhook.ts <VERCEL_URL>');
    console.error(
      'Example: bun scripts/set-webhook.ts https://my-app.vercel.app'
    );
    process.exit(1);
  }

  const token = Bun.env.TELEGRAM_BOT_TOKEN;
  const secret = Bun.env.WEBHOOK_SECRET;

  if (!token) {
    console.error('Error: TELEGRAM_BOT_TOKEN is not set');
    process.exit(1);
  }

  if (!secret) {
    console.error('Error: WEBHOOK_SECRET is not set');
    process.exit(1);
  }

  const webhookUrl = `${vercelUrl.replace(/\/$/, '')}/api/webhook`;

  console.log(`Setting webhook to: ${webhookUrl}`);

  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ['message'],
        drop_pending_updates: true,
      }),
    }
  );

  const data = (await response.json()) as TelegramSetWebhookResponse;

  if (data.ok) {
    console.log('Webhook set successfully!');
    console.log(`URL: ${webhookUrl}`);
  } else {
    console.error('Failed to set webhook:', data.description);
    process.exit(1);
  }
}

main();
