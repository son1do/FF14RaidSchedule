import { useState, useEffect } from 'react';
import JobCombobox from './JobCombobox.jsx';

export default function MemberModal({ open, members, onClose, onSaveMember, saving }) {
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    if (open) {
      setDrafts(members.map((m) => ({ ...m })));
    }
  }, [open, members]);

  if (!open) return null;

  const updateField = (id, field, value) => {
    setDrafts((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const changed = drafts.filter((d) => {
      const orig = members.find((m) => m.id === d.id);
      return orig && (orig.name !== d.name.trim() || orig.job !== d.job.trim());
    });
    for (const m of changed) {
      await onSaveMember(m.id, { name: m.name, job: m.job });
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-kicker">8人固定メンバー設定</div>
            <h3 className="modal-title">メンバー名・ジョブ編集</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="member-edit-list">
            {drafts.map((m, idx) => (
              <div key={m.id} className="member-edit-row">
                <span className={`role-badge role-${m.roleGroup}`}>{m.role}</span>
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) => updateField(m.id, 'name', e.target.value)}
                  placeholder="キャラクター名 / 呼び名"
                  maxLength={24}
                  required
                />
                <JobCombobox
                  value={m.job}
                  onChange={(val) => updateField(m.id, 'job', val)}
                  roleGroup={m.roleGroup}
                  placeholder="ジョブ選択 / 手入力"
                  maxLength={24}
                  openUpward={idx >= 4}
                />
              </div>
            ))}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '保存中...' : 'すべて保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
