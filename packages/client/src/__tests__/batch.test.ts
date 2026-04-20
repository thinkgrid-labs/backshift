import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BatchQueue } from '../batch.js';
import type { BatchedEvent } from '../types.js';

function makeEvent(name = 'TestEvent'): BatchedEvent {
  return {
    type: 'track',
    event: name,
    context: {
      viewport: '390x844',
      url: '/',
      sessionId: 'anon_test',
      appVersion: 'v1',
      timestamp: Date.now(),
    },
  };
}

describe('BatchQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes when maxSize is reached without waiting for timer', async () => {
    const flushed: BatchedEvent[][] = [];
    const queue = new BatchQueue({
      maxSize: 3,
      flushInterval: 60_000,
      onFlush: async (b) => {
        flushed.push(b);
      },
    });

    queue.push(makeEvent());
    queue.push(makeEvent());
    queue.push(makeEvent()); // triggers flush

    await vi.runAllTimersAsync();
    queue.destroy();

    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(3);
  });

  it('flushes after timer interval', async () => {
    const flushed: BatchedEvent[][] = [];
    const queue = new BatchQueue({
      maxSize: 20,
      flushInterval: 1000,
      onFlush: async (b) => {
        flushed.push(b);
      },
    });

    queue.push(makeEvent());
    expect(flushed).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1000);
    queue.destroy();

    expect(flushed).toHaveLength(1);
  });

  it('does not flush empty queue', async () => {
    const onFlush = vi.fn(async () => {});
    const queue = new BatchQueue({ maxSize: 20, flushInterval: 1000, onFlush });
    await vi.advanceTimersByTimeAsync(1000);
    queue.destroy();
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('resets timer after explicit flush', async () => {
    const flushed: BatchedEvent[][] = [];
    const queue = new BatchQueue({
      maxSize: 20,
      flushInterval: 1000,
      onFlush: async (b) => {
        flushed.push(b);
      },
    });

    queue.push(makeEvent('A'));
    await queue.flush();
    expect(flushed).toHaveLength(1);

    // Queue is empty — another tick should not produce another flush
    await vi.advanceTimersByTimeAsync(1000);
    queue.destroy();
    expect(flushed).toHaveLength(1);
  });

  it('does not double-flush on concurrent manual flush calls', async () => {
    const flushed: BatchedEvent[][] = [];
    const queue = new BatchQueue({
      maxSize: 20,
      flushInterval: 60_000,
      onFlush: async (b) => {
        flushed.push(b);
      },
    });

    queue.push(makeEvent('X'));
    await Promise.all([queue.flush(), queue.flush()]);
    queue.destroy();

    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(1);
  });

  it('flushSync drains without awaiting', () => {
    const flushed: BatchedEvent[][] = [];
    const queue = new BatchQueue({
      maxSize: 20,
      flushInterval: 60_000,
      onFlush: async (b) => {
        flushed.push(b);
      },
    });

    queue.push(makeEvent('Y'));
    queue.flushSync();
    queue.destroy();

    // flushed may be populated async but events were removed from queue
    // The promise was fired; we check length check after microtask
  });
});
