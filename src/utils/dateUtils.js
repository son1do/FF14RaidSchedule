const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return next;
}

export function getWeekStart(baseDate, weekStartDay = 2) {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const currentDay = d.getDay();
  const diff = (currentDay - weekStartDay + 7) % 7;
  return addDays(d, -diff);
}

export function getDateRange(startDate, count) {
  const result = [];
  const todayKey = toDateKey(new Date());
  for (let i = 0; i < count; i += 1) {
    const date = addDays(startDate, i);
    const key = toDateKey(date);
    const dayOfWeek = date.getDay();
    result.push({
      key,
      date,
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekday: WEEKDAYS_JA[dayOfWeek],
      dayOfWeek,
      isToday: key === todayKey,
      isResetDay: dayOfWeek === 2, // FF14 weekly reset (Tuesday)
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });
  }
  return result;
}

export function formatDateShort(dateKey) {
  const d = parseDateKey(dateKey);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS_JA[d.getDay()]})`;
}

export function formatRangeLabel(dates) {
  if (!dates.length) return '';
  const first = dates[0];
  const last = dates[dates.length - 1];
  return `${first.date.getFullYear()}年 ${first.month}/${first.day}(${first.weekday}) 〜 ${last.month}/${last.day}(${last.weekday})`;
}

export function summarizeDay(dateKey, members, entries) {
  const dayEntries = entries[dateKey] || {};
  let ok = 0;
  let maybe = 0;
  let ng = 0;
  let empty = 0;

  for (const m of members) {
    const st = dayEntries[m.id]?.status || '';
    if (st === 'ok') ok += 1;
    else if (st === 'maybe') maybe += 1;
    else if (st === 'ng') ng += 1;
    else empty += 1;
  }

  return {
    ok,
    maybe,
    ng,
    empty,
    allOk: ok === members.length,
    allPossible: ok + maybe === members.length && ng === 0 && empty === 0,
  };
}

export function buildDiscordSummary({ settings, members, dates, entries, confirmedDays }) {
  const lines = [];
  lines.push(`**【${settings.title}】** (${formatRangeLabel(dates)})`);
  if (settings.defaultTime) {
    lines.push(`基本時間: ${settings.defaultTime}`);
  }
  lines.push('');

  const confirmedList = [];
  const candidateList = [];

  for (const d of dates) {
    const summary = summarizeDay(d.key, members, entries);
    const conf = confirmedDays[d.key];
    const dayEntries = entries[d.key] || {};
    const comments = members
      .map((m) => {
        const e = dayEntries[m.id];
        if (!e?.comment) return null;
        const mark = e.status === 'ok' ? '○' : e.status === 'maybe' ? '△' : e.status === 'ng' ? '×' : '';
        return `${m.role}(${m.name}): ${mark}${e.comment}`;
      })
      .filter(Boolean);

    const dateLabel = `${d.month}/${d.day}(${d.weekday})${d.isResetDay ? ' [リセット日]' : ''}`;

    if (conf?.confirmed) {
      const timeStr = conf.time ? ` ${conf.time}` : '';
      const noteStr = conf.note ? ` [${conf.note}]` : '';
      confirmedList.push(`- **${dateLabel}${timeStr}${noteStr}** (○${summary.ok} △${summary.maybe} ×${summary.ng})`);
      if (comments.length) {
        confirmedList.push(`  メモ: ${comments.join(' / ')}`);
      }
    } else if (summary.allOk || summary.allPossible) {
      const tag = summary.allOk ? '★全員○' : '◎調整可';
      candidateList.push(`- ${dateLabel} ${tag} (○${summary.ok} △${summary.maybe} ×${summary.ng})`);
      if (comments.length) {
        candidateList.push(`  メモ: ${comments.join(' / ')}`);
      }
    }
  }

  if (confirmedList.length > 0) {
    lines.push('__■ 活動確定日__');
    lines.push(...confirmedList);
    lines.push('');
  }

  if (candidateList.length > 0) {
    lines.push('__■ 候補日（全員○・調整可）__');
    lines.push(...candidateList);
    lines.push('');
  }

  if (confirmedList.length === 0 && candidateList.length === 0) {
    lines.push('まだ活動確定日や全員参加可能な候補日がありません。各自入力をお願いします！');
  }

  return lines.join('\n').trim();
}

