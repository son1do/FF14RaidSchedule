import { useState, useEffect } from 'react';

export default function SettingsModal({
  open,
  settings,
  onClose,
  onSave,
  onTestDiscord,
  saving,
}) {
  const [title, setTitle] = useState('');
  const [defaultTime, setDefaultTime] = useState('');
  const [notice, setNotice] = useState('');
  const [weekStartDay, setWeekStartDay] = useState(2);

  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordMode, setDiscordMode] = useState('webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [clearWebhookUrl, setClearWebhookUrl] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [clearBotToken, setClearBotToken] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [notifyTime, setNotifyTime] = useState('18:00');
  const [mention, setMention] = useState('');
  const [testing, setTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState(null);

  useEffect(() => {
    if (open && settings) {
      setTitle(settings.title || '');
      setDefaultTime(settings.defaultTime || '');
      setNotice(settings.notice || '');
      setWeekStartDay(settings.weekStartDay ?? 2);

      const dc = settings.discord || {};
      setDiscordEnabled(Boolean(dc.enabled));
      setDiscordMode(dc.mode === 'bot' ? 'bot' : 'webhook');
      setWebhookUrl('');
      setClearWebhookUrl(false);
      setBotToken('');
      setClearBotToken(false);
      setChannelId(dc.channelId || '');
      setNotifyTime(dc.notifyTime || '18:00');
      setMention(dc.mention || '');
      setTestFeedback(null);
    }
  }, [open, settings]);

  if (!open) return null;

  const dcMeta = settings?.discord || {};
  const hasSavedWebhook = Boolean(dcMeta.hasWebhookUrl) && !clearWebhookUrl;
  const hasSavedBotToken = Boolean(dcMeta.hasBotToken) && !clearBotToken;

  const buildPayload = () => ({
    title,
    defaultTime,
    notice,
    weekStartDay: Number(weekStartDay),
    discord: {
      enabled: discordEnabled,
      mode: discordMode,
      webhookUrl: webhookUrl.trim(),
      clearWebhookUrl,
      botToken: botToken.trim(),
      clearBotToken,
      channelId: channelId.trim(),
      notifyTime,
      mention: mention.trim(),
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(buildPayload());
  };

  const handleTest = async () => {
    setTesting(true);
    setTestFeedback(null);
    try {
      // 未保存の入力値も含めて先に保存してからテスト送信
      const saved = await onSave(buildPayload(), { keepOpen: true });
      if (!saved) return;
      const res = await onTestDiscord();
      setTestFeedback({ ok: true, text: res?.message || 'テスト通知を送信しました！' });
    } catch (err) {
      setTestFeedback({ ok: false, text: err.message || 'テスト通知の送信に失敗しました。' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-kicker">固定全体の設定</div>
            <h3 className="modal-title">予定表・Discord通知設定</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body modal-body-scroll">
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

          <div className="form-row-2">
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
          </div>

          <div className="form-group">
            <label htmlFor="settings-notice">お知らせ / 連絡事項</label>
            <textarea
              id="settings-notice"
              rows={2}
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
              maxLength={300}
              placeholder="例: 毎週日曜までに翌週の予定を入力してください"
            />
          </div>

          <div className="discord-section">
            <div className="discord-section-head">
              <div>
                <div className="discord-section-title">Discord 活動日自動通知</div>
                <p className="discord-section-desc">
                  活動確定日の当日、指定した時刻に自動で Discord へリマインドを送信します。
                </p>
              </div>
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={discordEnabled}
                  onChange={(e) => setDiscordEnabled(e.target.checked)}
                />
                <span>{discordEnabled ? 'ON' : 'OFF'}</span>
              </label>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label>送信方式</label>
                <div className="segmented segmented-full" role="group" aria-label="Discord送信方式">
                  <button
                    type="button"
                    className={discordMode === 'webhook' ? 'active' : ''}
                    onClick={() => setDiscordMode('webhook')}
                  >
                    Webhook URL
                  </button>
                  <button
                    type="button"
                    className={discordMode === 'bot' ? 'active' : ''}
                    onClick={() => setDiscordMode('bot')}
                  >
                    Discord Bot
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="discord-notify-time">当日の通知時刻</label>
                <input
                  id="discord-notify-time"
                  type="time"
                  value={notifyTime}
                  onChange={(e) => setNotifyTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {discordMode === 'webhook' ? (
              <div className="form-group">
                <div className="label-with-badge">
                  <label htmlFor="discord-webhook">Webhook URL</label>
                  {hasSavedWebhook && (
                    <span className="cred-badge">
                      {dcMeta.usingEnvWebhook ? '環境変数で設定済' : '設定済'}
                    </span>
                  )}
                </div>
                <div className="secret-input-row">
                  <input
                    id="discord-webhook"
                    type="password"
                    value={webhookUrl}
                    onChange={(e) => {
                      setWebhookUrl(e.target.value);
                      if (e.target.value) setClearWebhookUrl(false);
                    }}
                    placeholder={
                      hasSavedWebhook
                        ? '変更する場合のみ新しいURLを入力'
                        : 'https://discord.com/api/webhooks/...'
                    }
                    maxLength={300}
                    autoComplete="off"
                  />
                  {hasSavedWebhook && !dcMeta.usingEnvWebhook && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setWebhookUrl('');
                        setClearWebhookUrl(true);
                      }}
                    >
                      クリア
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <div className="label-with-badge">
                    <label htmlFor="discord-bot-token">Bot トークン</label>
                    {hasSavedBotToken && (
                      <span className="cred-badge">
                        {dcMeta.usingEnvBotToken ? '環境変数で設定済' : '設定済'}
                      </span>
                    )}
                  </div>
                  <div className="secret-input-row">
                    <input
                      id="discord-bot-token"
                      type="password"
                      value={botToken}
                      onChange={(e) => {
                        setBotToken(e.target.value);
                        if (e.target.value) setClearBotToken(false);
                      }}
                      placeholder={
                        hasSavedBotToken
                          ? '変更する場合のみ新しいトークンを入力'
                          : 'Discord Developer Portal の Bot Token'
                      }
                      maxLength={200}
                      autoComplete="off"
                    />
                    {hasSavedBotToken && !dcMeta.usingEnvBotToken && (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                          setBotToken('');
                          setClearBotToken(true);
                        }}
                      >
                        クリア
                      </button>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <div className="label-with-badge">
                    <label htmlFor="discord-channel-id">通知先チャンネルID</label>
                    {dcMeta.usingEnvChannelId && (
                      <span className="cred-badge">環境変数で設定済</span>
                    )}
                  </div>
                  <input
                    id="discord-channel-id"
                    type="text"
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    placeholder="例: 123456789012345678（開発者モードでコピー）"
                    maxLength={30}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="discord-mention">メンション（任意）</label>
              <input
                id="discord-mention"
                type="text"
                value={mention}
                onChange={(e) => setMention(e.target.value)}
                placeholder="例: @everyone または <@&ロールID>"
                maxLength={60}
              />
            </div>

            <div className="discord-test-bar">
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={saving || testing}
                onClick={handleTest}
              >
                {testing ? '送信中...' : '保存してテスト通知を送信'}
              </button>
              {testFeedback && (
                <span className={`test-feedback ${testFeedback.ok ? 'ok' : 'err'}`}>
                  {testFeedback.text}
                </span>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || testing}>
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
