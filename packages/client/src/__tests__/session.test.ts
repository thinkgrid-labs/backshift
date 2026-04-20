import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionId } from '../session.js';

describe('getSessionId', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('returns a string prefixed with anon_', () => {
    const id = getSessionId();
    expect(id).toMatch(/^anon_/);
  });

  it('returns the same ID on subsequent calls within a session', () => {
    const id1 = getSessionId();
    const id2 = getSessionId();
    expect(id1).toBe(id2);
  });

  it('returns a new ID after sessionStorage is cleared', () => {
    const id1 = getSessionId();
    sessionStorage.clear();
    const id2 = getSessionId();
    expect(id1).not.toBe(id2);
  });

  it('falls back gracefully when sessionStorage throws', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      get() {
        throw new Error('blocked');
      },
      configurable: true,
    });
    try {
      const id = getSessionId();
      expect(id).toMatch(/^anon_/);
    } finally {
      if (original) Object.defineProperty(window, 'sessionStorage', original);
    }
  });
});
