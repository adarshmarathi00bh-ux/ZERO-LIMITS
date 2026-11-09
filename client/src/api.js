async function call(url, { pin, body, method } = {}) {
  const res = await fetch(url, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(pin ? { 'x-pin': pin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

export const api = {
  config: () => call('/api/config'),
  menu: () => call('/api/menu'),
  slots: ({ need, classStart }) => call(`/api/slots?${new URLSearchParams({ need, ...(classStart ? { classStart } : {}) })}`),
  parse: (text) => call('/api/parse', { body: { text } }),
  order: (body) => call('/api/orders', { body }),
  orders: (ids) => call(`/api/orders?ids=${ids.join(',')}`),
  cancel: (id) => call(`/api/orders/${id}/cancel`, { method: 'POST', body: {} }),
  leaderboard: () => call('/api/leaderboard'),
  auth: (pin) => call('/api/auth', { body: { pin } }),
  kitchen: (pin) => call('/api/kitchen', { pin }),
  setStatus: (id, status, pin) => call(`/api/orders/${id}/status`, { method: 'PATCH', body: { status }, pin }),
  stats: (pin) => call('/api/stats', { pin }),
  insights: (pin) => call('/api/insights', { pin }),
  patchMenu: (id, body, pin) => call(`/api/menu/${id}`, { method: 'PATCH', body, pin }),
  rush: (pin) => call('/api/demo/rush', { body: { count: 20 }, pin }),
};
