import { useState, useEffect } from 'react';
import { formatDateShort } from '../utils/dateUtils.js';

const PRESET_NOTES = ['消化', '練習', 'クリア目標', '延長あり', '予備日'];

export default function ConfirmDayModal({ target, defaultTime, onClose, onSave, saving }) {
  const [confirmed, setConfirmed] = useState(true);
  const [time, setTime] = useState(defaultTime || '21:00〜24:00');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!target) return;
    const existing = target.confirmedData;
    setConfirmed(existing?.confirmed ? true : true);
    setTime(existing?.time || defaultTime || '21:00〜24:00');
    setNote(existing?.note || '');
  }, [target, defaultTime]);

  if (!target) return null;

  const isCurrentlyConfirmed = Boolean(target.confirmedData?.confirmed);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(target.dateKey, { confirmed, time, note });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-kicker">活動日確定設定</div>
            <h3 className="modal-title">{formatDateShort(target.dateKey)}</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="confirm-time">活動時間</label>
            <input
              id="confirm-time"
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="例: 21:00〜24:00"
              maxLength={40}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-note">内容・メモ（任意）</label>
            <input
              id="confirm-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例: 1〜4層消化、4層後半練習"
              maxLength={60}
            />
            <div className="preset-chips">
              {PRESET_NOTES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="chip-btn"
                  onClick={() => setNote(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-footer modal-footer-split">
            {isCurrentlyConfirmed ? (
              <button
                type="button"
                className="btn btn-danger"
                disabled={saving}
                onClick={() => onSave(target.dateKey, { confirmed: false })}
              >
                確定を解除
              </button>
            ) : (
              <span />
            )}
            <div className="modal-footer-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                キャンセル
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '保存中...' : isCurrentlyConfirmed ? '内容を更新' : '活動日に確定'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

