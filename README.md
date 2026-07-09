# Telegram Personal Assistant Bot

## What it does

- Text chat via Telegram webhook
- Voice messages transcribed
- Google Calendar: check schedule, create, update, delete events
- Portfolio: live quotes, net worth, holdings CRUD (SQLite + Yahoo Finance)
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
| `DB_PATH` | SQLite path (default `./data/portfolio.db`) |

See `.env.example` for the full list.

### Portfolio seed

Holdings are not stored in git. Bootstrap from a local JSON file:

```bash
cp data/portfolio.seed.example.json data/portfolio.seed.json
# edit with your holdings
npm run seed
```

On Railway, mount a volume at `/data` and set `DB_PATH=/data/portfolio.db`.

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
| `npm run seed` | Load holdings from `data/portfolio.seed.json` into SQLite |

## Project structure

```
src/
├── index.ts          # server + webhook + auth
├── telegram.ts       # bot API, voice, input parsing
├── config.ts         # env vars
├── agent/
│   └── index.ts      # prompt + LangChain agent + chat()
└── tools/
    ├── calendar.ts   # Google Calendar + tools
    └── portfolio.ts  # SQLite + Yahoo Finance + tools
```
