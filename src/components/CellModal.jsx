import { useState, useEffect } from 'react';
import { formatDateShort } from '../utils/dateUtils.js';

const PRESET_COMMENTS = [
  '21:30〜OK',
  '22:00〜OK',
  '23:00まで',
  '遅刻かも',
  '途中抜けあり',
  '調整できます',
];

const STATUS_OPTIONS = [
  { value: 'ok', symbol: '○', label: '参加OK', className: 'status-ok' },
  { value: 'maybe', symbol: '△', label: '遅刻・条件付き', className: 'status-maybe' },
  { value: 'ng', symbol: '×', label: '参加不可', className: 'status-ng' },
  { value: '', symbol: '−', label: '未入力', className: 'status-empty' },
];

export default function CellModal({ target, onClose, onSave, saving }) {
  const [status, setStatus] = useState(target?.entry?.status || '');
  const [comment, setComment] = useState(target?.entry?.comment || '');

  useEffect(() => {
    if (!target) return;
    setStatus(target.entry?.status || '');
    setComment(target.entry?.comment || '');
  }, [target]);

  if (!target) return null;

  const { dateKey, member } = target;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ date: dateKey, memberId: member.id, status, comment });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-kicker">{formatDateShort(dateKey)}</div>
            <h3 className="modal-title">
              <span className={`role-badge role-${member.roleGroup}`}>{member.role}</span>
              {member.name}
              {member.job && <span className="member-job-tag">{member.job}</span>}
            </h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="status-picker">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value || 'empty'}
                type="button"
                className={`status-pick-btn ${opt.className} ${status === opt.value ? 'selected' : ''}`}
                onClick={() => setStatus(opt.value)}
              >
                <span className="status-pick-symbol">{opt.symbol}</span>
                <span className="status-pick-label">{opt.label}</span>
              </button>
            ))}
          </div>

          <div className="form-group">
            <label htmlFor="cell-comment">コメント（遅刻・早退・条件など）</label>
            <input
              id="cell-comment"
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="例: 21:30から合流できます"
              maxLength={100}
              autoFocus
            />
            <div className="preset-chips">
              {PRESET_COMMENTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="chip-btn"
                  onClick={() => setComment(preset)}
                >
                  {preset}
                </button>
              ))}
              {comment && (
                <button
                  type="button"
                  className="chip-btn chip-clear"
                  onClick={() => setComment('')}
                >
                  クリア
                </button>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

