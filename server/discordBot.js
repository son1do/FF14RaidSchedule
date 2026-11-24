import { Client, Events, GatewayIntentBits, MessageFlags, SlashCommandBuilder } from 'discord.js';

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function getWeekStart(baseDate, weekStartDay = 2) {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const diff = (d.getDay() - weekStartDay + 7) % 7;
  return addDays(d, -diff);
}

export function parseFlexibleDate(input, now = new Date()) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let y;
  let m;
  let d;

  const fullMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const shortMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})$/);

  if (fullMatch) {
    y = Number(fullMatch[1]);
    m = Number(fullMatch[2]);
    d = Number(fullMatch[3]);
  } else if (shortMatch) {
    y = now.getFullYear();
    m = Number(shortMatch[1]);
    d = Number(shortMatch[2]);
  } else {
    return null;
  }

  const parsed = new Date(y, m - 1, d);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    return null;
  }
  return parsed;
}

function buildConfirmedDayNumbers(confirmedDays = {}) {
  const sorted = Object.entries(confirmedDays)
    .filter(([, v]) => Boolean(v?.confirmed))
    .map(([key]) => key)
    .sort();
  const map = {};
  sorted.forEach((key, idx) => {
    map[key] = idx + 1;
  });
  return map;
}

function statusSymbol(status) {
  if (status === 'ok') return '○';
  if (status === 'maybe') return '△';
  if (status === 'ng') return '×';
  return '−';
}

export function buildWeekScheduleEmbed({ data, baseDate = new Date(), detail = false }) {
  const weekStartDay = data.settings?.weekStartDay ?? 2;
  const start = getWeekStart(baseDate, weekStartDay);
  const members = data.members || [];
  const entries = data.entries || {};
  const confirmedDays = data.confirmedDays || {};
  const confirmedNumbers = buildConfirmedDayNumbers(confirmedDays);

  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const dt = addDays(start, i);
    days.push({
      key: toDateKey(dt),
      month: dt.getMonth() + 1,
      day: dt.getDate(),
      dayOfWeek: dt.getDay(),
      weekday: WEEKDAYS_JA[dt.getDay()],
      isResetDay: dt.getDay() === 2,
    });
  }

  let confirmedCount = 0;
  let allOkCount = 0;
  let allPossibleCount = 0;

  const fields = days.map((d) => {
    const dayEntries = entries[d.key] || {};
    const conf = confirmedDays[d.key];
    const isConfirmed = Boolean(conf?.confirmed);
    const activityNum = confirmedNumbers[d.key];

    let ok = 0;
    let maybe = 0;
    let ng = 0;
    let empty = 0;
    const comments = [];

    for (const m of members) {
      const e = dayEntries[m.id];
      const st = e?.status || '';
      if (st === 'ok') ok += 1;
      else if (st === 'maybe') maybe += 1;
      else if (st === 'ng') ng += 1;
      else empty += 1;

      if (e?.comment) {
        comments.push(`${m.role}(${m.name}): ${statusSymbol(st)}${e.comment}`);
      }
    }

    const allOk = members.length > 0 && ok === members.length;
    const allPossible = members.length > 0 && ok + maybe === members.length && ng === 0 && empty === 0;

    if (isConfirmed) confirmedCount += 1;
    if (allOk) allOkCount += 1;
    else if (allPossible) allPossibleCount += 1;

    const resetTag = d.isResetDay ? ' [リセット]' : '';
    let fieldName = `▫️ ${d.month}/${d.day}(${d.weekday})${resetTag}`;
    if (isConfirmed) {
      const numTag = activityNum ? ` [活動${activityNum}日目]` : '';
      const timeStr = conf.time ? ` ${conf.time}` : '';
      const noteStr = conf.note ? ` (${conf.note})` : '';
      fieldName = `⭐ ${d.month}/${d.day}(${d.weekday})${resetTag}${numTag}${timeStr}${noteStr}`;
    } else if (allOk) {
      fieldName = `🟢 ${d.month}/${d.day}(${d.weekday})${resetTag} ★全員○`;
    } else if (allPossible) {
      fieldName = `🟡 ${d.month}/${d.day}(${d.weekday})${resetTag} ◎調整可`;
    }

    const valueLines = [`○${ok} / △${maybe} / ×${ng} / 未${empty}`];

    if (detail && members.length > 0) {
      const firstRow = members
        .slice(0, 4)
        .map((m) => `${m.role}:${statusSymbol(dayEntries[m.id]?.status || '')}`)
        .join('  ');
      const secondRow = members
        .slice(4)
        .map((m) => `${m.role}:${statusSymbol(dayEntries[m.id]?.status || '')}`)
        .join('  ');
      valueLines.push(`\`${firstRow}\``);
      if (secondRow) valueLines.push(`\`${secondRow}\``);
    }

    if (comments.length > 0) {
      valueLines.push(`📝 ${comments.join(' / ')}`);
    }

    return {
      name: fieldName.slice(0, 256),
      value: valueLines.join('\n').slice(0, 1024),
      inline: false,
    };
  });

  const first = days[0];
  const last = days[days.length - 1];
  const title = data.settings?.title || 'FF14 固定予定表';
  const defaultTime = data.settings?.defaultTime || '';

  const descParts = [];
  if (defaultTime) descParts.push(`基本時間: **${defaultTime}**`);
  descParts.push(`活動確定: **${confirmedCount}日** / 全員○: **${allOkCount}日** / 調整可: **${allPossibleCount}日**`);

  return {
    title: `📅 【${title}】 ${first.month}/${first.day}(${first.weekday}) 〜 ${last.month}/${last.day}(${last.weekday})`,
    description: descParts.join('\n'),
    color: confirmedCount > 0 ? 0xe0b85c : 0x4678e8,
    fields,
    footer: { text: 'FF14 Raid Schedule' },
    timestamp: new Date().toISOString(),
  };
}

