const AMY_TOKEN_KEY = 'amy_app_token';

export function getAmyToken(): string | null {
  return localStorage.getItem(AMY_TOKEN_KEY);
}

export function setAmyToken(token: string) {
  localStorage.setItem(AMY_TOKEN_KEY, token);
}

export function clearAmyToken() {
  localStorage.removeItem(AMY_TOKEN_KEY);
}

export async function amyFetch(path: string, options: RequestInit = {}) {
  const token = getAmyToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`/api/v1/amy${path}`, { ...options, headers });

  if (res.status === 401) {
    clearAmyToken();
    if (!window.location.pathname.endsWith('/login')) {
      window.location.href = '/amy-app/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || 'Request failed');
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function amyLogin(username: string, password: string) {
  const res = await fetch('/api/v1/amy/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(err.error || 'Login failed');
  }
  const data = await res.json();
  setAmyToken(data.token);
  return data;
}
