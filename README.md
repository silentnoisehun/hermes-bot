# HERMES Bot — CloudFlare Workers

Serverless Telegram bot backend with Durable Objects memory store.

## Quick Start

### 1. Prerequisites

```bash
npm install -g wrangler
wrangler login
```

### 2. Create Telegram Bot

Chat with @BotFather:
- `/newbot`
- Name: `HermesAgent`
- Copy token

### 3. Set Secrets

```bash
wrangler secret put TELEGRAM_TOKEN
# Paste your token

wrangler secret put BOT_SECRET
# Generate: openssl rand -hex 32
```

### 4. Deploy

```bash
npm install
wrangler deploy
```

You'll get: `https://hermes-bot.your-domain.workers.dev`

### 5. Register Webhook

```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://hermes-bot.your-domain.workers.dev/webhook",
    "secret_token": "<YOUR_BOT_SECRET>"
  }'
```

### 6. Verify

```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

## Commands

| Command | What |
|---------|------|
| `/start` | Help |
| `/recall <query>` | Search memory |
| `/store <text>` | Save to memory |
| `/status` | Stats |

Any message = auto-store.

## Architecture

```
Telegram
  ↓
[CloudFlare Workers]
  ├─ POST /webhook
  ├─ GET /health
  └─ GET /api/*
  ↓
[Durable Object: MemoryStore]
  ├─ store(content, role)
  ├─ recall(query)
  └─ get()
  ↓
[Persistent Storage]
```

## Environment

Free tier: 100,000 requests/day, 10ms CPU.

Paid: unlimited.

---

**See:** [hermes-pwa](https://github.com/silentnoisehun/hermes-pwa) for PWA frontend.