export function buildSlashCommands() {
  const scheduleCommand = new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('指定した週のFF14固定予定表を表示します')
    .addIntegerOption((opt) =>
      opt
        .setName('week')
        .setDescription('表示する週（省略時は今週）')
        .setRequired(false)
        .addChoices(
          { name: '先週 (-1週)', value: -1 },
          { name: '今週 (0週)', value: 0 },
          { name: '来週 (+1週)', value: 1 },
          { name: '再来週 (+2週)', value: 2 },
          { name: '3週間後 (+3週)', value: 3 }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('date')
        .setDescription('特定の日付を含む週を指定（例: 2026-12-01 または 12/1）')
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('detail')
        .setDescription('各メンバーの ○/△/× 一覧も表示する')
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('private')
        .setDescription('自分だけに見える返信にする')
        .setRequired(false)
    );

  return [scheduleCommand.toJSON()];
}

let activeClient = null;
let activeToken = '';

async function stopBot() {
  if (activeClient) {
    try {
      await activeClient.destroy();
    } catch {
      // ignore destroy errors
    }
    activeClient = null;
  }
  activeToken = '';
}

export async function syncDiscordBot({ readSchedule }) {
  const data = await readSchedule();
  const token = (data.settings?.discord?.botToken || process.env.DISCORD_BOT_TOKEN || '').trim();

  if (!token) {
    if (activeClient) {
      await stopBot();
      console.log('[Discord Bot] Stopped (no bot token configured)');
    }
    return;
  }

  if (activeClient && activeToken === token) {
    return;
  }

  await stopBot();

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`[Discord Bot] Logged in as ${readyClient.user.tag}`);
    try {
      const commands = buildSlashCommands();
      const guildId = (process.env.DISCORD_GUILD_ID || '').trim();
      if (guildId) {
        const guild = await readyClient.guilds.fetch(guildId).catch(() => null);
        if (guild) {
          await guild.commands.set(commands);
          console.log(`[Discord Bot] Registered /schedule command to guild ${guildId}`);
        } else {
          await readyClient.application.commands.set(commands);
          console.log('[Discord Bot] Guild not found; registered /schedule command globally');
        }
      } else {
        await readyClient.application.commands.set(commands);
        console.log('[Discord Bot] Registered /schedule command globally');
      }
    } catch (err) {
      console.error('[Discord Bot] Failed to register slash commands:', err.message || err);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'schedule') return;

    try {
      const dateStr = interaction.options.getString('date');
      const weekOffset = interaction.options.getInteger('week') ?? 0;
      const detail = interaction.options.getBoolean('detail') ?? false;
      const isPrivate = interaction.options.getBoolean('private') ?? false;

      let baseDate = new Date();
      if (dateStr) {
        const parsed = parseFlexibleDate(dateStr);
        if (!parsed) {
          await interaction.reply({
            content: `日付の形式が正しくありません: \`${dateStr}\`\n例: \`2026-12-01\` または \`12/1\``,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        baseDate = parsed;
      } else if (weekOffset !== 0) {
        baseDate = addDays(baseDate, weekOffset * 7);
      }

      const latestData = await readSchedule();
      const embed = buildWeekScheduleEmbed({ data: latestData, baseDate, detail });

      await interaction.reply({
        embeds: [embed],
        flags: isPrivate ? MessageFlags.Ephemeral : undefined,
      });
    } catch (err) {
      console.error('[Discord Bot] /schedule error:', err);
      const msg = '予定表の取得中にエラーが発生しました。';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  });

  client.on(Events.Error, (err) => {
    console.error('[Discord Bot] Client error:', err.message || err);
  });

  activeClient = client;
  activeToken = token;

  try {
    await client.login(token);
  } catch (err) {
    console.error('[Discord Bot] Login failed:', err.message || err);
    await stopBot();
  }
}
