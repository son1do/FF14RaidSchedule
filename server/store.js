import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'schedule.json');

export const VALID_STATUSES = new Set(['ok', 'maybe', 'ng', '']);

export function createDefaultData() {
  return {
    settings: {
      title: 'FF14 固定予定表',
      defaultTime: '21:00〜24:00',
      notice: '毎週火曜リセット基準です。遅刻・早退がある場合はコメントに記入してください。',
      weekStartDay: 2, // 2 = Tuesday (FF14 weekly reset), 1 = Monday
    },
    members: [
      { id: 'mt', role: 'MT', roleGroup: 'tank', name: 'MT', job: '暗黒騎士' },
      { id: 'st', role: 'ST', roleGroup: 'tank', name: 'ST', job: 'ナイト' },
      { id: 'h1', role: 'H1', roleGroup: 'healer', name: 'H1', job: '白魔道士' },
      { id: 'h2', role: 'H2', roleGroup: 'healer', name: 'H2', job: '学者' },
      { id: 'd1', role: 'D1', roleGroup: 'dps', name: 'D1', job: 'ヴァイパー' },
      { id: 'd2', role: 'D2', roleGroup: 'dps', name: 'D2', job: 'リーパー' },
      { id: 'd3', role: 'D3', roleGroup: 'dps', name: 'D3', job: '踊り子' },
      { id: 'd4', role: 'D4', roleGroup: 'dps', name: 'D4', job: 'ピクトマンサー' },
    ],
    // entries[date][memberId] = { status: 'ok'|'maybe'|'ng', comment: string, updatedAt: string }
    entries: {},
    // confirmedDays[date] = { confirmed: boolean, time: string, note: string }
    confirmedDays: {},
    updatedAt: new Date().toISOString(),
  };
}

let writeQueue = Promise.resolve();

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial = createDefaultData();
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

export async function readSchedule() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    const defaults = createDefaultData();
    return {
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
      members: Array.isArray(parsed.members) && parsed.members.length === 8
        ? parsed.members
        : defaults.members,
      entries: parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {},
      confirmedDays: parsed.confirmedDays && typeof parsed.confirmedDays === 'object' ? parsed.confirmedDays : {},
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    const fallback = createDefaultData();
    await writeScheduleRaw(fallback);
    return fallback;
  }
}

async function writeScheduleRaw(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const payload = JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2);
  const tmpFile = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpFile, payload, 'utf8');
  try {
    await fs.rename(tmpFile, DATA_FILE);
  } catch {
    // Windows fallback if rename encounters transient lock
    await fs.writeFile(DATA_FILE, payload, 'utf8');
    await fs.unlink(tmpFile).catch(() => {});
  }
}

export function mutateSchedule(mutator) {
  const task = writeQueue.then(async () => {
    const current = await readSchedule();
    const next = await mutator(current);
    await writeScheduleRaw(next);
    return next;
  });
  writeQueue = task.catch(() => {});
  return task;
}
