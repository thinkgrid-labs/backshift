import type { IngestBatch } from './types.js';

export interface Transport {
  send(endpoint: string, batch: IngestBatch): Promise<void>;
}

export class BeaconTransport implements Transport {
  send(endpoint: string, batch: IngestBatch): Promise<void> {
    const payload = JSON.stringify(batch);
    const blob = new Blob([payload], { type: 'application/json' });
    const queued = navigator.sendBeacon(endpoint, blob);
    if (!queued) {
      // sendBeacon queue full — fall back to fetch (best-effort, non-blocking)
      return fetchFallback(endpoint, payload);
    }
    return Promise.resolve();
  }
}

export class FetchTransport implements Transport {
  async send(endpoint: string, batch: IngestBatch): Promise<void> {
    return fetchFallback(endpoint, JSON.stringify(batch));
  }
}

function fetchFallback(endpoint: string, payload: string): Promise<void> {
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  })
    .then(() => undefined)
    .catch(() => undefined); // fire-and-forget; errors are silent
}

export function createTransport(): Transport {
  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    return new BeaconTransport();
  }
  return new FetchTransport();
}
