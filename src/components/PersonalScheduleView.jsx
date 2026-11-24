import { summarizeDay } from '../utils/dateUtils.js';

const QUICK_BUTTONS = [
  { value: 'ok', symbol: '○', label: '参加OK', className: 'pbtn-ok' },
  { value: 'maybe', symbol: '△', label: '条件付', className: 'pbtn-maybe' },
  { value: 'ng', symbol: '×', label: '不可', className: 'pbtn-ng' },
];

export default function PersonalScheduleView({
  dates,
  members,
  entries,
  confirmedDays,
  confirmedDayNumbers = {},
  activeMember,
  onSelectMember,
  onQuickSave,
  onOpenCommentModal,
  saving,
}) {
  if (!activeMember) {
    return (
      <section className="personal-empty-card">
        <p className="personal-empty-title">自分のロールを選択して予定を入力</p>
        <p className="personal-empty-desc">
          選択したメンバーの日程だけが縦に並び、ワンタップで ○ / △ / × を切り替えられます。
        </p>
        <div className="personal-pick-grid">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              className="personal-pick-btn"
              onClick={() => onSelectMember(m.id)}
            >
              <span className={`role-badge role-${m.roleGroup}`}>{m.role}</span>
              <span className="personal-pick-name">{m.name}</span>
              {m.job && <span className="personal-pick-job">{m.job}</span>}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const filledCount = dates.filter((d) => Boolean(entries[d.key]?.[activeMember.id]?.status)).length;

  return (
    <section className="personal-view">
      <div className="personal-summary-bar">
        <div className="personal-member-info">
          <span className={`role-badge role-${activeMember.roleGroup}`}>{activeMember.role}</span>
          <strong>{activeMember.name}</strong>
          {activeMember.job && <span className="personal-member-job">{activeMember.job}</span>}
        </div>
        <span className="personal-progress">
          入力済 {filledCount} / {dates.length}日
        </span>
      </div>

      <div className="personal-list">
        {dates.map((d) => {
          const entry = entries[d.key]?.[activeMember.id];
          const currentStatus = entry?.status || '';
          const comment = entry?.comment || '';
          const summary = summarizeDay(d.key, members, entries);
          const conf = confirmedDays[d.key];
          const isConfirmed = Boolean(conf?.confirmed);

          const cardClasses = [
            'personal-day-card',
            d.isToday ? 'is-today' : '',
            isConfirmed ? 'is-confirmed' : '',
            !isConfirmed && summary.allOk ? 'is-all-ok' : '',
            !isConfirmed && !summary.allOk && summary.allPossible ? 'is-possible' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const handleToggleStatus = (nextValue) => {
            const resolved = currentStatus === nextValue ? '' : nextValue;
            onQuickSave({
              date: d.key,
              memberId: activeMember.id,
              status: resolved,
              comment,
            });
          };

          return (
            <article key={d.key} className={cardClasses}>
              <div className="personal-day-top">
                <div className="personal-day-meta">
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
                    {confirmedDayNumbers[d.key] && (
                      <span className="mini-tag tag-activity-day">
                        活動{confirmedDayNumbers[d.key]}日目
                      </span>
                    )}
                    {summary.allOk && <span className="match-badge match-ok">全員○</span>}
                    {!summary.allOk && summary.allPossible && (
                      <span className="match-badge match-maybe">調整可</span>
                    )}
                  </div>

                  {isConfirmed && (
                    <div className="confirmed-meta">
                      <span className="confirmed-badge">活動確定</span>
                      {conf.time && <span className="confirmed-time">{conf.time}</span>}
                      {conf.note && <span className="confirmed-note">{conf.note}</span>}
                    </div>
                  )}
                </div>

                <div className="personal-day-counts" aria-label="全員の集計">
                  <span className="cnt-ok">○{summary.ok}</span>
                  <span className="cnt-maybe">△{summary.maybe}</span>
                  <span className="cnt-ng">×{summary.ng}</span>
                </div>
              </div>

              <div className="personal-day-controls">
                <div className="personal-status-group" role="group" aria-label={`${d.month}/${d.day} の予定`}>
                  {QUICK_BUTTONS.map((btn) => {
                    const isSelected = currentStatus === btn.value;
                    return (
                      <button
                        key={btn.value}
                        type="button"
                        disabled={saving}
                        aria-pressed={isSelected}
                        className={`personal-status-btn ${btn.className} ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleStatus(btn.value)}
                      >
                        <span className="personal-status-symbol">{btn.symbol}</span>
                        <span className="personal-status-label">{btn.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className={`personal-comment-btn ${comment ? 'has-comment' : ''}`}
                  onClick={() => onOpenCommentModal({ dateKey: d.key, member: activeMember, entry })}
                >
                  <span className="personal-comment-icon">✎</span>
                  <span className="personal-comment-text">
                    {comment || 'コメントを追加（遅刻・早退など）'}
                  </span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
