import { useState, useEffect } from 'react';

export default function SettingsModal({ open, settings, onClose, onSave, saving }) {
  const [title, setTitle] = useState('');
  const [defaultTime, setDefaultTime] = useState('');
  const [notice, setNotice] = useState('');
  const [weekStartDay, setWeekStartDay] = useState(2);

  useEffect(() => {
    if (open && settings) {
      setTitle(settings.title || '');
      setDefaultTime(settings.defaultTime || '');
      setNotice(settings.notice || '');
      setWeekStartDay(settings.weekStartDay ?? 2);
    }
  }, [open, settings]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ title, defaultTime, notice, weekStartDay: Number(weekStartDay) });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-kicker">固定全体の設定</div>
            <h3 className="modal-title">予定表設定</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="settings-title">固定名 / 予定表タイトル</label>
            <input
              id="settings-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="settings-time">基本の活動時間</label>
            <input
              id="settings-time"
              type="text"
              value={defaultTime}
              onChange={(e) => setDefaultTime(e.target.value)}
              placeholder="例: 21:00〜24:00"
              maxLength={40}
            />
          </div>

          <div className="form-group">
            <label htmlFor="settings-weekstart">週の開始曜日</label>
            <select
              id="settings-weekstart"
              value={weekStartDay}
              onChange={(e) => setWeekStartDay(Number(e.target.value))}
            >
              <option value={2}>火曜始まり（FF14週リセット基準）</option>
              <option value={1}>月曜始まり</option>
              <option value={0}>日曜始まり</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="settings-notice">お知らせ / 連絡事項</label>
            <textarea
              id="settings-notice"
              rows={3}
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
              maxLength={300}
              placeholder="例: 毎週日曜までに翌週の予定を入力してください"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

