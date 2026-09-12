import { Router } from 'itty-router';

interface Env {
  TELEGRAM_TOKEN: string;
  BOT_SECRET: string;
  MEMORY_STORE: DurableObjectNamespace;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

interface BotMessage {
  chat_id: number;
  text: string;
  parse_mode?: string;
  reply_markup?: any;
}

const router = Router();

// Telegram API helper
async function sendTelegramMessage(
  token: string,
  message: BotMessage
): Promise<Response> {
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
}

async function validateWebhook(
  req: Request,
  secret: string
): Promise<boolean> {
  const signature = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  return signature === secret;
}

// Routes

router.post('/webhook', async (req: Request, env: Env) => {
  // Validate webhook
  if (!(await validateWebhook(req, env.BOT_SECRET))) {
    return new Response('Unauthorized', { status: 403 });
  }

  const update: TelegramUpdate = await req.json();
  
  if (!update.message || !update.message.text) {
    return new Response('ok');
  }

  const message = update.message;
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text.trim();

  // Get or create user memory
  const memoryId = `user-${userId}`;
  const memory = env.MEMORY_STORE.get(memoryId);

  try {
    if (text === '/start') {
      await sendTelegramMessage(env.TELEGRAM_TOKEN, {
        chat_id: chatId,
        text: `🧠 **HERMES Agent Online**\n\nCommands:\n/recall <query> — Search memory\n/store <text> — Save to memory\n/sync — Sync with PWA\n/status — Show memory state`,
        parse_mode: 'Markdown',
      });
    } else if (text.startsWith('/recall ')) {
      const query = text.slice(8).trim();
      const result = await memory.fetch('POST', {
        action: 'recall',
        query,
      });
      const response = await result.text();
      await sendTelegramMessage(env.TELEGRAM_TOKEN, {
        chat_id: chatId,
        text: `🔍 Recall: ${query}\n\n${response}`,
      });
    } else if (text.startsWith('/store ')) {
      const content = text.slice(7).trim();
      const result = await memory.fetch('POST', {
        action: 'store',
        content,
      });
      await sendTelegramMessage(env.TELEGRAM_TOKEN, {
        chat_id: chatId,
        text: `✅ Stored: ${content.substring(0, 50)}...`,
      });
    } else if (text === '/status') {
      const result = await memory.fetch('GET');
      const state = await result.json();
      await sendTelegramMessage(env.TELEGRAM_TOKEN, {
        chat_id: chatId,
        text: `📊 Memory State\n\nBlocks: ${state.blockCount || 0}\nLastSync: ${state.lastSync || 'never'}`,
      });
    } else {
      // Regular message — store in memory
      await memory.fetch('POST', {
        action: 'store',
        content: text,
        role: 'user',
      });
      await sendTelegramMessage(env.TELEGRAM_TOKEN, {
        chat_id: chatId,
        text: `💾 Saved to memory.`,
      });
    }
  } catch (error) {
    console.error('Error:', error);
    await sendTelegramMessage(env.TELEGRAM_TOKEN, {
      chat_id: chatId,
      text: `❌ Error: ${error.message}`,
    });
  }

  return new Response('ok');
});

router.get('/health', () => new Response('ok'));

// Durable Object — Memory Store
export class MemoryStore {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(req: Request): Promise<Response> {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'get';

    let memory = await this.state.storage?.get<any>('memory') || {
      blocks: [],
      lastSync: null,
    };

    if (action === 'recall') {
      // Simple keyword search
      const query = body.query.toLowerCase();
      const results = memory.blocks.filter((b: any) =>
        b.content.toLowerCase().includes(query)
      );
      return new Response(JSON.stringify(results.slice(0, 5)));
    } else if (action === 'store') {
      memory.blocks.push({
        id: `block-${Date.now()}`,
        content: body.content,
        role: body.role || 'system',
        timestamp: new Date().toISOString(),
      });
      memory.lastSync = new Date().toISOString();
      await this.state.storage?.put('memory', memory);
      return new Response('ok');
    } else {
      return new Response(JSON.stringify(memory));
    }
  }
}

export default router;
