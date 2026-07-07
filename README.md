# Telegram Personal Assistant Bot

## What it does

- Text chat via Telegram webhook
- Voice messages transcribed
- Google Calendar: check schedule, create, update, delete events
- Per-chat conversation memory (in-memory, resets on restart)

## Requirements

- Node.js 18+
- Telegram bot token ([@BotFather](https://t.me/BotFather))
- OpenAI API key
- Google service account with Calendar API access

## Setup

```bash
npm install
cp .env.example .env
# fill in .env
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Random string for webhook auth |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_CLIENT_EMAIL` | Service account email |
| `GOOGLE_PRIVATE_KEY` | Service account private key |

See `.env.example` for the full list.

## Local development

Telegram needs a public HTTPS URL. Use a tunnel:

```bash
npm run dev        # port 3000
npm run tunnel     # exposes localhost via localtunnel
```

Register the webhook:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-tunnel-url/api/telegram",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

`secret_token` must match `TELEGRAM_WEBHOOK_SECRET` in `.env`.


Check webhook status:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm run tunnel` | Expose local port via localtunnel |

## Project structure

```
src/
├── index.ts              
├── app.ts# Ex            
├── routes/telegram.ts    # Webhook handler
├── agent/agent.ts        # LangChain agent + chat()
├── services/             # Telegram API, transcription, input parsing
├── tools/                # Langchain tools
└── middleware/           # Webhook secret validation
```
