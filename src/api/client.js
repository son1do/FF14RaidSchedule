async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `APIエラー (${res.status})`);
  }
  return data;
}

export function fetchSchedule() {
  return request('/api/schedule');
}

export function updateSettings(settings) {
  return request('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export function updateMember(memberId, payload) {
  return request(`/api/members/${encodeURIComponent(memberId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function updateEntries(items) {
  return request('/api/entries', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export function updateConfirmedDay(date, payload) {
  return request(`/api/confirmed/${encodeURIComponent(date)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

