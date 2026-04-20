const SESSION_KEY = '__ns_sid';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 18);
}

export function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = `anon_${generateId()}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // SSR or storage access blocked
    return `anon_${generateId()}`;
  }
}
