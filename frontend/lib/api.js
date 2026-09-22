const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function req(path, opts = {}) {
  const res = await fetch(`${API}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error?.message || res.statusText), { code: body.error?.code, status: res.status });
  return body;
}

export const api = {
  register: (email, password) => req('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) => req('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => req('/auth/logout', { method: 'POST' }),
  me: () => req('/auth/me'),
  listKits: () => req('/kits'),
  getKit: (id) => req(`/kits/${id}`),
  createKits: (cases) => req('/kits', { method: 'POST', body: JSON.stringify({ cases }) }),
  updateKit: (id, payload) => req(`/kits/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  regenerate: (id, section, category) => req(`/kits/${id}/regenerate`, { method: 'POST', body: JSON.stringify({ section, category }) }),
  deleteKit: (id) => req(`/kits/${id}`, { method: 'DELETE' }),
};
