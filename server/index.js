import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSchedule, mutateSchedule, VALID_STATUSES } from './store.js';
import {
  isValidNotifyTime,
  sanitizeDiscordForClient,
  buildTestMessage,
  sendDiscordMessage,
  startDiscordScheduler,
} from './discord.js';
import { syncDiscordBot } from './discordBot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 3001;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

const sseClients = new Set();

function sanitizeScheduleForClient(data) {
  return {
    ...data,
    settings: {
      ...data.settings,
      discord: sanitizeDiscordForClient(data.settings?.discord),
    },
  };
}

function broadcastSchedule(data) {
  if (sseClients.size === 0) return;
  const payload = `event: schedule\ndata: ${JSON.stringify(sanitizeScheduleForClient(data))}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

function cleanString(value, maxLen = 200) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  sseClients.add(res);
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

app.get('/api/schedule', async (_req, res) => {
  try {
    const data = await readSchedule();
    res.json(sanitizeScheduleForClient(data));
  } catch (err) {
    console.error('GET /api/schedule error:', err);
    res.status(500).json({ error: 'スケジュールデータの読み込みに失敗しました。' });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const { title, defaultTime, notice, weekStartDay, discord } = req.body || {};
    const updated = await mutateSchedule((data) => {
      const nextSettings = { ...data.settings };
      if (typeof title === 'string' && title.trim()) {
        nextSettings.title = cleanString(title, 60);
      }
      if (typeof defaultTime === 'string') {
        nextSettings.defaultTime = cleanString(defaultTime, 40);
      }
      if (typeof notice === 'string') {
        nextSettings.notice = cleanString(notice, 300);
      }
      if (weekStartDay === 1 || weekStartDay === 2 || weekStartDay === 0) {
        nextSettings.weekStartDay = weekStartDay;
      }
      if (discord && typeof discord === 'object') {
        const prevDiscord = data.settings?.discord || {};
        const nextDiscord = { ...prevDiscord };
        if (typeof discord.enabled === 'boolean') {
          nextDiscord.enabled = discord.enabled;
        }
        if (discord.mode === 'webhook' || discord.mode === 'bot') {
          nextDiscord.mode = discord.mode;
        }
        if (discord.clearWebhookUrl) {
          nextDiscord.webhookUrl = '';
        } else if (typeof discord.webhookUrl === 'string' && discord.webhookUrl.trim()) {
          nextDiscord.webhookUrl = cleanString(discord.webhookUrl, 300);
        }
        if (discord.clearBotToken) {
          nextDiscord.botToken = '';
        } else if (typeof discord.botToken === 'string' && discord.botToken.trim()) {
          nextDiscord.botToken = cleanString(discord.botToken, 200);
        }
        if (typeof discord.channelId === 'string') {
          nextDiscord.channelId = cleanString(discord.channelId, 30);
        }
        if (isValidNotifyTime(discord.notifyTime)) {
          nextDiscord.notifyTime = discord.notifyTime;
        }
        if (typeof discord.mention === 'string') {
          nextDiscord.mention = cleanString(discord.mention, 60);
        }
        nextSettings.discord = nextDiscord;
      }
      return { ...data, settings: nextSettings };
    });
    broadcastSchedule(updated);
    syncDiscordBot({ readSchedule }).catch((err) => {
      console.error('[Discord Bot] Sync error:', err.message || err);
    });
    res.json(sanitizeScheduleForClient(updated));
  } catch (err) {
    console.error('PUT /api/settings error:', err);
    res.status(500).json({ error: '設定の保存に失敗しました。' });
  }
});

app.post('/api/discord/test', async (_req, res) => {
  try {
    const data = await readSchedule();
    const payload = buildTestMessage(data);
    await sendDiscordMessage(data.settings?.discord, payload);
    res.json({ ok: true, message: 'Discordへテスト通知を送信しました！' });
  } catch (err) {
    console.error('POST /api/discord/test error:', err);
    res.status(400).json({ error: err.message || 'テスト通知の送信に失敗しました。' });
  }
});

app.put('/api/members/:id', async (req, res) => {
  try {
    const memberId = req.params.id;
    const { name, job } = req.body || {};
    let found = false;

    const updated = await mutateSchedule((data) => {
      const nextMembers = data.members.map((m) => {
        if (m.id !== memberId) return m;
        found = true;
        return {
          ...m,
          name: typeof name === 'string' && name.trim() ? cleanString(name, 24) : m.name,
          job: typeof job === 'string' ? cleanString(job, 24) : m.job,
        };
      });
      return { ...data, members: nextMembers };
    });

    if (!found) {
      return res.status(404).json({ error: '指定されたメンバーが見つかりません。' });
    }
    broadcastSchedule(updated);
    res.json(sanitizeScheduleForClient(updated));
  } catch (err) {
    console.error('PUT /api/members/:id error:', err);
    res.status(500).json({ error: 'メンバー情報の保存に失敗しました。' });
  }
});

app.put('/api/entries', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items)
      ? req.body.items
      : req.body && req.body.date && req.body.memberId
        ? [req.body]
        : null;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: '更新する予定データが指定されていません。' });
    }

    const updated = await mutateSchedule((data) => {
      const validMemberIds = new Set(data.members.map((m) => m.id));
      const nextEntries = { ...data.entries };

      for (const item of items) {
        const date = item?.date;
        const memberId = item?.memberId;
        const status = typeof item?.status === 'string' ? item.status : '';
        const comment = cleanString(item?.comment ?? '', 100);

        if (!DATE_RE.test(date) || !validMemberIds.has(memberId) || !VALID_STATUSES.has(status)) {
          continue;
        }

        const dayMap = { ...(nextEntries[date] || {}) };
        if (!status && !comment) {
          delete dayMap[memberId];
        } else {
          dayMap[memberId] = {
            status,
            comment,
            updatedAt: new Date().toISOString(),
          };
        }

        if (Object.keys(dayMap).length === 0) {
          delete nextEntries[date];
        } else {
          nextEntries[date] = dayMap;
        }
      }

      return { ...data, entries: nextEntries };
    });

    broadcastSchedule(updated);
    res.json(sanitizeScheduleForClient(updated));
  } catch (err) {
    console.error('PUT /api/entries error:', err);
    res.status(500).json({ error: '予定の保存に失敗しました。' });
  }
});

app.put('/api/confirmed/:date', async (req, res) => {
  try {
    const date = req.params.date;
    if (!DATE_RE.test(date)) {
      return res.status(400).json({ error: '日付の形式が不正です。' });
    }

    const { confirmed, time, note } = req.body || {};
    const updated = await mutateSchedule((data) => {
      const nextConfirmed = { ...data.confirmedDays };
      const nextNotified = { ...(data.notifiedDays || {}) };
      if (!confirmed) {
        delete nextConfirmed[date];
        delete nextNotified[date];
      } else {
        nextConfirmed[date] = {
          confirmed: true,
          time: cleanString(time ?? data.settings.defaultTime, 40),
          note: cleanString(note ?? '', 60),
        };
      }
      return { ...data, confirmedDays: nextConfirmed, notifiedDays: nextNotified };
    });

    broadcastSchedule(updated);
    res.json(sanitizeScheduleForClient(updated));
  } catch (err) {
    console.error('PUT /api/confirmed/:date error:', err);
    res.status(500).json({ error: '活動確定日の保存に失敗しました。' });
  }
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log(`FF14 Schedule server running at http://localhost:${PORT}`);
  startDiscordScheduler({
    readSchedule,
    mutateSchedule,
    onScheduleUpdated: broadcastSchedule,
  });
  syncDiscordBot({ readSchedule }).catch((err) => {
    console.error('[Discord Bot] Startup sync error:', err.message || err);
  });
});

