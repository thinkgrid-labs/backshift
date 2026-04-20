import { describe, expect, it, vi } from 'vitest';
import { BeaconTransport, FetchTransport } from '../transport.js';
import type { IngestBatch } from '../types.js';

const batch: IngestBatch = {
  batch: [
    {
      type: 'track',
      event: 'Test',
      context: {
        viewport: '390x844',
        url: '/',
        sessionId: 'anon_test',
        appVersion: 'v1',
        timestamp: 1000,
      },
    },
  ],
};

describe('BeaconTransport', () => {
  it('calls navigator.sendBeacon with a JSON blob', async () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });

    const transport = new BeaconTransport();
    await transport.send('https://example.com/ingest', batch);

    expect(beacon).toHaveBeenCalledOnce();
    const [url, blob] = beacon.mock.calls[0] as [string, Blob];
    expect(url).toBe('https://example.com/ingest');
    expect(blob.type).toBe('application/json');
    const text = await blob.text();
    expect(JSON.parse(text)).toEqual(batch);
  });

  it('falls back to fetch when sendBeacon returns false', async () => {
    vi.stubGlobal('navigator', { sendBeacon: () => false });
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchSpy);

    const transport = new BeaconTransport();
    await transport.send('https://example.com/ingest', batch);

    expect(fetchSpy).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});

describe('FetchTransport', () => {
  it('calls fetch with POST and JSON content-type', async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchSpy);

    const transport = new FetchTransport();
    await transport.send('https://example.com/ingest', batch);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/ingest');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    vi.unstubAllGlobals();
  });
});
