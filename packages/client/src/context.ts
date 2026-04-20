import type { EventContext } from './types.js';
import { getSessionId } from './session.js';

export function buildContext(appVersion: string): EventContext {
  return {
    viewport: getViewport(),
    url: getCurrentUrl(),
    sessionId: getSessionId(),
    appVersion,
    timestamp: Date.now(),
  };
}

function getViewport(): string {
  if (typeof window === 'undefined') return '0x0';
  return `${window.innerWidth}x${window.innerHeight}`;
}

function getCurrentUrl(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.href;
}
