const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidNotifyTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function getLocalDateAndTime(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return {
    dateKey: `${y}-${m}-${d}`,
    timeStr: `${hh}:${mm}`,
  };
}

export function resolveDiscordCredentials(discord = {}) {
  const mode = discord.mode === 'bot' ? 'bot' : 'webhook';
  const webhookUrl = (discord.webhookUrl || process.env.DISCORD_WEBHOOK_URL || '').trim();
  const botToken = (discord.botToken || process.env.DISCORD_BOT_TOKEN || '').trim();
  const channelId = (discord.channelId || process.env.DISCORD_CHANNEL_ID || '').trim();

  return {
    enabled: Boolean(discord.enabled),
    mode,
    webhookUrl,
    botToken,
    channelId,
    notifyTime: isValidNotifyTime(discord.notifyTime) ? discord.notifyTime : '18:00',
    mention: typeof discord.mention === 'string' ? discord.mention.trim() : '',
  };
}

export function sanitizeDiscordForClient(discord = {}) {
  const savedWebhook = Boolean(discord.webhookUrl && discord.webhookUrl.trim());
  const savedBotToken = Boolean(discord.botToken && discord.botToken.trim());
  const envWebhook = Boolean(process.env.DISCORD_WEBHOOK_URL);
  const envBotToken = Boolean(process.env.DISCORD_BOT_TOKEN);
  const envChannelId = Boolean(process.env.DISCORD_CHANNEL_ID);

  return {
    enabled: Boolean(discord.enabled),
    mode: discord.mode === 'bot' ? 'bot' : 'webhook',
    channelId: discord.channelId || '',
    notifyTime: isValidNotifyTime(discord.notifyTime) ? discord.notifyTime : '18:00',
    mention: discord.mention || '',
    hasWebhookUrl: savedWebhook || envWebhook,
    hasBotToken: savedBotToken || envBotToken,
    usingEnvWebhook: !savedWebhook && envWebhook,
    usingEnvBotToken: !savedBotToken && envBotToken,
    usingEnvChannelId: !discord.channelId && envChannelId,
  };
}

export function buildConfirmedDayMessage(data, dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const weekday = WEEKDAYS_JA[dateObj.getDay()];
  const conf = data.confirmedDays?.[dateKey] || {};
  const dayEntries = data.entries?.[dateKey] || {};

  let ok = 0;
  let maybe = 0;
  let ng = 0;
  const comments = [];

  for (const member of data.members || []) {
    const entry = dayEntries[member.id];
    const st = entry?.status || '';
    if (st === 'ok') ok += 1;
    else if (st === 'maybe') maybe += 1;
    else if (st === 'ng') ng += 1;

    if (entry?.comment) {
      const mark = st === 'ok' ? '○' : st === 'maybe' ? '△' : st === 'ng' ? '×' : '';
      comments.push(`${member.role}(${member.name}): ${mark}${entry.comment}`);
    }
  }

  const timeText = conf.time || data.settings?.defaultTime || '未設定';
  const mention = (data.settings?.discord?.mention || '').trim();
  const title = data.settings?.title || 'FF14 固定予定表';

  const fields = [
    { name: '活動時間', value: timeText, inline: true },
    { name: '参加状況', value: `○${ok} / △${maybe} / ×${ng}`, inline: true },
  ];

  if (conf.note) {
    fields.push({ name: '内容・メモ', value: conf.note, inline: false });
  }
  if (comments.length > 0) {
    fields.push({
      name: 'メンバーコメント',
      value: comments.join('\n').slice(0, 1000),
      inline: false,
    });
  }

  const headerLine = `📢 本日は **${title}** の活動確定日です！`;
  return {
    content: mention ? `${mention}\n${headerLine}` : headerLine,
    embeds: [
      {
        title: `📅 ${m}/${d}(${weekday}) 活動日リマインド`,
        color: 0xe0b85c,
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function buildTestMessage(data) {
  const creds = resolveDiscordCredentials(data.settings?.discord);
  const title = data.settings?.title || 'FF14 固定予定表';
  const modeLabel = creds.mode === 'bot' ? 'Discord Bot API' : 'Discord Webhook';

  return {
    content: creds.mention ? `${creds.mention}\n🔔 テスト通知です` : '🔔 テスト通知です',
    embeds: [
      {
        title: `✅ ${title} - Discord連携テスト成功`,
        description: `活動確定日の **${creds.notifyTime}** にこのチャンネルへ自動通知されます。`,
        color: 0x34d399,
        fields: [
          { name: '送信方式', value: modeLabel, inline: true },
          { name: '自動通知', value: creds.enabled ? 'ON' : 'OFF', inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export async function sendDiscordMessage(discordConfig, payload) {
  const creds = resolveDiscordCredentials(discordConfig);

  if (creds.mode === 'webhook') {
    if (!creds.webhookUrl) {
      throw new Error('Discord Webhook URL が設定されていません。');
    }
    if (!/^https:\/\/(canary\.|ptb\.)?(discord\.com|discordapp\.com)\/api\/webhooks\//.test(creds.webhookUrl)) {
      throw new Error('Discord Webhook URL の形式が正しくありません。');
    }
    const res = await fetch(creds.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Webhook送信失敗 (${res.status}): ${text.slice(0, 140)}`);
    }
    return;
  }

  if (!creds.botToken) {
    throw new Error('Discord Bot トークンが設定されていません。');
  }
  if (!/^\d{17,20}$/.test(creds.channelId)) {
    throw new Error('Discord チャンネルID（17〜20桁の数字）が正しく設定されていません。');
  }

  const url = `https://discord.com/api/v10/channels/${creds.channelId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${creds.botToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Botメッセージ送信失敗 (${res.status}): ${text.slice(0, 140)}`);
  }
}

export function startDiscordScheduler({ readSchedule, mutateSchedule, onScheduleUpdated }) {
  let checking = false;

  const tick = async () => {
    if (checking) return;
    checking = true;
    try {
      const data = await readSchedule();
      const creds = resolveDiscordCredentials(data.settings?.discord);
      if (!creds.enabled) return;

      const { dateKey, timeStr } = getLocalDateAndTime();
      const conf = data.confirmedDays?.[dateKey];
      if (!conf?.confirmed) return;

      if (timeStr < creds.notifyTime) return;
      if (data.notifiedDays?.[dateKey]?.sentAt) return;

      const payload = buildConfirmedDayMessage(data, dateKey);
      await sendDiscordMessage(data.settings.discord, payload);

      const updated = await mutateSchedule((current) => ({
        ...current,
        notifiedDays: {
          ...(current.notifiedDays || {}),
          [dateKey]: {
            sentAt: new Date().toISOString(),
            notifyTime: creds.notifyTime,
          },
        },
      }));

      console.log(`[Discord] Sent confirmed day reminder for ${dateKey} at ${timeStr}`);
      onScheduleUpdated?.(updated);
    } catch (err) {
      console.error('[Discord Scheduler Error]:', err.message || err);
    } finally {
      checking = false;
    }
  };

  // 起動直後に1回チェックし、その後は30秒おきにチェック
  const initialTimer = setTimeout(tick, 3000);
  const interval = setInterval(tick, 30000);

  return () => {
    clearTimeout(initialTimer);
    clearInterval(interval);
  };
}
