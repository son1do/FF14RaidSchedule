import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchSchedule,
  updateSettings,
  updateMember,
  updateEntries,
  updateConfirmedDay,
} from './api/client.js';
import {
  addDays,
  getWeekStart,
  getDateRange,
  formatRangeLabel,
  summarizeDay,
  buildDiscordSummary,
  toDateKey,
} from './utils/dateUtils.js';
import CellModal from './components/CellModal.jsx';
import ConfirmDayModal from './components/ConfirmDayModal.jsx';
import MemberModal from './components/MemberModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';

const STORAGE_MEMBER_KEY = 'ff14_schedule_active_member';
const STATUS_CYCLE = ['', 'ok', 'maybe', 'ng'];

function statusSymbol(status) {
  if (status === 'ok') return '○';
  if (status === 'maybe') return '△';
  if (status === 'ng') return '×';
  return '−';
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [weekOffset, setWeekOffset] = useState(0);
  const [rangeWeeks, setRangeWeeks] = useState(1);
  const [quickMode, setQuickMode] = useState(false);
  const [activeMemberId, setActiveMemberId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_MEMBER_KEY) || '';
    } catch {
      return '';
    }
  });

  const [cellModalTarget, setCellModalTarget] = useState(null);
  const [confirmModalTarget, setConfirmModalTarget] = useState(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const schedule = await fetchSchedule();
      setData(schedule);
    } catch (err) {
      setError(err.message || 'データの取得に失敗しました。');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const handleSelectMember = (memberId) => {
    const next = activeMemberId === memberId ? '' : memberId;
    setActiveMemberId(next);
    try {
      if (next) localStorage.setItem(STORAGE_MEMBER_KEY, next);
      else localStorage.removeItem(STORAGE_MEMBER_KEY);
    } catch {
      // ignore storage errors
    }
  };

  const weekStartDay = data?.settings?.weekStartDay ?? 2;

  const dates = useMemo(() => {
    const baseWeekStart = getWeekStart(new Date(), weekStartDay);
    const start = addDays(baseWeekStart, weekOffset * 7);
    return getDateRange(start, rangeWeeks * 7);
  }, [weekOffset, rangeWeeks, weekStartDay]);

  const activeMember = useMemo(
    () => data?.members?.find((m) => m.id === activeMemberId) || null,
    [data, activeMemberId]
  );

  const rangeStats = useMemo(() => {
    if (!data) return { confirmed: 0, allOk: 0, allPossible: 0 };
    let confirmed = 0;
    let allOk = 0;
    let allPossible = 0;
    for (const d of dates) {
      if (data.confirmedDays[d.key]?.confirmed) confirmed += 1;
      const s = summarizeDay(d.key, data.members, data.entries);
      if (s.allOk) allOk += 1;
      else if (s.allPossible) allPossible += 1;
    }
    return { confirmed, allOk, allPossible };
  }, [data, dates]);

  const handleSaveEntry = async (item) => {
    setSaving(true);
    try {
      const updated = await updateEntries([item]);
      setData(updated);
      setCellModalTarget(null);
      showToast('予定を保存しました');
    } catch (err) {
      showToast(err.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleCellClick = async (dateKey, member, entry) => {
    if (quickMode) {
      const currentStatus = entry?.status || '';
      const nextIdx = (STATUS_CYCLE.indexOf(currentStatus) + 1) % STATUS_CYCLE.length;
      const nextStatus = STATUS_CYCLE[nextIdx];
      await handleSaveEntry({
        date: dateKey,
        memberId: member.id,
        status: nextStatus,
        comment: entry?.comment || '',
      });
      return;
    }
    setCellModalTarget({ dateKey, member, entry });
  };

  const handleBulkFillEmpty = async (status) => {
    if (!activeMember || !data) return;
    const items = [];
    for (const d of dates) {
      const existing = data.entries[d.key]?.[activeMember.id];
      if (!existing?.status) {
        items.push({
          date: d.key,
          memberId: activeMember.id,
          status,
          comment: existing?.comment || '',
        });
      }
    }
    if (items.length === 0) {
      showToast('未入力の日がありません');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateEntries(items);
      setData(updated);
      showToast(`${activeMember.name} の未入力 ${items.length}日分を「${statusSymbol(status)}」にしました`);
    } catch (err) {
      showToast(err.message || '一括更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPreviousWeek = async () => {
    if (!activeMember || !data) return;
    const items = [];
    for (const d of dates) {
      const prevKey = toDateKey(addDays(d.date, -7));
      const prevEntry = data.entries[prevKey]?.[activeMember.id];
      if (prevEntry && (prevEntry.status || prevEntry.comment)) {
        items.push({
          date: d.key,
          memberId: activeMember.id,
          status: prevEntry.status || '',
          comment: prevEntry.comment || '',
        });
      }
    }
    if (items.length === 0) {
      showToast('前の週にコピーできる予定がありません');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateEntries(items);
      setData(updated);
      showToast(`前の週から ${items.length}日分をコピーしました`);
    } catch (err) {
      showToast(err.message || 'コピーに失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfirmed = async (dateKey, payload) => {
    setSaving(true);
    try {
      const updated = await updateConfirmedDay(dateKey, payload);
      setData(updated);
      setConfirmModalTarget(null);
      showToast(payload.confirmed ? '活動日を確定しました' : '活動日の確定を解除しました');
    } catch (err) {
      showToast(err.message || '更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMember = async (memberId, payload) => {
    setSaving(true);
    try {
      const updated = await updateMember(memberId, payload);
      setData(updated);
      showToast('メンバー情報を更新しました');
    } catch (err) {
      showToast(err.message || 'メンバー情報の更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (settings) => {
    setSaving(true);
    try {
      const updated = await updateSettings(settings);
      setData(updated);
      setSettingsModalOpen(false);
      showToast('設定を保存しました');
    } catch (err) {
      showToast(err.message || '設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyDiscord = async () => {
    if (!data) return;
    const text = buildDiscordSummary({
      settings: data.settings,
      members: data.members,
      dates,
      entries: data.entries,
      confirmedDays: data.confirmedDays,
    });
    try {
      await navigator.clipboard.writeText(text);
      showToast('Discord用テキストをコピーしました');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Discord用テキストをコピーしました');
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <div className="loading-state">予定表を読み込んでいます...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="app-shell">
        <div className="error-state">
          <p>{error || 'データを読み込めませんでした。'}</p>
          <button type="button" className="btn btn-primary" onClick={() => loadData(false)}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-badge">FF14 8-MAN STATIC</div>
          <div className="title-row">
            <h1>{data.settings.title}</h1>
            {data.settings.defaultTime && (
              <span className="time-pill">基本時間: {data.settings.defaultTime}</span>
            )}
          </div>
          {data.settings.notice && <p className="notice-text">{data.settings.notice}</p>}
        </div>

        <div className="topbar-actions">
          <button type="button" className="btn btn-secondary" onClick={handleCopyDiscord}>
            Discord用にコピー
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setMemberModalOpen(true)}>
            メンバー編集
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setSettingsModalOpen(true)}>
            設定
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => loadData(true)}
            title="他のメンバーの最新入力を再読み込み"
          >
            更新
          </button>
        </div>
      </header>

      <section className="panel member-selector-panel">
        <div className="member-selector-head">
          <span className="panel-label">あなたのロール / 名前を選択（列をハイライト・一括入力）</span>
          <label className="quick-toggle">
            <input
              type="checkbox"
              checked={quickMode}
              onChange={(e) => setQuickMode(e.target.checked)}
            />
            <span>クイック入力モード（クリックで ○→△→× 切替）</span>
          </label>
        </div>

        <div className="member-pills">
          {data.members.map((m) => {
            const isSelected = m.id === activeMemberId;
            return (
              <button
                key={m.id}
                type="button"
                className={`member-pill role-border-${m.roleGroup} ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectMember(m.id)}
              >
                <span className={`role-badge role-${m.roleGroup}`}>{m.role}</span>
                <span className="member-pill-name">{m.name}</span>
              </button>
            );
          })}
        </div>

        {activeMember && (
          <div className="bulk-bar">
            <span className="bulk-label">
              <strong>{activeMember.role} {activeMember.name}</strong> の一括操作:
            </span>
            <button
              type="button"
              className="btn btn-sm btn-ok"
              disabled={saving}
              onClick={() => handleBulkFillEmpty('ok')}
            >
              未入力を全て ○
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ng"
              disabled={saving}
              onClick={() => handleBulkFillEmpty('ng')}
            >
              未入力を全て ×
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={saving}
              onClick={handleCopyPreviousWeek}
            >
              前の週からコピー
            </button>
          </div>
        )}
      </section>

      <section className="toolbar">
        <div className="week-nav">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            ← 前の週
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
          >
            今週
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            次の週 →
          </button>
          <span className="range-label">{formatRangeLabel(dates)}</span>
        </div>

        <div className="toolbar-right">
          <div className="range-stats">
            <span className="stat-pill stat-confirmed">活動確定 {rangeStats.confirmed}日</span>
            <span className="stat-pill stat-all-ok">全員○ {rangeStats.allOk}日</span>
            <span className="stat-pill stat-possible">調整可 {rangeStats.allPossible}日</span>
          </div>
          <div className="segmented">
            <button
              type="button"
              className={rangeWeeks === 1 ? 'active' : ''}
              onClick={() => setRangeWeeks(1)}
            >
              1週間
            </button>
            <button
              type="button"
              className={rangeWeeks === 2 ? 'active' : ''}
              onClick={() => setRangeWeeks(2)}
            >
              2週間
            </button>
          </div>
        </div>
      </section>

      <main className="table-wrap">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="col-date sticky-col">日付</th>
              <th className="col-summary">集計 / 確定</th>
              {data.members.map((m) => (
                <th
                  key={m.id}
                  className={`col-member ${m.id === activeMemberId ? 'col-active' : ''}`}
                >
                  <div className="th-member">
                    <span className={`role-badge role-${m.roleGroup}`}>{m.role}</span>
                    <span className="th-name">{m.name}</span>
                    {m.job && <span className="th-job">{m.job}</span>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {dates.map((d) => {
              const summary = summarizeDay(d.key, data.members, data.entries);
              const conf = data.confirmedDays[d.key];
              const isConfirmed = Boolean(conf?.confirmed);

              const rowClasses = [
                d.isToday ? 'row-today' : '',
                isConfirmed ? 'row-confirmed' : '',
                !isConfirmed && summary.allOk ? 'row-all-ok' : '',
                !isConfirmed && !summary.allOk && summary.allPossible ? 'row-possible' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <tr key={d.key} className={rowClasses}>
                  <td className="col-date sticky-col">
                    <div className="date-cell">
                      <div className="date-main">
                        <span className="date-num">
                          {d.month}/{d.day}
                        </span>
                        <span
                          className={`weekday-tag ${
                            d.dayOfWeek === 0 ? 'sun' : d.dayOfWeek === 6 ? 'sat' : ''
                          }`}
                        >
                          ({d.weekday})
                        </span>
                        {d.isToday && <span className="mini-tag tag-today">今日</span>}
                        {d.isResetDay && <span className="mini-tag tag-reset">リセット</span>}
                      </div>
                      {isConfirmed && (
                        <div className="confirmed-meta">
                          <span className="confirmed-badge">活動確定</span>
                          {conf.time && <span className="confirmed-time">{conf.time}</span>}
                          {conf.note && <span className="confirmed-note">{conf.note}</span>}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="col-summary">
                    <div className="summary-cell">
                      <div className="summary-counts">
                        <span className="cnt-ok">○{summary.ok}</span>
                        <span className="cnt-maybe">△{summary.maybe}</span>
                        <span className="cnt-ng">×{summary.ng}</span>
                      </div>
                      <div className="summary-actions">
                        {summary.allOk && <span className="match-badge match-ok">全員○</span>}
                        {!summary.allOk && summary.allPossible && (
                          <span className="match-badge match-maybe">調整可</span>
                        )}
                        <button
                          type="button"
                          className={`confirm-btn ${isConfirmed ? 'is-confirmed' : ''}`}
                          onClick={() =>
                            setConfirmModalTarget({ dateKey: d.key, confirmedData: conf })
                          }
                        >
                          {isConfirmed ? '確定済' : '確定する'}
                        </button>
                      </div>
                    </div>
                  </td>

                  {data.members.map((m) => {
                    const entry = data.entries[d.key]?.[m.id];
                    const st = entry?.status || '';
                    const comment = entry?.comment || '';
                    const isColActive = m.id === activeMemberId;

                    return (
                      <td
                        key={m.id}
                        className={`col-member cell-slot ${isColActive ? 'col-active' : ''}`}
                      >
                        <div
                          className={`cell-btn status-${st || 'empty'}`}
                          role="button"
                          tabIndex={0}
                          title={comment ? `${m.name}: ${comment}` : `${m.name} の予定を編集`}
                          onClick={() => handleCellClick(d.key, m, entry)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleCellClick(d.key, m, entry);
                            }
                          }}
                        >
                          <span className="cell-symbol">{statusSymbol(st)}</span>
                          {comment && <span className="cell-comment">{comment}</span>}
                          {quickMode && (
                            <button
                              type="button"
                              className="cell-note-btn"
                              title="コメントを編集"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCellModalTarget({ dateKey: d.key, member: m, entry });
                              }}
                            >
                              ✎
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>

      <footer className="legend">
        <span><strong className="cnt-ok">○</strong> 参加OK</span>
        <span><strong className="cnt-maybe">△</strong> 遅刻・早退・条件付き</span>
        <span><strong className="cnt-ng">×</strong> 参加不可</span>
        <span><strong className="cnt-empty">−</strong> 未入力</span>
        <span className="legend-hint">※ セルをクリックして予定・コメントを入力できます</span>
      </footer>

      <CellModal
        target={cellModalTarget}
        onClose={() => setCellModalTarget(null)}
        onSave={handleSaveEntry}
        saving={saving}
      />

      <ConfirmDayModal
        target={confirmModalTarget}
        defaultTime={data.settings.defaultTime}
        onClose={() => setConfirmModalTarget(null)}
        onSave={handleSaveConfirmed}
        saving={saving}
      />

      <MemberModal
        open={memberModalOpen}
        members={data.members}
        onClose={() => setMemberModalOpen(false)}
        onSaveMember={handleSaveMember}
        saving={saving}
      />

      <SettingsModal
        open={settingsModalOpen}
        settings={data.settings}
        onClose={() => setSettingsModalOpen(false)}
        onSave={handleSaveSettings}
        saving={saving}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

